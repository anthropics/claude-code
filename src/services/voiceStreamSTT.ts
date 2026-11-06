// Anthropic voice_stream speech-to-text client for push-to-talk.
//
// Only reachable in ant builds (gated by feature('VOICE_MODE') in useVoice.ts import).
//
// Connects to Anthropic's voice_stream WebSocket endpoint using the same
// OAuth credentials as Claude Code.  The endpoint uses conversation_engine
// backed models for speech-to-text.  Designed for hold-to-talk: hold the
// keybinding to record, release to stop and submit.
//
// The wire protocol uses JSON control messages (KeepAlive, CloseStream) and
// binary audio frames.  The server responds with TranscriptText and
// TranscriptEndpoint JSON messages.

import type { ClientRequest, IncomingMessage } from 'http'
import WebSocket from 'ws'
import { getOauthConfig } from '../constants/oauth.js'
import {
  checkAndRefreshOAuthTokenIfNeeded,
  getClaudeAIOAuthTokens,
  isAnthropicAuthEnabled,
} from '../utils/auth.js'
import { logForDebugging } from '../utils/debug.js'
import { getUserAgent } from '../utils/http.js'
import { logError } from '../utils/log.js'
import { getWebSocketTLSOptions } from '../utils/mtls.js'
import { getWebSocketProxyAgent, getWebSocketProxyUrl } from '../utils/proxy.js'
import { jsonParse, jsonStringify } from '../utils/slowOperations.js'

const KEEPALIVE_MSG = '{"type":"KeepAlive"}'
const CLOSE_STREAM_MSG = '{"type":"CloseStream"}'

import { getFeatureValue_CACHED_MAY_BE_STALE } from './analytics/growthbook.js'

// ─── Constants ───────────────────────────────────────────────────────

const VOICE_STREAM_PATH = '/api/ws/speech_to_text/voice_stream'

const KEEPALIVE_INTERVAL_MS = 8_000

// finalize() resolution timers. `noData` fires when no TranscriptText
// arrives post-CloseStream — the server has nothing; don't wait out the
// full ~3-5s WS teardown to confirm emptiness. `safety` is the last-
// resort cap if the WS hangs. Exported so tests can shorten them.
export const FINALIZE_TIMEOUTS_MS = {
  safety: 5_000,
  noData: 1_500,
}

// ─── Types ──────────────────────────────────────────────────────────

export type VoiceStreamCallbacks = {
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (error: string, opts?: { fatal?: boolean }) => void
  onClose: () => void
  onReady: (connection: VoiceStreamConnection) => void
}

// How finalize() resolved. `no_data_timeout` means zero server messages
// after CloseStream — the silent-drop signature (anthropics/anthropic#287008).
export type FinalizeSource =
  | 'post_closestream_endpoint'
  | 'no_data_timeout'
  | 'safety_timeout'
  | 'ws_close'
  | 'ws_already_closed'

export type VoiceStreamConnection = {
  send: (audioChunk: Buffer) => void
  finalize: () => Promise<FinalizeSource>
  close: () => void
  isConnected: () => boolean
}

// The voice_stream endpoint returns transcript chunks and endpoint markers.
type VoiceStreamTranscriptText = {
  type: 'TranscriptText'
  data: string
}

type VoiceStreamTranscriptEndpoint = {
  type: 'TranscriptEndpoint'
}

type VoiceStreamTranscriptError = {
  type: 'TranscriptError'
  error_code?: string
  description?: string
}

type VoiceStreamMessage =
  | VoiceStreamTranscriptText
  | VoiceStreamTranscriptEndpoint
  | VoiceStreamTranscriptError
  | { type: 'error'; message?: string }

// ─── Availability ──────────────────────────────────────────────────────

export function isVoiceStreamAvailable(): boolean {
  // voice_stream uses the same OAuth as Claude Code — available when the
  // user is authenticated with Anthropic (Claude.ai subscriber or has
  // valid OAuth tokens).
  if (!isAnthropicAuthEnabled()) {
    return false
  }
  const tokens = getClaudeAIOAuthTokens()
  return tokens !== null && tokens.accessToken !== null
}

