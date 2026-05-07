/**
 * Shared transport-layer helpers for bridge message handling.
 *
 * Extracted from replBridge.ts so both the env-based core (initBridgeCore)
 * and the env-less core (initEnvLessBridgeCore) can use the same ingress
 * parsing, control-request handling, and echo-dedup machinery.
 *
 * Everything here is pure — no closure over bridge-specific state. All
 * collaborators (transport, sessionId, UUID sets, callbacks) are passed
 * as params.
 */

import { randomUUID } from 'crypto'
import type { SDKMessage } from '../entrypoints/agentSdkTypes.js'
import type {
  SDKControlRequest,
  SDKControlResponse,
} from '../entrypoints/sdk/controlTypes.js'
import type { SDKResultSuccess } from '../entrypoints/sdk/coreTypes.js'
import { logEvent } from '../services/analytics/index.js'
import { EMPTY_USAGE } from '../services/api/emptyUsage.js'
import type { Message } from '../types/message.js'
import { normalizeControlMessageKeys } from '../utils/controlMessageCompat.js'
import { logForDebugging } from '../utils/debug.js'
import { stripDisplayTagsAllowEmpty } from '../utils/displayTags.js'
import { errorMessage } from '../utils/errors.js'
import type { PermissionMode } from '../utils/permissions/PermissionMode.js'
import { jsonParse } from '../utils/slowOperations.js'
import type { ReplBridgeTransport } from './replBridgeTransport.js'

// ─── Type guards ─────────────────────────────────────────────────────────────

/** Type predicate for parsed WebSocket messages. SDKMessage is a
 *  discriminated union on `type` — validating the discriminant is
 *  sufficient for the predicate; callers narrow further via the union. */
export function isSDKMessage(value: unknown): value is SDKMessage {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    typeof value.type === 'string'
  )
}

/** Type predicate for control_response messages from the server. */
export function isSDKControlResponse(
  value: unknown,
): value is SDKControlResponse {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'control_response' &&
    'response' in value
  )
}

/** Type predicate for control_request messages from the server. */
export function isSDKControlRequest(
  value: unknown,
): value is SDKControlRequest {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'control_request' &&
    'request_id' in value &&
    'request' in value
  )
}

/**
 * True for message types that should be forwarded to the bridge transport.
 * The server only wants user/assistant turns and slash-command system events;
 * everything else (tool_result, progress, etc.) is internal REPL chatter.
 */
export function isEligibleBridgeMessage(m: Message): boolean {
  // Virtual messages (REPL inner calls) are display-only — bridge/SDK
  // consumers see the REPL tool_use/result which summarizes the work.
  if ((m.type === 'user' || m.type === 'assistant') && m.isVirtual) {
    return false
  }
  return (
    m.type === 'user' ||
    m.type === 'assistant' ||
    (m.type === 'system' && m.subtype === 'local_command')
  )
}

/**
 * Extract title-worthy text from a Message for onUserMessage. Returns
 * undefined for messages that shouldn't title the session: non-user, meta
 * (nudges), tool results, compact summaries, non-human origins (task
 * notifications, channel messages), or pure display-tag content
 * (<ide_opened_file>, <session-start-hook>, etc.).
 *
 * Synthetic interrupts ([Request interrupted by user]) are NOT filtered here —
 * isSyntheticMessage lives in messages.ts (heavy import, pulls command
 * registry). The initialMessages path in initReplBridge checks it; the
 * writeMessages path reaching an interrupt as the *first* message is
 * implausible (an interrupt implies a prior prompt already flowed through).
 */
export function extractTitleText(m: Message): string | undefined {
  if (m.type !== 'user' || m.isMeta || m.toolUseResult || m.isCompactSummary)
    return undefined
  if (m.origin && m.origin.kind !== 'human') return undefined
  const content = m.message.content
  let raw: string | undefined
  if (typeof content === 'string') {
    raw = content
  } else {
    for (const block of content) {
      if (block.type === 'text') {
        raw = block.text
        break
      }
    }
  }
  if (!raw) return undefined
  const clean = stripDisplayTagsAllowEmpty(raw)
  return clean || undefined
}

// ─── Ingress routing ─────────────────────────────────────────────────────────

/**
 * Parse an ingress WebSocket message and route it to the appropriate handler.
 * Ignores messages whose UUID is in recentPostedUUIDs (echoes of what we sent)
 * or in recentInboundUUIDs (re-deliveries we've already forwarded — e.g.
 * server replayed history after a transport swap lost the seq-num cursor).
 */
