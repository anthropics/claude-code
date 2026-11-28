// Voice service: audio recording for push-to-talk voice input.
//
// Recording uses native audio capture (cpal) on macOS, Linux, and Windows
// for in-process mic access. Falls back to SoX `rec` or arecord (ALSA)
// on Linux if the native module is unavailable.

import { type ChildProcess, spawn, spawnSync } from 'child_process'
import { readFile } from 'fs/promises'
import { logForDebugging } from '../utils/debug.js'
import { isEnvTruthy, isRunningOnHomespace } from '../utils/envUtils.js'
import { logError } from '../utils/log.js'
import { getPlatform } from '../utils/platform.js'

// Lazy-loaded native audio module. audio-capture.node links against
// CoreAudio.framework + AudioUnit.framework; dlopen is synchronous and
// blocks the event loop for ~1s warm, up to ~8s on cold coreaudiod
// (post-wake, post-boot). Load happens on first voice keypress — no
// preload, because there's no way to make dlopen non-blocking and a
// startup freeze is worse than a first-press delay.
type AudioNapi = typeof import('audio-capture-napi')
let audioNapi: AudioNapi | null = null
let audioNapiPromise: Promise<AudioNapi> | null = null

function loadAudioNapi(): Promise<AudioNapi> {
  audioNapiPromise ??= (async () => {
    const t0 = Date.now()
    const mod = await import('audio-capture-napi')
    // vendor/audio-capture-src/index.ts defers require(...node) until the
    // first function call — trigger it here so timing reflects real cost.
    mod.isNativeAudioAvailable()
    audioNapi = mod
    logForDebugging(`[voice] audio-capture-napi loaded in ${Date.now() - t0}ms`)
    return mod
  })()
  return audioNapiPromise
}

// ─── Constants ───────────────────────────────────────────────────────

const RECORDING_SAMPLE_RATE = 16000
const RECORDING_CHANNELS = 1

// SoX silence detection: stop after this duration of silence
const SILENCE_DURATION_SECS = '2.0'
const SILENCE_THRESHOLD = '3%'

// ─── Dependency check ────────────────────────────────────────────────

function hasCommand(cmd: string): boolean {
  // Spawn the target directly instead of `which cmd`. On Termux/Android
  // `which` is a shell builtin — the external binary is absent or
  // kernel-blocked (EPERM) when spawned from Node. Only reached on
  // non-Windows (win32 returns early from all callers), no PATHEXT issue.
  // result.error is set iff the spawn itself fails (ENOENT/EACCES); exit
  // code is irrelevant — an unrecognized --version still means cmd exists.
  const result = spawnSync(cmd, ['--version'], {
    stdio: 'ignore',
    timeout: 3000,
  })
  return result.error === undefined
}

// Probe whether arecord can actually open a capture device. hasCommand()
// only checks PATH; on WSL1/Win10-WSL2/headless Linux the binary exists
// but fails at open() because there is no ALSA card and no PulseAudio
// server. On WSL2+WSLg (Win11), PulseAudio works via RDP pipes and arecord
// succeeds. We spawn with the same args as startArecordRecording() and race
// a short timer: if the process is still alive after 150ms it opened the
// device; if it exits early the stderr tells us why. Memoized — audio
// device availability does not change mid-session, and this is called on
// every voice keypress via checkRecordingAvailability().
type ArecordProbeResult = { ok: boolean; stderr: string }
let arecordProbe: Promise<ArecordProbeResult> | null = null