// ─── Connection ────────────────────────────────────────────────────────

export async function connectVoiceStream(
  callbacks: VoiceStreamCallbacks,
  options?: { language?: string; keyterms?: string[] },
): Promise<VoiceStreamConnection | null> {
  // Ensure OAuth token is fresh before connecting
  await checkAndRefreshOAuthTokenIfNeeded()

  const tokens = getClaudeAIOAuthTokens()
  if (!tokens?.accessToken) {
    logForDebugging('[voice_stream] No OAuth token available')
    return null
  }

  // voice_stream is a private_api route, but /api/ws/ is also exposed on
  // the api.anthropic.com listener (service_definitions.yaml private-api:
  // visibility.external: true). We target that host instead of claude.ai
  // because the claude.ai CF zone uses TLS fingerprinting and challenges
  // non-browser clients (anthropics/claude-code#34094). Same private-api
  // pod, same OAuth Bearer auth — just a CF zone that doesn't block us.
  // Desktop dictation still uses claude.ai (Swift URLSession has a
  // browser-class JA3 fingerprint, so CF lets it through).
  const wsBaseUrl =
    process.env.VOICE_STREAM_BASE_URL ||
    getOauthConfig()
      .BASE_API_URL.replace('https://', 'wss://')
      .replace('http://', 'ws://')

  if (process.env.VOICE_STREAM_BASE_URL) {
    logForDebugging(
      `[voice_stream] Using VOICE_STREAM_BASE_URL override: ${process.env.VOICE_STREAM_BASE_URL}`,
    )
  }

  const params = new URLSearchParams({
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    endpointing_ms: '300',
    utterance_end_ms: '1000',
    language: options?.language ?? 'en',
  })

  // Route through conversation-engine with Deepgram Nova 3 (bypassing
  // the server's project_bell_v2_config GrowthBook gate). The server
  // side is anthropics/anthropic#278327 + #281372; this lets us ramp
  // clients independently.
  const isNova3 = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_cobalt_frost',
    false,
  )
  if (isNova3) {
    params.set('use_conversation_engine', 'true')
    params.set('stt_provider', 'deepgram-nova3')
    logForDebugging('[voice_stream] Nova 3 gate enabled (tengu_cobalt_frost)')
  }

  // Append keyterms as query params — the voice_stream proxy forwards
  // these to the STT service which applies appropriate boosting.
  if (options?.keyterms?.length) {
    for (const term of options.keyterms) {
      params.append('keyterms', term)
    }
  }

  const url = `${wsBaseUrl}${VOICE_STREAM_PATH}?${params.toString()}`

  logForDebugging(`[voice_stream] Connecting to ${url}`)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokens.accessToken}`,
    'User-Agent': getUserAgent(),
    'x-app': 'cli',
  }

  const tlsOptions = getWebSocketTLSOptions()
  const wsOptions =
    typeof Bun !== 'undefined'
      ? {
          headers,
          proxy: getWebSocketProxyUrl(url),
          tls: tlsOptions || undefined,
        }
      : { headers, agent: getWebSocketProxyAgent(url), ...tlsOptions }

  const ws = new WebSocket(url, wsOptions)

  let keepaliveTimer: ReturnType<typeof setInterval> | null = null
  let connected = false
  // Set to true once CloseStream has been sent (or the ws is closed).
  // After this, further audio sends are dropped.
  let finalized = false
  // Set to true when finalize() is first called, to prevent double-fire.
  let finalizing = false
  // Set when the HTTP upgrade was rejected (unexpected-response). The
  // close event that follows (1006 from our req.destroy()) is just
  // mechanical teardown; the upgrade handler already reported the error.
  let upgradeRejected = false
  // Resolves finalize(). Four triggers: TranscriptEndpoint post-CloseStream
  // (~300ms); no-data timer (1.5s); WS close (~3-5s); safety timer (5s).
  let resolveFinalize: ((source: FinalizeSource) => void) | null = null
  let cancelNoDataTimer: (() => void) | null = null

  // Define the connection object before event handlers so it can be passed
  // to onReady when the WebSocket opens.
  const connection: VoiceStreamConnection = {
    send(audioChunk: Buffer): void {
      if (ws.readyState !== WebSocket.OPEN) {
        return
      }
      if (finalized) {
        // After CloseStream has been sent, the server rejects further audio.
        // Drop the chunk to avoid a protocol error.
        logForDebugging(
          `[voice_stream] Dropping audio chunk after CloseStream: ${String(audioChunk.length)} bytes`,
        )
        return
      }
      logForDebugging(
        `[voice_stream] Sending audio chunk: ${String(audioChunk.length)} bytes`,
      )
      // Copy the buffer before sending: NAPI Buffer objects from native
      // modules may share a pooled ArrayBuffer.  Creating a view with
      // `new Uint8Array(buf.buffer, offset, len)` can reference stale or
      // overlapping memory by the time the ws library reads it.
      // `Buffer.from()` makes an owned copy that the ws library can safely
      // consume as a binary WebSocket frame.
      ws.send(Buffer.from(audioChunk))
    },
    finalize(): Promise<FinalizeSource> {
      if (finalizing || finalized) {
        // Already finalized or WebSocket already closed — resolve immediately.
        return Promise.resolve('ws_already_closed')
      }
      finalizing = true

      return new Promise<FinalizeSource>(resolve => {
        const safetyTimer = setTimeout(
          () => resolveFinalize?.('safety_timeout'),
          FINALIZE_TIMEOUTS_MS.safety,
        )
        const noDataTimer = setTimeout(
          () => resolveFinalize?.('no_data_timeout'),
          FINALIZE_TIMEOUTS_MS.noData,
        )
        cancelNoDataTimer = () => {
          clearTimeout(noDataTimer)
          cancelNoDataTimer = null
        }

        resolveFinalize = (source: FinalizeSource) => {
          clearTimeout(safetyTimer)
          clearTimeout(noDataTimer)
          resolveFinalize = null
          cancelNoDataTimer = null
          // Legacy Deepgram can leave an interim in lastTranscriptText
          // with no TranscriptEndpoint (websocket_manager.py sends
          // TranscriptChunk and TranscriptEndpoint as independent
          // channel items). All resolve triggers must promote it;
          // centralize here. No-op when the close handler already did.
          if (lastTranscriptText) {
            logForDebugging(
              `[voice_stream] Promoting unreported interim before ${source} resolve`,
            )
            const t = lastTranscriptText
            lastTranscriptText = ''
            callbacks.onTranscript(t, true)
          }
          logForDebugging(`[voice_stream] Finalize resolved via ${source}`)
          resolve(source)
        }

        // If the WebSocket is already closed, resolve immediately.
        if (
          ws.readyState === WebSocket.CLOSED ||
          ws.readyState === WebSocket.CLOSING
        ) {
          resolveFinalize('ws_already_closed')
          return
        }

        // Defer CloseStream to the next event-loop iteration so any audio
        // callbacks already queued by the native recording module are flushed
        // to the WebSocket before the server is told to stop accepting audio.
        // Without this, stopRecording() can return synchronously while the
        // native module still has a pending onData callback in the event queue,
        // causing audio to arrive after CloseStream.
        setTimeout(() => {
          finalized = true
          if (ws.readyState === WebSocket.OPEN) {
            logForDebugging('[voice_stream] Sending CloseStream (finalize)')
            ws.send(CLOSE_STREAM_MSG)
          }
        }, 0)
      })
    },
    close(): void {
      finalized = true
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer)
        keepaliveTimer = null
      }
      connected = false
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    },
    isConnected(): boolean {
      return connected && ws.readyState === WebSocket.OPEN
    },
  }

  ws.on('open', () => {
    logForDebugging('[voice_stream] WebSocket connected')
    connected = true

    // Send an immediate KeepAlive so the server knows the client is active.
    // Audio hardware initialisation can take >1s, so this prevents the
    // server from closing the connection before audio capture starts.
    logForDebugging('[voice_stream] Sending initial KeepAlive')
    ws.send(KEEPALIVE_MSG)

    // Send periodic keepalive to prevent idle timeout
    keepaliveTimer = setInterval(
      ws => {
        if (ws.readyState === WebSocket.OPEN) {
          logForDebugging('[voice_stream] Sending periodic KeepAlive')
          ws.send(KEEPALIVE_MSG)
        }
      },
      KEEPALIVE_INTERVAL_MS,
      ws,
    )

    // Pass the connection to the caller so it can start sending audio.
    // This fires only after the WebSocket is truly open, guaranteeing
    // that send() calls will not be silently dropped.
    callbacks.onReady(connection)
  })

  // Track the last TranscriptText so that when TranscriptEndpoint arrives
  // we can emit it as the final transcript.  The server sometimes sends
  // multiple non-cumulative TranscriptText messages without endpoints
  // between them; the TranscriptText handler auto-finalizes previous
  // segments when it detects the text has changed non-cumulatively.
  let lastTranscriptText = ''

  ws.on('message', (raw: Buffer | string) => {
    const text = raw.toString()
    logForDebugging(
      `[voice_stream] Message received (${String(text.length)} chars): ${text.slice(0, 200)}`,
    )
    let msg: VoiceStreamMessage
    try {
      msg = jsonParse(text) as VoiceStreamMessage
    } catch {
      return
    }

    switch (msg.type) {
      case 'TranscriptText': {
        const transcript = msg.data
        logForDebugging(`[voice_stream] TranscriptText: "${transcript ?? ''}"`)
        // Data arrived after CloseStream — disarm the no-data timer so
        // a slow-but-real flush isn't cut off. Only disarm once finalized
        // (CloseStream sent); pre-CloseStream data racing the deferred
        // send would cancel the timer prematurely, falling back to the
        // slower 5s safety timeout instead of the 1.5s no-data timer.
        if (finalized) {
          cancelNoDataTimer?.()
        }
        if (transcript) {
          // Detect when the server has moved to a new speech segment.
          // Progressive refinements extend or shorten the previous text
          // (e.g., "hello" → "hello world", or "hello wor" → "hello wo").
          // A new segment starts with completely different text (neither
          // is a prefix of the other). When detected, emit the previous
          // text as final so the caller can accumulate it, preventing
          // the new segment from overwriting and losing the old one.
          //
          // Nova 3's interims are cumulative across segments AND can
          // revise earlier text ("Hello?" → "Hello."). Revision breaks
          // the prefix check, causing false auto-finalize → the same
          // text committed once AND re-appearing in the cumulative
          // interim = duplication. Nova 3 only endpoints on the final
          // flush, so auto-finalize is never correct for it.
          if (!isNova3 && lastTranscriptText) {
            const prev = lastTranscriptText.trimStart()
            const next = transcript.trimStart()
            if (
              prev &&
              next &&
              !next.startsWith(prev) &&
              !prev.startsWith(next)
            ) {
              logForDebugging(
                `[voice_stream] Auto-finalizing previous segment (new segment detected): "${lastTranscriptText}"`,
              )
              callbacks.onTranscript(lastTranscriptText, true)
            }
          }
          lastTranscriptText = transcript
          // Emit as interim so the caller can show a live preview.
          callbacks.onTranscript(transcript, false)
        }
        break
      }
      case 'TranscriptEndpoint': {
        logForDebugging(
          `[voice_stream] TranscriptEndpoint received, lastTranscriptText="${lastTranscriptText}"`,
        )
        // The server signals the end of an utterance.  Emit the last
        // TranscriptText as a final transcript so the caller can commit it.
        const finalText = lastTranscriptText
        lastTranscriptText = ''
        if (finalText) {
          callbacks.onTranscript(finalText, true)
        }
        // When TranscriptEndpoint arrives after CloseStream was sent,
        // the server has flushed its final transcript — nothing more is
        // coming.  Resolve finalize now so the caller reads the
        // accumulated buffer immediately (~300ms) instead of waiting
        // for the WebSocket close event (~3-5s of server teardown).
        // `finalized` (not `finalizing`) is the right gate: it flips
        // inside the setTimeout(0) that actually sends CloseStream, so
        // a TranscriptEndpoint that races the deferred send still waits.
        if (finalized) {
          resolveFinalize?.('post_closestream_endpoint')
        }
        break
      }
      case 'TranscriptError': {
        const desc =
          msg.description ?? msg.error_code ?? 'unknown transcription error'
        logForDebugging(`[voice_stream] TranscriptError: ${desc}`)
        if (!finalizing) {
          callbacks.onError(desc)
        }
        break
      }
      case 'error': {
        const errorDetail = msg.message ?? jsonStringify(msg)
        logForDebugging(`[voice_stream] Server error: ${errorDetail}`)
        if (!finalizing) {
          callbacks.onError(errorDetail)
        }
        break
      }
      default:
        break
    }
  })

  ws.on('close', (code, reason) => {
    const reasonStr = reason?.toString() ?? ''
    logForDebugging(
      `[voice_stream] WebSocket closed: code=${String(code)} reason="${reasonStr}"`,
    )
    connected = false
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer)
      keepaliveTimer = null
    }
    // If the server closed the connection before sending TranscriptEndpoint,
    // promote the last interim transcript to final so no text is lost.
    if (lastTranscriptText) {
      logForDebugging(
        '[voice_stream] Promoting unreported interim transcript to final on close',
      )
      const finalText = lastTranscriptText
      lastTranscriptText = ''
      callbacks.onTranscript(finalText, true)
    }
    // During finalize, suppress onError — the session already delivered
    // whatever it had. useVoice's onError path wipes accumulatedRef,
    // which would destroy the transcript before the finalize .then()
    // reads it. `finalizing` (not resolveFinalize) is the gate: set once
    // at finalize() entry, never cleared, so it stays accurate after the
    // fast path or a timer already resolved.
    resolveFinalize?.('ws_close')
    if (!finalizing && !upgradeRejected && code !== 1000 && code !== 1005) {
      callbacks.onError(
        `Connection closed: code ${String(code)}${reasonStr ? ` — ${reasonStr}` : ''}`,
      )
    }
    callbacks.onClose()
  })

  // The ws library fires 'unexpected-response' when the HTTP upgrade
  // returns a non-101 status. Listening lets us surface the actual status
  // and flag 4xx as fatal (same token/TLS fingerprint won't change on
  // retry). With a listener registered, ws does NOT abort on our behalf —
  // we destroy the request; 'error' does not fire, 'close' does (suppressed
  // via upgradeRejected above).
  //
  // Bun's ws shim historically didn't implement this event (a warning
  // is logged once at registration). Under Bun a non-101 upgrade falls
  // through to the generic 'error' + 'close' 1002 path with no recoverable
  // status; the attemptGenRef guard in useVoice.ts still surfaces the
  // retry-attempt failure, the user just sees "Expected 101 status code"
  // instead of "HTTP 503". No harm — the gen fix is the load-bearing part.
  ws.on('unexpected-response', (req: ClientRequest, res: IncomingMessage) => {
    const status = res.statusCode ?? 0
    // Bun's ws implementation on Windows can fire this event for a
    // successful 101 Switching Protocols response (anthropics/claude-code#40510).
    // 101 is never a rejection — bail before we destroy a working upgrade.
    if (status === 101) {
      logForDebugging(
        '[voice_stream] unexpected-response fired with 101; ignoring',
      )
      return
    }
    logForDebugging(
      `[voice_stream] Upgrade rejected: status=${String(status)} cf-mitigated=${String(res.headers['cf-mitigated'])} cf-ray=${String(res.headers['cf-ray'])}`,
    )
    upgradeRejected = true
    res.resume()
    req.destroy()
    if (finalizing) return
    callbacks.onError(
      `WebSocket upgrade rejected with HTTP ${String(status)}`,
      { fatal: status >= 400 && status < 500 },
    )
  })

  ws.on('error', (err: Error) => {
    logError(err)
    logForDebugging(`[voice_stream] WebSocket error: ${err.message}`)
    if (!finalizing) {
      callbacks.onError(`Voice stream connection error: ${err.message}`)
    }
  })

  return connection
}