export function handleIngressMessage(
  data: string,
  recentPostedUUIDs: BoundedUUIDSet,
  recentInboundUUIDs: BoundedUUIDSet,
  onInboundMessage: ((msg: SDKMessage) => void | Promise<void>) | undefined,
  onPermissionResponse?: ((response: SDKControlResponse) => void) | undefined,
  onControlRequest?: ((request: SDKControlRequest) => void) | undefined,
): void {
  try {
    const parsed: unknown = normalizeControlMessageKeys(jsonParse(data))

    // control_response is not an SDKMessage — check before the type guard
    if (isSDKControlResponse(parsed)) {
      logForDebugging('[bridge:repl] Ingress message type=control_response')
      onPermissionResponse?.(parsed)
      return
    }

    // control_request from the server (initialize, set_model, can_use_tool).
    // Must respond promptly or the server kills the WS (~10-14s timeout).
    if (isSDKControlRequest(parsed)) {
      logForDebugging(
        `[bridge:repl] Inbound control_request subtype=${parsed.request.subtype}`,
      )
      onControlRequest?.(parsed)
      return
    }

    if (!isSDKMessage(parsed)) return

    // Check for UUID to detect echoes of our own messages
    const uuid =
      'uuid' in parsed && typeof parsed.uuid === 'string'
        ? parsed.uuid
        : undefined

    if (uuid && recentPostedUUIDs.has(uuid)) {
      logForDebugging(
        `[bridge:repl] Ignoring echo: type=${parsed.type} uuid=${uuid}`,
      )
      return
    }

    // Defensive dedup: drop inbound prompts we've already forwarded. The
    // SSE seq-num carryover (lastTransportSequenceNum) is the primary fix
    // for history-replay; this catches edge cases where that negotiation
    // fails (server ignores from_sequence_num, transport died before
    // receiving any frames, etc).
    if (uuid && recentInboundUUIDs.has(uuid)) {
      logForDebugging(
        `[bridge:repl] Ignoring re-delivered inbound: type=${parsed.type} uuid=${uuid}`,
      )
      return
    }

    logForDebugging(
      `[bridge:repl] Ingress message type=${parsed.type}${uuid ? ` uuid=${uuid}` : ''}`,
    )

    if (parsed.type === 'user') {
      if (uuid) recentInboundUUIDs.add(uuid)
      logEvent('tengu_bridge_message_received', {
        is_repl: true,
      })
      // Fire-and-forget — handler may be async (attachment resolution).
      void onInboundMessage?.(parsed)
    } else {
      logForDebugging(
        `[bridge:repl] Ignoring non-user inbound message: type=${parsed.type}`,
      )
    }
  } catch (err) {
    logForDebugging(
      `[bridge:repl] Failed to parse ingress message: ${errorMessage(err)}`,
    )
  }
}

// ─── Server-initiated control requests ───────────────────────────────────────

export type ServerControlRequestHandlers = {
  transport: ReplBridgeTransport | null
  sessionId: string
  /**
   * When true, all mutable requests (interrupt, set_model, set_permission_mode,
   * set_max_thinking_tokens) reply with an error instead of false-success.
   * initialize still replies success — the server kills the connection otherwise.
   * Used by the outbound-only bridge mode and the SDK's /bridge subpath so claude.ai sees a
   * proper error instead of "action succeeded but nothing happened locally".
   */
  outboundOnly?: boolean
  onInterrupt?: () => void
  onSetModel?: (model: string | undefined) => void
  onSetMaxThinkingTokens?: (maxTokens: number | null) => void
  onSetPermissionMode?: (
    mode: PermissionMode,
  ) => { ok: true } | { ok: false; error: string }
}

const OUTBOUND_ONLY_ERROR =
  'This session is outbound-only. Enable Remote Control locally to allow inbound control.'

/**
 * Respond to inbound control_request messages from the server. The server
 * sends these for session lifecycle events (initialize, set_model) and
 * for turn-level coordination (interrupt, set_max_thinking_tokens). If we
 * don't respond, the server hangs and kills the WS after ~10-14s.
 *
 * Previously a closure inside initBridgeCore's onWorkReceived; now takes
 * collaborators as params so both cores can use it.
 */
