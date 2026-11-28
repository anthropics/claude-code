
type AudioCaptureNapi = {
  startRecording(
    onData: (data: Buffer) => void,
    onEnd: () => void,
  ): boolean
  stopRecording(): void
  isRecording(): boolean
  startPlayback(sampleRate: number, channels: number): boolean
  writePlaybackData(data: Buffer): void
  stopPlayback(): void
  isPlaying(): boolean
  // TCC microphone authorization status (macOS only):
  // 0 = notDetermined, 1 = restricted, 2 = denied, 3 = authorized.
  // Linux: always returns 3 (authorized) — no system-level microphone permission API.
  // Windows: returns 3 (authorized) if registry key absent or allowed,
  //          2 (denied) if microphone access is explicitly denied.
  microphoneAuthorizationStatus?(): number
}

let cachedModule: AudioCaptureNapi | null = null
let loadAttempted = false

function loadModule(): AudioCaptureNapi | null {
  if (loadAttempted) {
    return cachedModule
  }
  loadAttempted = true

  // Supported platforms: macOS (darwin), Linux, Windows (win32)
  const platform = process.platform
  if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') {
    return null
  }

  // Candidate 1: native-embed path (bun compile). AUDIO_CAPTURE_NODE_PATH is
  // defined at build time in build-with-plugins.ts for native builds only — the
  // define resolves it to the static literal "../../audio-capture.node" so bun
  // compile can rewrite it to /$bunfs/root/audio-capture.node. MUST stay a
  // direct require(env var) — bun cannot analyze require(variable) from a loop.
  if (process.env.AUDIO_CAPTURE_NODE_PATH) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedModule = require(
        process.env.AUDIO_CAPTURE_NODE_PATH,
      ) as AudioCaptureNapi
      return cachedModule
    } catch {
      // fall through to runtime fallbacks below
    }
  }

  // Candidates 2/3: npm-install and dev/source layouts. Dynamic require is
  // fine here — in bundled output (node --target build) require() resolves at
  // runtime relative to cli.js at the package root; in dev it resolves
  // relative to this file (vendor/audio-capture-src/index.ts).
  const platformDir = `${process.arch}-${platform}`
  const fallbacks = [
    `./vendor/audio-capture/${platformDir}/audio-capture.node`,
    `../audio-capture/${platformDir}/audio-capture.node`,
  ]
  for (const p of fallbacks) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedModule = require(p) as AudioCaptureNapi
      return cachedModule
    } catch {
      // try next
    }
  }
  return null
}

export function isNativeAudioAvailable(): boolean {
  return loadModule() !== null
}

export function startNativeRecording(
  onData: (data: Buffer) => void,
  onEnd: () => void,
): boolean {
  const mod = loadModule()
  if (!mod) {
    return false
  }
  return mod.startRecording(onData, onEnd)
}

export function stopNativeRecording(): void {
  const mod = loadModule()
  if (!mod) {
    return
  }
  mod.stopRecording()
}

export function isNativeRecordingActive(): boolean {
  const mod = loadModule()
  if (!mod) {
    return false
  }
  return mod.isRecording()
}

export function startNativePlayback(
  sampleRate: number,
  channels: number,
): boolean {
  const mod = loadModule()
  if (!mod) {
    return false
  }
  return mod.startPlayback(sampleRate, channels)
}

export function writeNativePlaybackData(data: Buffer): void {
  const mod = loadModule()
  if (!mod) {
    return
  }
  mod.writePlaybackData(data)
}

export function stopNativePlayback(): void {
  const mod = loadModule()
  if (!mod) {
    return
  }
  mod.stopPlayback()
}

export function isNativePlaying(): boolean {
  const mod = loadModule()
  if (!mod) {
    return false
  }
  return mod.isPlaying()
}

// Returns the microphone authorization status.
// On macOS, returns the TCC status: 0=notDetermined, 1=restricted, 2=denied, 3=authorized.
// On Linux, always returns 3 (authorized) — no system-level mic permission API.
// On Windows, returns 3 (authorized) if registry key absent or allowed, 2 (denied) if explicitly denied.
// Returns 0 (notDetermined) if the native module is unavailable.
export function microphoneAuthorizationStatus(): number {
  const mod = loadModule()
  if (!mod || !mod.microphoneAuthorizationStatus) {
    return 0
  }
  return mod.microphoneAuthorizationStatus()
}