function probeArecord(): Promise<ArecordProbeResult> {
  arecordProbe ??= new Promise(resolve => {
    const child = spawn(
      'arecord',
      [
        '-f',
        'S16_LE',
        '-r',
        String(RECORDING_SAMPLE_RATE),
        '-c',
        String(RECORDING_CHANNELS),
        '-t',
        'raw',
        '/dev/null',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    const timer = setTimeout(
      (c: ChildProcess, r: (v: ArecordProbeResult) => void) => {
        c.kill('SIGTERM')
        r({ ok: true, stderr: '' })
      },
      150,
      child,
      resolve,
    )
    child.once('close', code => {
      clearTimeout(timer)
      // SIGTERM close (code=null) after timer fired is already resolved.
      // Early close with code=0 is unusual (arecord shouldn't exit on its
      // own) but treat as ok.
      void resolve({ ok: code === 0, stderr: stderr.trim() })
    })
    child.once('error', () => {
      clearTimeout(timer)
      void resolve({ ok: false, stderr: 'arecord: command not found' })
    })
  })
  return arecordProbe
}

export function _resetArecordProbeForTesting(): void {
  arecordProbe = null
}

// cpal's ALSA backend writes to our process stderr when it can't find any
// sound cards (it runs in-process — no subprocess pipe to capture it). The
// spawn fallbacks below pipe stderr correctly, so skip native when ALSA has
// nothing to open. Memoized: card presence doesn't change mid-session.
let linuxAlsaCardsMemo: Promise<boolean> | null = null

function linuxHasAlsaCards(): Promise<boolean> {
  linuxAlsaCardsMemo ??= readFile('/proc/asound/cards', 'utf8').then(
    cards => {
      const c = cards.trim()
      return c !== '' && !c.includes('no soundcards')
    },
    () => false,
  )
  return linuxAlsaCardsMemo
}

export function _resetAlsaCardsForTesting(): void {
  linuxAlsaCardsMemo = null
}

type PackageManagerInfo = {
  cmd: string
  args: string[]
  displayCommand: string
}

function detectPackageManager(): PackageManagerInfo | null {
  if (process.platform === 'darwin') {
    if (hasCommand('brew')) {
      return {
        cmd: 'brew',
        args: ['install', 'sox'],
        displayCommand: 'brew install sox',
      }
    }
    return null
  }

  if (process.platform === 'linux') {
    if (hasCommand('apt-get')) {
      return {
        cmd: 'sudo',
        args: ['apt-get', 'install', '-y', 'sox'],
        displayCommand: 'sudo apt-get install sox',
      }
    }
    if (hasCommand('dnf')) {
      return {
        cmd: 'sudo',
        args: ['dnf', 'install', '-y', 'sox'],
        displayCommand: 'sudo dnf install sox',
      }
    }
    if (hasCommand('pacman')) {
      return {
        cmd: 'sudo',
        args: ['pacman', '-S', '--noconfirm', 'sox'],
        displayCommand: 'sudo pacman -S sox',
      }
    }
  }

  return null
}

export async function checkVoiceDependencies(): Promise<{
  available: boolean
  missing: string[]
  installCommand: string | null
}> {
  // Native audio module (cpal) handles everything on macOS, Linux, and Windows
  const napi = await loadAudioNapi()
  if (napi.isNativeAudioAvailable()) {
    return { available: true, missing: [], installCommand: null }
  }

  // Windows has no supported fallback — native module is required
  if (process.platform === 'win32') {
    return {
      available: false,
      missing: ['Voice mode requires the native audio module (not loaded)'],
      installCommand: null,
    }
  }

  // On Linux, arecord (ALSA utils) is a valid fallback recording backend
  if (process.platform === 'linux' && hasCommand('arecord')) {
    return { available: true, missing: [], installCommand: null }
  }

  const missing: string[] = []

  if (!hasCommand('rec')) {
    missing.push('sox (rec command)')
  }

  const pm = missing.length > 0 ? detectPackageManager() : null
  return {
    available: missing.length === 0,
    missing,
    installCommand: pm?.displayCommand ?? null,
  }
}

// ─── Recording availability ──────────────────────────────────────────

export type RecordingAvailability = {
  available: boolean
  reason: string | null
}

// Probe-record through the full fallback chain (native → arecord → SoX)
// to verify that at least one backend can record. On macOS this also
// triggers the TCC permission dialog on first use. We trust the probe
// result over the TCC status API, which can be unreliable for ad-hoc
// signed or cross-architecture binaries (e.g., x64-on-arm64).
export async function requestMicrophonePermission(): Promise<boolean> {
  const napi = await loadAudioNapi()
  if (!napi.isNativeAudioAvailable()) {
    return true // non-native platforms skip this check
  }

  const started = await startRecording(
    _chunk => {}, // discard audio data — this is a permission probe only
    () => {}, // ignore silence-detection end signal
    { silenceDetection: false },
  )
  if (started) {
    stopRecording()
    return true
  }
  return false
}

export async function checkRecordingAvailability(): Promise<RecordingAvailability> {
  // Remote environments have no local microphone
  if (isRunningOnHomespace() || isEnvTruthy(process.env.CLAUDE_CODE_REMOTE)) {
    return {
      available: false,
      reason:
        'Voice mode requires microphone access, but no audio device is available in this environment.\n\nTo use voice mode, run Claude Code locally instead.',
    }
  }

  // Native audio module (cpal) handles everything on macOS, Linux, and Windows
  const napi = await loadAudioNapi()
  if (napi.isNativeAudioAvailable()) {
    return { available: true, reason: null }
  }

  // Windows has no supported fallback
  if (process.platform === 'win32') {
    return {
      available: false,
      reason:
        'Voice recording requires the native audio module, which could not be loaded.',
    }
  }

  const wslNoAudioReason =
    'Voice mode could not access an audio device in WSL.\n\nWSL2 with WSLg (Windows 11) provides audio via PulseAudio — if you are on Windows 10 or WSL1, run Claude Code in native Windows instead.'

  // On Linux (including WSL), probe arecord. hasCommand() is insufficient:
  // the binary can exist while the device open() fails (WSL1, Win10-WSL2,
  // headless Linux). WSL2+WSLg (Win11 default) works via PulseAudio RDP
  // pipes — cpal fails (no /proc/asound/cards) but arecord succeeds.
  if (process.platform === 'linux' && hasCommand('arecord')) {
    const probe = await probeArecord()
    if (probe.ok) {
      return { available: true, reason: null }
    }
    if (getPlatform() === 'wsl') {
      return { available: false, reason: wslNoAudioReason }
    }
    logForDebugging(`[voice] arecord probe failed: ${probe.stderr}`)
    // fall through to SoX
  }

  // Fallback: check for SoX
  if (!hasCommand('rec')) {
    // WSL without arecord AND without SoX: the generic "install SoX"
    // hint below is misleading on WSL1/Win10 (no audio devices at all),
    // but correct on WSL2+WSLg (SoX works via PulseAudio). Since we can't
    // distinguish WSLg-vs-not without a backend to probe, show the WSLg
    // guidance — it points WSL1 users at native Windows AND tells WSLg
    // users their setup should work (they can install sox or alsa-utils).
    // Known gap: WSL with SoX but NO arecord skips both this branch and
    // the probe above — hasCommand('rec') lies the same way. We optimistically
    // trust it (WSLg+SoX would work) rather than probeSox() for a near-zero
    // population (WSL1 × minimal distro × SoX-but-not-alsa-utils).
    if (getPlatform() === 'wsl') {
      return { available: false, reason: wslNoAudioReason }
    }
    const pm = detectPackageManager()
    return {
      available: false,
      reason: pm
        ? `Voice mode requires SoX for audio recording. Install it with: ${pm.displayCommand}`
        : 'Voice mode requires SoX for audio recording. Install SoX manually:\n  macOS: brew install sox\n  Ubuntu/Debian: sudo apt-get install sox\n  Fedora: sudo dnf install sox',
    }
  }

  return { available: true, reason: null }
}

// ─── Recording (native audio on macOS/Linux/Windows, SoX/arecord fallback on Linux) ─────────────

let activeRecorder: ChildProcess | null = null
let nativeRecordingActive = false

export async function startRecording(
  onData: (chunk: Buffer) => void,
  onEnd: () => void,
  options?: { silenceDetection?: boolean },
): Promise<boolean> {
  logForDebugging(`[voice] startRecording called, platform=${process.platform}`)

  // Try native audio module first (macOS, Linux, Windows via cpal)
  const napi = await loadAudioNapi()
  const nativeAvailable =
    napi.isNativeAudioAvailable() &&
    (process.platform !== 'linux' || (await linuxHasAlsaCards()))
  const useSilenceDetection = options?.silenceDetection !== false
  if (nativeAvailable) {
    // Ensure any previous recording is fully stopped
    if (nativeRecordingActive || napi.isNativeRecordingActive()) {
      napi.stopNativeRecording()
      nativeRecordingActive = false
    }
    const started = napi.startNativeRecording(
      (data: Buffer) => {
        onData(data)
      },
      () => {
        if (useSilenceDetection) {
          nativeRecordingActive = false
          onEnd()
        }
        // In push-to-talk mode, ignore the native module's silence-triggered
        // onEnd.  Recording continues until the caller explicitly calls
        // stopRecording() (e.g. when the user presses Ctrl+X).
      },
    )
    if (started) {
      nativeRecordingActive = true
      return true
    }
    // Native recording failed — fall through to platform fallbacks
  }

  // Windows has no supported fallback
  if (process.platform === 'win32') {
    logForDebugging('[voice] Windows native recording unavailable, no fallback')
    return false
  }

  // On Linux, try arecord (ALSA utils) before SoX. Consult the probe so
  // backend selection matches checkRecordingAvailability() — otherwise
  // on headless Linux with both alsa-utils and SoX, the availability
  // check falls through to SoX (probe.ok=false, not WSL) but this path
  // would still pick broken arecord. Probe is memoized; zero latency.
  if (
    process.platform === 'linux' &&
    hasCommand('arecord') &&
    (await probeArecord()).ok
  ) {
    return startArecordRecording(onData, onEnd)
  }

  // Fallback: SoX rec (Linux, or macOS if native module unavailable)
  return startSoxRecording(onData, onEnd, options)
}

function startSoxRecording(
  onData: (chunk: Buffer) => void,
  onEnd: () => void,
  options?: { silenceDetection?: boolean },
): boolean {
  const useSilenceDetection = options?.silenceDetection !== false

  // Record raw PCM: 16 kHz, 16-bit signed, mono, to stdout.
  // --buffer 1024 forces SoX to flush audio in small chunks instead of
  // accumulating data in its internal buffer. Without this, SoX may buffer
  // several seconds of audio before writing anything to stdout when piped,
  // causing zero data flow until the process exits.
  const args = [
    '-q', // quiet
    '--buffer',
    '1024',
    '-t',
    'raw',
    '-r',
    String(RECORDING_SAMPLE_RATE),
    '-e',
    'signed',
    '-b',
    '16',
    '-c',
    String(RECORDING_CHANNELS),
    '-', // stdout
  ]

  // Add silence detection filter (auto-stop on silence).
  // Omit for push-to-talk where the user manually controls start/stop.
  if (useSilenceDetection) {
    args.push(
      'silence', // start/stop on silence
      '1',
      '0.1',
      SILENCE_THRESHOLD,
      '1',
      SILENCE_DURATION_SECS,
      SILENCE_THRESHOLD,
    )
  }

  const child = spawn('rec', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  activeRecorder = child

  child.stdout?.on('data', (chunk: Buffer) => {
    onData(chunk)
  })

  // Consume stderr to prevent backpressure
  child.stderr?.on('data', () => {})

  child.on('close', () => {
    activeRecorder = null
    onEnd()
  })

  child.on('error', err => {
    logError(err)
    activeRecorder = null
    onEnd()
  })

  return true
}

function startArecordRecording(
  onData: (chunk: Buffer) => void,
  onEnd: () => void,
): boolean {
  // Record raw PCM: 16 kHz, 16-bit signed little-endian, mono, to stdout.
  // arecord does not support built-in silence detection, so this backend
  // is best suited for push-to-talk (silenceDetection: false).
  const args = [
    '-f',
    'S16_LE', // signed 16-bit little-endian
    '-r',
    String(RECORDING_SAMPLE_RATE),
    '-c',
    String(RECORDING_CHANNELS),
    '-t',
    'raw', // raw PCM, no WAV header
    '-q', // quiet — no progress output
    '-', // write to stdout
  ]

  const child = spawn('arecord', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  activeRecorder = child

  child.stdout?.on('data', (chunk: Buffer) => {
    onData(chunk)
  })

  // Consume stderr to prevent backpressure
  child.stderr?.on('data', () => {})

  child.on('close', () => {
    activeRecorder = null
    onEnd()
  })

  child.on('error', err => {
    logError(err)
    activeRecorder = null
    onEnd()
  })

  return true
}

export function stopRecording(): void {
  if (nativeRecordingActive && audioNapi) {
    audioNapi.stopNativeRecording()
    nativeRecordingActive = false
    return
  }
  if (activeRecorder) {
    activeRecorder.kill('SIGTERM')
    activeRecorder = null
  }
}
