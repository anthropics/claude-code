import { feature } from 'bun:bundle'
import type {
  ElicitResult,
  JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js'
import { randomUUID } from 'crypto'
import type { AssistantMessage } from 'src//types/message.js'
import type {
  HookInput,
  HookJSONOutput,
  PermissionUpdate,
  SDKMessage,
  SDKUserMessage,
} from 'src/entrypoints/agentSdkTypes.js'
import { SDKControlElicitationResponseSchema } from 'src/entrypoints/sdk/controlSchemas.js'
import type {
  SDKControlRequest,
  SDKControlResponse,
  StdinMessage,
  StdoutMessage,
} from 'src/entrypoints/sdk/controlTypes.js'
import type { CanUseToolFn } from 'src/hooks/useCanUseTool.js'
import type { Tool, ToolUseContext } from 'src/Tool.js'
import { type HookCallback, hookJSONOutputSchema } from 'src/types/hooks.js'
import { logForDebugging } from 'src/utils/debug.js'
import { logForDiagnosticsNoPII } from 'src/utils/diagLogs.js'
import { AbortError } from 'src/utils/errors.js'
import {
  type Output as PermissionToolOutput,
  permissionPromptToolResultToPermissionDecision,
  outputSchema as permissionToolOutputSchema,
} from 'src/utils/permissions/PermissionPromptToolResultSchema.js'
import type {
  PermissionDecision,
  PermissionDecisionReason,
} from 'src/utils/permissions/PermissionResult.js'
import { hasPermissionsToUseTool } from 'src/utils/permissions/permissions.js'
import { writeToStdout } from 'src/utils/process.js'
import { jsonStringify } from 'src/utils/slowOperations.js'
import { z } from 'zod/v4'
import { notifyCommandLifecycle } from '../utils/commandLifecycle.js'
import { normalizeControlMessageKeys } from '../utils/controlMessageCompat.js'
import { executePermissionRequestHooks } from '../utils/hooks.js'
import {
  applyPermissionUpdates,
  persistPermissionUpdates,
} from '../utils/permissions/PermissionUpdate.js'
import {
  notifySessionStateChanged,
  type RequiresActionDetails,
  type SessionExternalMetadata,
} from '../utils/sessionState.js'
import { jsonParse } from '../utils/slowOperations.js'
import { Stream } from '../utils/stream.js'
import { ndjsonSafeStringify } from './ndjsonSafeStringify.js'

/**
 * Synthetic tool name used when forwarding sandbox network permission
 * requests via the can_use_tool control_request protocol. SDK hosts
 * see this as a normal tool permission prompt.
 */
export const SANDBOX_NETWORK_ACCESS_TOOL_NAME = 'SandboxNetworkAccess'

function serializeDecisionReason(
  reason: PermissionDecisionReason | undefined,
): string | undefined {
  if (!reason) {
    return undefined
  }

  if (
    (feature('BASH_CLASSIFIER') || feature('TRANSCRIPT_CLASSIFIER')) &&
    reason.type === 'classifier'
  ) {
    return reason.reason
  }
  switch (reason.type) {
    case 'rule':
    case 'mode':
    case 'subcommandResults':
    case 'permissionPromptTool':
      return undefined
    case 'hook':
    case 'asyncAgent':
    case 'sandboxOverride':
    case 'workingDir':
    case 'safetyCheck':
    case 'other':
      return reason.reason
  }
}

function buildRequiresActionDetails(
  tool: Tool,
  input: Record<string, unknown>,
  toolUseID: string,
  requestId: string,
): RequiresActionDetails {
  // Per-tool summary methods may throw on malformed input; permission
  // handling must not break because of a bad description.
  let description: string
  try {
    description =
      tool.getActivityDescription?.(input) ??
      tool.getToolUseSummary?.(input) ??
      tool.userFacingName(input)
  } catch {
    description = tool.name
  }
  return {
    tool_name: tool.name,
    action_description: description,
    tool_use_id: toolUseID,
    request_id: requestId,
    input,
  }
}

type PendingRequest<T> = {
  resolve: (result: T) => void
  reject: (error: unknown) => void
  schema?: z.Schema
  request: SDKControlRequest
}

/**
 * Provides a structured way to read and write SDK messages from stdio,
 * capturing the SDK protocol.
 */
// Maximum number of resolved tool_use IDs to track. Once exceeded, the oldest
// entry is evicted. This bounds memory in very long sessions while keeping
// enough history to catch duplicate control_response deliveries.
const MAX_RESOLVED_TOOL_USE_IDS = 1000

export class StructuredIO {
  readonly structuredInput: AsyncGenerator<StdinMessage | SDKMessage>
  private readonly pendingRequests = new Map<string, PendingRequest<unknown>>()

  // CCR external_metadata read back on worker start; null when the
  // transport doesn't restore. Assigned by RemoteIO.
  restoredWorkerState: Promise<SessionExternalMetadata | null> =
    Promise.resolve(null)

  private inputClosed = false
  private unexpectedResponseCallback?: (
    response: SDKControlResponse,
  ) => Promise<void>

  // Tracks tool_use IDs that have been resolved through the normal permission
  // flow (or aborted by a hook). When a duplicate control_response arrives
  // after the original was already handled, this Set prevents the orphan
  // handler from re-processing it — which would push duplicate assistant
  // messages into mutableMessages and cause a 400 "tool_use ids must be unique"
  // error from the API.
  private readonly resolvedToolUseIds = new Set<string>()
  private prependedLines: string[] = []
  private onControlRequestSent?: (request: SDKControlRequest) => void
  private onControlRequestResolved?: (requestId: string) => void

  // sendRequest() and print.ts both enqueue here; the drain loop is the
  // only writer. Prevents control_request from overtaking queued stream_events.
  readonly outbound = new Stream<StdoutMessage>()

  constructor(
    private readonly input: AsyncIterable<string>,
    private readonly replayUserMessages?: boolean,
  ) {
    this.input = input
    this.structuredInput = this.read()
  }

  /**
   * Records a tool_use ID as resolved so that late/duplicate control_response
   * messages for the same tool are ignored by the orphan handler.
   */
  private trackResolvedToolUseId(request: SDKControlRequest): void {
    if (request.request.subtype === 'can_use_tool') {
      this.resolvedToolUseIds.add(request.request.tool_use_id)
      if (this.resolvedToolUseIds.size > MAX_RESOLVED_TOOL_USE_IDS) {
        // Evict the oldest entry (Sets iterate in insertion order)
        const first = this.resolvedToolUseIds.values().next().value
        if (first !== undefined) {
          this.resolvedToolUseIds.delete(first)
        }
      }
    }
  }

  /** Flush pending internal events. No-op for non-remote IO. Overridden by RemoteIO. */
  flushInternalEvents(): Promise<void> {
    return Promise.resolve()
  }

  /** Internal-event queue depth. Overridden by RemoteIO; zero otherwise. */
  get internalEventsPending(): number {
    return 0
  }

  /**
   * Queue a user turn to be yielded before the next message from this.input.
   * Works before iteration starts and mid-stream — read() re-checks
   * prependedLines between each yielded message.
   */
  prependUserMessage(content: string): void {
    this.prependedLines.push(
      jsonStringify({
        type: 'user',
        session_id: '',
        message: { role: 'user', content },
        parent_tool_use_id: null,
      } satisfies SDKUserMessage) + '\n',
    )
  }

  private async *read() {
    let content = ''

    // Called once before for-await (an empty this.input otherwise skips the
    // loop body entirely), then again per block. prependedLines re-check is
    // inside the while so a prepend pushed between two messages in the SAME
    // block still lands first.
    const splitAndProcess = async function* (this: StructuredIO) {
      for (;;) {
        if (this.prependedLines.length > 0) {
          content = this.prependedLines.join('') + content
          this.prependedLines = []
        }
        const newline = content.indexOf('\n')
        if (newline === -1) break
        const line = content.slice(0, newline)
        content = content.slice(newline + 1)
        const message = await this.processLine(line)
        if (message) {
          logForDiagnosticsNoPII('info', 'cli_stdin_message_parsed', {
            type: message.type,
          })
          yield message
        }
      }
    }.bind(this)

    yield* splitAndProcess()

    for await (const block of this.input) {
      content += block
      yield* splitAndProcess()
    }
    if (content) {
      const message = await this.processLine(content)
      if (message) {
        yield message
      }
    }
    this.inputClosed = true
    for (const request of this.pendingRequests.values()) {
      // Reject all pending requests if the input stream
      request.reject(
        new Error('Tool permission stream closed before response received'),
      )
    }
  }

  getPendingPermissionRequests() {
    return Array.from(this.pendingRequests.values())
      .map(entry => entry.request)
      .filter(pr => pr.request.subtype === 'can_use_tool')
  }

  setUnexpectedResponseCallback(
    callback: (response: SDKControlResponse) => Promise<void>,
  ): void {
    this.unexpectedResponseCallback = callback
  }

  /**
   * Inject a control_response message to resolve a pending permission request.
   * Used by the bridge to feed permission responses from claude.ai into the
   * SDK permission flow.
   *
   * Also sends a control_cancel_request to the SDK consumer so its canUseTool
   * callback is aborted via the signal — otherwise the callback hangs.
   */
  injectControlResponse(response: SDKControlResponse): void {
    const requestId = response.response?.request_id
    if (!requestId) return
    const request = this.pendingRequests.get(requestId)
    if (!request) return
    this.trackResolvedToolUseId(request.request)
    this.pendingRequests.delete(requestId)
    // Cancel the SDK consumer's canUseTool callback — the bridge won.
    void this.write({
      type: 'control_cancel_request',
      request_id: requestId,
    })
    if (response.response.subtype === 'error') {
      request.reject(new Error(response.response.error))
    } else {
      const result = response.response.response
      if (request.schema) {
        try {
          request.resolve(request.schema.parse(result))
        } catch (error) {
          request.reject(error)
        }
      } else {
        request.resolve({})
      }
    }
  }

  /**
   * Register a callback invoked whenever a can_use_tool control_request
   * is written to stdout. Used by the bridge to forward permission
   * requests to claude.ai.
   */
  setOnControlRequestSent(
    callback: ((request: SDKControlRequest) => void) | undefined,
  ): void {
    this.onControlRequestSent = callback
  }

  /**
   * Register a callback invoked when a can_use_tool control_response arrives
   * from the SDK consumer (via stdin). Used by the bridge to cancel the
   * stale permission prompt on claude.ai when the SDK consumer wins the race.
   */
  setOnControlRequestResolved(
    callback: ((requestId: string) => void) | undefined,
  ): void {
    this.onControlRequestResolved = callback
  }

  private async processLine(
    line: string,
  ): Promise<StdinMessage | SDKMessage | undefined> {
    // Skip empty lines (e.g. from double newlines in piped stdin)
    if (!line) {
      return undefined
    }
    try {
      const message = normalizeControlMessageKeys(jsonParse(line)) as
        | StdinMessage
        | SDKMessage
      if (message.type === 'keep_alive') {
        // Silently ignore keep-alive messages
        return undefined
      }
      if (message.type === 'update_environment_variables') {
        // Apply environment variable updates directly to process.env.
        // Used by bridge session runner for auth token refresh
        // (CLAUDE_CODE_SESSION_ACCESS_TOKEN) which must be readable
        // by the REPL process itself, not just child Bash commands.
        const keys = Object.keys(message.variables)
        for (const [key, value] of Object.entries(message.variables)) {
          process.env[key] = value
        }
        logForDebugging(
          `[structuredIO] applied update_environment_variables: ${keys.join(', ')}`,
        )
        return undefined
      }
      if (message.type === 'control_response') {
        // Close lifecycle for every control_response, including duplicates
        // and orphans — orphans don't yield to print.ts's main loop, so this
        // is the only path that sees them. uuid is server-injected into the
        // payload.
        const uuid =
          'uuid' in message && typeof message.uuid === 'string'
            ? message.uuid
            : undefined
        if (uuid) {
          notifyCommandLifecycle(uuid, 'completed')
        }
        const request = this.pendingRequests.get(message.response.request_id)
        if (!request) {
          // Check if this tool_use was already resolved through the normal
          // permission flow. Duplicate control_response deliveries (e.g. from
          // WebSocket reconnects) arrive after the original was handled, and
          // re-processing them would push duplicate assistant messages into
          // the conversation, causing API 400 errors.
          const responsePayload =
            message.response.subtype === 'success'
              ? message.response.response
              : undefined
          const toolUseID = responsePayload?.toolUseID
          if (
            typeof toolUseID === 'string' &&
            this.resolvedToolUseIds.has(toolUseID)
          ) {
            logForDebugging(
              `Ignoring duplicate control_response for already-resolved toolUseID=${toolUseID} request_id=${message.response.request_id}`,
            )
            return undefined
          }
          if (this.unexpectedResponseCallback) {
            await this.unexpectedResponseCallback(message)
          }
          return undefined // Ignore responses for requests we don't know about
        }
        this.trackResolvedToolUseId(request.request)
        this.pendingRequests.delete(message.response.request_id)
        // Notify the bridge when the SDK consumer resolves a can_use_tool
        // request, so it can cancel the stale permission prompt on claude.ai.
        if (
          request.request.request.subtype === 'can_use_tool' &&
          this.onControlRequestResolved
        ) {
          this.onControlRequestResolved(message.response.request_id)
        }

        if (message.response.subtype === 'error') {
          request.reject(new Error(message.response.error))
          return undefined
        }
        const result = message.response.response
        if (request.schema) {
          try {
            request.resolve(request.schema.parse(result))
          } catch (error) {
            request.reject(error)
          }
        } else {
          request.resolve({})
        }
        // Propagate control responses when replay is enabled
        if (this.replayUserMessages) {
          return message
        }
        return undefined
      }
      if (
        message.type !== 'user' &&
        message.type !== 'control_request' &&
        message.type !== 'assistant' &&
        message.type !== 'system'
      ) {
        logForDebugging(`Ignoring unknown message type: ${message.type}`, {
          level: 'warn',
        })
        return undefined
      }
      if (message.type === 'control_request') {
        if (!message.request) {
          exitWithMessage(`Error: Missing request on control_request`)
        }
        return message
      }
      if (message.type === 'assistant' || message.type === 'system') {
        return message
      }
      if (message.message.role !== 'user') {
        exitWithMessage(
          `Error: Expected message role 'user', got '${message.message.role}'`,
        )
      }
      return message
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole:: intentional console output
      console.error(`Error parsing streaming input line: ${line}: ${error}`)
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(1)
    }
  }

  async write(message: StdoutMessage): Promise<void> {
    writeToStdout(ndjsonSafeStringify(message) + '\n')
  }

  private async sendRequest<Response>(
    request: SDKControlRequest['request'],
    schema: z.Schema,
    signal?: AbortSignal,
    requestId: string = randomUUID(),
  ): Promise<Response> {
    const message: SDKControlRequest = {
      type: 'control_request',
      request_id: requestId,
      request,
    }
    if (this.inputClosed) {
      throw new Error('Stream closed')
    }
    if (signal?.aborted) {
      throw new Error('Request aborted')
    }
    this.outbound.enqueue(message)
    if (request.subtype === 'can_use_tool' && this.onControlRequestSent) {
      this.onControlRequestSent(message)
    }
    const aborted = () => {
      this.outbound.enqueue({
        type: 'control_cancel_request',
        request_id: requestId,
      })
      // Immediately reject the outstanding promise, without
      // waiting for the host to acknowledge the cancellation.
      const request = this.pendingRequests.get(requestId)
      if (request) {
        // Track the tool_use ID as resolved before rejecting, so that a
        // late response from the host is ignored by the orphan handler.
        this.trackResolvedToolUseId(request.request)
        request.reject(new AbortError())
      }
    }
    if (signal) {
      signal.addEventListener('abort', aborted, {
        once: true,
      })
    }
    try {
      return await new Promise<Response>((resolve, reject) => {
        this.pendingRequests.set(requestId, {
          request: {
            type: 'control_request',
            request_id: requestId,
            request,
          },
          resolve: result => {
            resolve(result as Response)
          },
          reject,
          schema,
        })
      })
    } finally {
      if (signal) {
        signal.removeEventListener('abort', aborted)
      }
      this.pendingRequests.delete(requestId)
    }
  }

  createCanUseTool(
    onPermissionPrompt?: (details: RequiresActionDetails) => void,
  ): CanUseToolFn {
    return async (
      tool: Tool,
      input: { [key: string]: unknown },
      toolUseContext: ToolUseContext,
      assistantMessage: AssistantMessage,
      toolUseID: string,
      forceDecision?: PermissionDecision,
    ): Promise<PermissionDecision> => {
      const mainPermissionResult =
        forceDecision ??
        (await hasPermissionsToUseTool(
          tool,
          input,
          toolUseContext,
          assistantMessage,
          toolUseID,
        ))
      // If the tool is allowed or denied, return the result
      if (
        mainPermissionResult.behavior === 'allow' ||
        mainPermissionResult.behavior === 'deny'
      ) {
        return mainPermissionResult
      }

      // Run PermissionRequest hooks in parallel with the SDK permission
      // prompt.  In the terminal CLI, hooks race against the interactive
      // prompt so that e.g. a hook with --delay 20 doesn't block the UI.
      // We need the same behavior here: the SDK host (VS Code, etc.) shows
      // its permission dialog immediately while hooks run in the background.
      // Whichever resolves first wins; the loser is cancelled/ignored.

      // AbortController used to cancel the SDK request if a hook decides first
      const hookAbortController = new AbortController()
      const parentSignal = toolUseContext.abortController.signal
      // Forward parent abort to our local controller
      const onParentAbort = () => hookAbortController.abort()
      parentSignal.addEventListener('abort', onParentAbort, { once: true })

      try {
        // Start the hook evaluation (runs in background)
        const hookPromise = executePermissionRequestHooksForSDK(
          tool.name,
          toolUseID,
          input,
          toolUseContext,
          mainPermissionResult.suggestions,
        ).then(decision => ({ source: 'hook' as const, decision }))

        // Start the SDK permission prompt immediately (don't wait for hooks)
        const requestId = randomUUID()
        onPermissionPrompt?.(
          buildRequiresActionDetails(tool, input, toolUseID, requestId),
        )
        const sdkPromise = this.sendRequest<PermissionToolOutput>(
          {
            subtype: 'can_use_tool',
            tool_name: tool.name,
            input,
            permission_suggestions: mainPermissionResult.suggestions,
            blocked_path: mainPermissionResult.blockedPath,
            decision_reason: serializeDecisionReason(
              mainPermissionResult.decisionReason,
            ),
            tool_use_id: toolUseID,
            agent_id: toolUseContext.agentId,
          },
          permissionToolOutputSchema(),
          hookAbortController.signal,
          requestId,
        ).then(result => ({ source: 'sdk' as const, result }))

        // Race: hook completion vs SDK prompt response.
        // The hook promise always resolves (never rejects), returning
        // undefined if no hook made a decision.
        const winner = await Promise.race([hookPromise, sdkPromise])

        if (winner.source === 'hook') {
          if (winner.decision) {
            // Hook decided — abort the pending SDK request.
            // Suppress the expected AbortError rejection from sdkPromise.
            sdkPromise.catch(() => {})
            hookAbortController.abort()
            return winner.decision
          }
          // Hook passed through (no decision) — wait for the SDK prompt
          const sdkResult = await sdkPromise
          return permissionPromptToolResultToPermissionDecision(
            sdkResult.result,
            tool,
            input,
            toolUseContext,
          )
        }

        // SDK prompt responded first — use its result (hook still running
        // in background but its result will be ignored)
        return permissionPromptToolResultToPermissionDecision(
          winner.result,
          tool,
          input,
          toolUseContext,
        )
      } catch (error) {
        return permissionPromptToolResultToPermissionDecision(
          {
            behavior: 'deny',
            message: `Tool permission request failed: ${error}`,
            toolUseID,
          },
          tool,
          input,
          toolUseContext,
        )
      } finally {
        // Only transition back to 'running' if no other permission prompts
        // are pending (concurrent tool execution can have multiple in-flight).
        if (this.getPendingPermissionRequests().length === 0) {
          notifySessionStateChanged('running')
        }
        parentSignal.removeEventListener('abort', onParentAbort)
      }
    }
  }

  createHookCallback(callbackId: string, timeout?: number): HookCallback {
    return {
      type: 'callback',
      timeout,
      callback: async (
        input: HookInput,
        toolUseID: string | null,
        abort: AbortSignal | undefined,
      ): Promise<HookJSONOutput> => {
        try {
          const result = await this.sendRequest<HookJSONOutput>(
            {
              subtype: 'hook_callback',
              callback_id: callbackId,
              input,
              tool_use_id: toolUseID || undefined,
            },
            hookJSONOutputSchema(),
            abort,
          )
          return result
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole:: intentional console output
          console.error(`Error in hook callback ${callbackId}:`, error)
          return {}
        }
      },
    }
  }

  /**
   * Sends an elicitation request to the SDK consumer and returns the response.
   */
  async handleElicitation(
    serverName: string,
    message: string,
    requestedSchema?: Record<string, unknown>,
    signal?: AbortSignal,
    mode?: 'form' | 'url',
    url?: string,
    elicitationId?: string,
  ): Promise<ElicitResult> {
    try {
      const result = await this.sendRequest<ElicitResult>(
        {
          subtype: 'elicitation',
          mcp_server_name: serverName,
          message,
          mode,
          url,
          elicitation_id: elicitationId,
          requested_schema: requestedSchema,
        },
        SDKControlElicitationResponseSchema(),
        signal,
      )
      return result
    } catch {
      return { action: 'cancel' as const }
    }
  }

  /**
   * Creates a SandboxAskCallback that forwards sandbox network permission
   * requests to the SDK host as can_use_tool control_requests.
   *
   * This piggybacks on the existing can_use_tool protocol with a synthetic
   * tool name so that SDK hosts (VS Code, CCR, etc.) can prompt the user
   * for network access without requiring a new protocol subtype.
   */
  createSandboxAskCallback(): (hostPattern: {
    host: string
    port?: number
  }) => Promise<boolean> {
    return async (hostPattern): Promise<boolean> => {
      try {
        const result = await this.sendRequest<PermissionToolOutput>(
          {
            subtype: 'can_use_tool',
            tool_name: SANDBOX_NETWORK_ACCESS_TOOL_NAME,
            input: { host: hostPattern.host },
            tool_use_id: randomUUID(),
            description: `Allow network connection to ${hostPattern.host}?`,
          },
          permissionToolOutputSchema(),
        )
        return result.behavior === 'allow'
      } catch {
        // If the request fails (stream closed, abort, etc.), deny the connection
        return false
      }
    }
  }

  /**
   * Sends an MCP message to an SDK server and waits for the response
   */
  async sendMcpMessage(
    serverName: string,
    message: JSONRPCMessage,
  ): Promise<JSONRPCMessage> {
    const response = await this.sendRequest<{ mcp_response: JSONRPCMessage }>(
      {
        subtype: 'mcp_message',
        server_name: serverName,
        message,
      },
      z.object({
        mcp_response: z.any() as z.Schema<JSONRPCMessage>,
      }),
    )
    return response.mcp_response
  }
}

function exitWithMessage(message: string): never {
  // biome-ignore lint/suspicious/noConsole:: intentional console output
  console.error(message)
  // eslint-disable-next-line custom-rules/no-process-exit
  process.exit(1)
}

/**
 * Execute PermissionRequest hooks and return a decision if one is made.
 * Returns undefined if no hook made a decision.
 */
async function executePermissionRequestHooksForSDK(
  toolName: string,
  toolUseID: string,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
  suggestions: PermissionUpdate[] | undefined,
): Promise<PermissionDecision | undefined> {
  const appState = toolUseContext.getAppState()
  const permissionMode = appState.toolPermissionContext.mode

  // Iterate directly over the generator instead of using `all`
  const hookGenerator = executePermissionRequestHooks(
    toolName,
    toolUseID,
    input,
    toolUseContext,
    permissionMode,
    suggestions,
    toolUseContext.abortController.signal,
  )

  for await (const hookResult of hookGenerator) {
    if (
      hookResult.permissionRequestResult &&
      (hookResult.permissionRequestResult.behavior === 'allow' ||
        hookResult.permissionRequestResult.behavior === 'deny')
    ) {
      const decision = hookResult.permissionRequestResult
      if (decision.behavior === 'allow') {
        const finalInput = decision.updatedInput || input

        // Apply permission updates if provided by hook ("always allow")
        const permissionUpdates = decision.updatedPermissions ?? []
        if (permissionUpdates.length > 0) {
          persistPermissionUpdates(permissionUpdates)
          const currentAppState = toolUseContext.getAppState()
          const updatedContext = applyPermissionUpdates(
            currentAppState.toolPermissionContext,
            permissionUpdates,
          )
          // Update permission context via setAppState
          toolUseContext.setAppState(prev => {
            if (prev.toolPermissionContext === updatedContext) return prev
            return { ...prev, toolPermissionContext: updatedContext }
          })
        }

        return {
          behavior: 'allow',
          updatedInput: finalInput,
          userModified: false,
          decisionReason: {
            type: 'hook',
            hookName: 'PermissionRequest',
          },
        }
      } else {
        // Hook denied the permission
        return {
          behavior: 'deny',
          message:
            decision.message || 'Permission denied by PermissionRequest hook',
          decisionReason: {
            type: 'hook',
            hookName: 'PermissionRequest',
          },
        }
      }
    }
  }

  return undefined
}