export function handleServerControlRequest(
  request: SDKControlRequest,
  handlers: ServerControlRequestHandlers,
): void {
  const {
    transport,
    sessionId,
    outboundOnly,
    onInterrupt,
    onSetModel,
    onSetMaxThinkingTokens,
    onSetPermissionMode,
  } = handlers
  if (!transport) {
    logForDebugging(
      '[bridge:repl] Cannot respond to control_request: transport not configured',
    )
    return
  }

  let response: SDKControlResponse

  // Outbound-only: reply error for mutable requests so claude.ai doesn't show
  // false success. initialize must still succeed (server kills the connection
  // if it doesn't — see comment above).
  if (outboundOnly && request.request.subtype !== 'initialize') {
    response = {
      type: 'control_response',
      response: {
        subtype: 'error',
        request_id: request.request_id,
        error: OUTBOUND_ONLY_ERROR,
      },
    }
    const event = { ...response, session_id: sessionId }
    void transport.write(event)
    logForDebugging(
      `[bridge:repl] Rejected ${request.request.subtype} (outbound-only) request_id=${request.request_id}`,
    )
    return
  }

  switch (request.request.subtype) {
    case 'initialize':
      // Respond with minimal capabilities — the REPL handles
      // commands, models, and account info itself.
      response = {
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: request.request_id,
          response: {
            commands: [],
            output_style: 'normal',
            available_output_styles: ['normal'],
            models: [],
            account: {},
            pid: process.pid,
          },
        },
      }
      break

    case 'set_model':
      onSetModel?.(request.request.model)
      response = {
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: request.request_id,
        },
      }
      break

    case 'set_max_thinking_tokens':
      onSetMaxThinkingTokens?.(request.request.max_thinking_tokens)
      response = {
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: request.request_id,
        },
      }
      break

    case 'set_permission_mode': {
      // The callback returns a policy verdict so we can send an error
      // control_response without importing isAutoModeGateEnabled /
      // isBypassPermissionsModeDisabled here (bootstrap-isolation). If no
      // callback is registered (daemon context, which doesn't wire this —
      // see daemonBridge.ts), return an error verdict rather than a silent
      // false-success: the mode is never actually applied in that context,
      // so success would lie to the client.
      const verdict = onSetPermissionMode?.(request.request.mode) ?? {
        ok: false,
        error:
          'set_permission_mode is not supported in this context (onSetPermissionMode callback not registered)',
      }
      if (verdict.ok) {
        response = {
          type: 'control_response',
          response: {
            subtype: 'success',
            request_id: request.request_id,
          },
        }
      } else {
        response = {
          type: 'control_response',
          response: {
            subtype: 'error',
            request_id: request.request_id,
            error: verdict.error,
          },
        }
      }
      break
    }

    case 'interrupt':
      onInterrupt?.()
      response = {
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: request.request_id,
        },
      }
      break

    default:
      // Unknown subtype — respond with error so the server doesn't
      // hang waiting for a reply that never comes.
      response = {
        type: 'control_response',
        response: {
          subtype: 'error',
          request_id: request.request_id,
          error: `REPL bridge does not handle control_request subtype: ${request.request.subtype}`,
        },
      }
  }

  const event = { ...response, session_id: sessionId }
  void transport.write(event)
  logForDebugging(
    `[bridge:repl] Sent control_response for ${request.request.subtype} request_id=${request.request_id} result=${response.response.subtype}`,
  )
}

// ─── Result message (for session archival on teardown) ───────────────────────

/**
 * Build a minimal `SDKResultSuccess` message for session archival.
 * The server needs this event before a WS close to trigger archival.
 */
export function makeResultMessage(sessionId: string): SDKResultSuccess {
  return {
    type: 'result',
    subtype: 'success',
    duration_ms: 0,
    duration_api_ms: 0,
    is_error: false,
    num_turns: 0,
    result: '',
    stop_reason: null,
    total_cost_usd: 0,
    usage: { ...EMPTY_USAGE },
    modelUsage: {},
    permission_denials: [],
    session_id: sessionId,
    uuid: randomUUID(),
  }
}

// ─── BoundedUUIDSet (echo-dedup ring buffer) ─────────────────────────────────

/**
 * FIFO-bounded set backed by a circular buffer. Evicts the oldest entry
 * when capacity is reached, keeping memory usage constant at O(capacity).
 *
 * Messages are added in chronological order, so evicted entries are always
 * the oldest. The caller relies on external ordering (the hook's
 * lastWrittenIndexRef) as the primary dedup — this set is a secondary
 * safety net for echo filtering and race-condition dedup.
 */
export class BoundedUUIDSet {
  private readonly capacity: number
  private readonly ring: (string | undefined)[]
  private readonly set = new Set<string>()
  private writeIdx = 0

  constructor(capacity: number) {
    this.capacity = capacity
    this.ring = new Array<string | undefined>(capacity)
  }

  add(uuid: string): void {
    if (this.set.has(uuid)) return
    // Evict the entry at the current write position (if occupied)
    const evicted = this.ring[this.writeIdx]
    if (evicted !== undefined) {
      this.set.delete(evicted)
    }
    this.ring[this.writeIdx] = uuid
    this.set.add(uuid)
    this.writeIdx = (this.writeIdx + 1) % this.capacity
  }

  has(uuid: string): boolean {
    return this.set.has(uuid)
  }

  clear(): void {
    this.set.clear()
    this.ring.fill(undefined)
    this.writeIdx = 0
  }
}
