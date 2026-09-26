import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  ElicitationCompleteNotificationSchema,
  type ElicitRequestParams,
  ElicitRequestSchema,
  type ElicitResult,
} from '@modelcontextprotocol/sdk/types.js'
import type { AppState } from '../../state/AppState.js'
import {
  executeElicitationHooks,
  executeElicitationResultHooks,
  executeNotificationHooks,
} from '../../utils/hooks.js'
import { logMCPDebug, logMCPError } from '../../utils/log.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../analytics/index.js'

/** Configuration for the waiting state shown after the user opens a URL. */
export type ElicitationWaitingState = {
  /** Button label, e.g. "Retry now" or "Skip confirmation" */
  actionLabel: string
  /** Whether to show a visible Cancel button (e.g. for error-based retry flow) */
  showCancel?: boolean
}

export type ElicitationRequestEvent = {
  serverName: string
  /** The JSON-RPC request ID, unique per server connection. */
  requestId: string | number
  params: ElicitRequestParams
  signal: AbortSignal
  /**
   * Resolves the elicitation. For explicit elicitations, all actions are
   * meaningful. For error-based retry (-32042), 'accept' is a no-op —
   * the retry is driven by onWaitingDismiss instead.
   */
  respond: (response: ElicitResult) => void
  /** For URL elicitations: shown after user opens the browser. */
  waitingState?: ElicitationWaitingState
  /** Called when phase 2 (waiting) is dismissed by user action or completion. */
  onWaitingDismiss?: (action: 'dismiss' | 'retry' | 'cancel') => void
  /** Set to true by the completion notification handler when the server confirms completion. */
  completed?: boolean
}

function getElicitationMode(params: ElicitRequestParams): 'form' | 'url' {
  return params.mode === 'url' ? 'url' : 'form'
}

/** Find a queued elicitation event by server name and elicitationId. */
function findElicitationInQueue(
  queue: ElicitationRequestEvent[],
  serverName: string,
  elicitationId: string,
): number {
  return queue.findIndex(
    e =>
      e.serverName === serverName &&
      e.params.mode === 'url' &&
      'elicitationId' in e.params &&
      e.params.elicitationId === elicitationId,
  )
}

export function registerElicitationHandler(
  client: Client,
  serverName: string,
  setAppState: (f: (prevState: AppState) => AppState) => void,
): void {
  // Register the elicitation request handler.
  // Wrapped in try/catch because setRequestHandler throws if the client wasn't
  // created with elicitation capability declared.
  try {
    client.setRequestHandler(ElicitRequestSchema, async (request, extra) => {
      logMCPDebug(
        serverName,
        `Received elicitation request: ${jsonStringify(request)}`,
      )

      const mode = getElicitationMode(request.params)

      logEvent('tengu_mcp_elicitation_shown', {
        mode: mode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })

      try {
        // Run elicitation hooks first - they can provide a response programmatically
        const hookResponse = await runElicitationHooks(
          serverName,
          request.params,
          extra.signal,
        )
        if (hookResponse) {
          logMCPDebug(
            serverName,
            `Elicitation resolved by hook: ${jsonStringify(hookResponse)}`,
          )
          logEvent('tengu_mcp_elicitation_response', {
            mode: mode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            action:
              hookResponse.action as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          })
          return hookResponse
        }

        const elicitationId =
          mode === 'url' && 'elicitationId' in request.params
            ? (request.params.elicitationId as string | undefined)
            : undefined

        const response = new Promise<ElicitResult>(resolve => {
          const onAbort = () => {
            resolve({ action: 'cancel' })
          }

          if (extra.signal.aborted) {
            onAbort()
            return
          }

          const waitingState: ElicitationWaitingState | undefined =
            elicitationId ? { actionLabel: 'Skip confirmation' } : undefined

          setAppState(prev => ({
            ...prev,
            elicitation: {
              queue: [
                ...prev.elicitation.queue,
                {
                  serverName,
                  requestId: extra.requestId,
                  params: request.params,
                  signal: extra.signal,
                  waitingState,
                  respond: (result: ElicitResult) => {
                    extra.signal.removeEventListener('abort', onAbort)
                    logEvent('tengu_mcp_elicitation_response', {
                      mode: mode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                      action:
                        result.action as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                    })
                    resolve(result)
                  },
                },
              ],
            },
          }))

          extra.signal.addEventListener('abort', onAbort, { once: true })
        })
        const rawResult = await response
        logMCPDebug(
          serverName,
          `Elicitation response: ${jsonStringify(rawResult)}`,
        )
        const result = await runElicitationResultHooks(
          serverName,
          rawResult,
          extra.signal,
          mode,
          elicitationId,
        )
        return result
      } catch (error) {
        logMCPError(serverName, `Elicitation error: ${error}`)
        return { action: 'cancel' as const }
      }
    })

    // Register handler for elicitation completion notifications (URL mode).
    // Sets `completed: true` on the matching queue event; the dialog reacts to this flag.
    client.setNotificationHandler(
      ElicitationCompleteNotificationSchema,
      notification => {
        const { elicitationId } = notification.params
        logMCPDebug(
          serverName,
          `Received elicitation completion notification: ${elicitationId}`,
        )
        void executeNotificationHooks({
          message: `MCP server "${serverName}" confirmed elicitation ${elicitationId} complete`,
          notificationType: 'elicitation_complete',
        })
        let found = false
        setAppState(prev => {
          const idx = findElicitationInQueue(
            prev.elicitation.queue,
            serverName,
            elicitationId,
          )
          if (idx === -1) return prev
          found = true
          const queue = [...prev.elicitation.queue]
          queue[idx] = { ...queue[idx]!, completed: true }
          return { ...prev, elicitation: { queue } }
        })
        if (!found) {
          logMCPDebug(
            serverName,
            `Ignoring completion notification for unknown elicitation: ${elicitationId}`,
          )
        }
      },
    )
  } catch {
    // Client wasn't created with elicitation capability - nothing to register
    return
  }
}

export async function runElicitationHooks(
  serverName: string,
  params: ElicitRequestParams,
  signal: AbortSignal,
): Promise<ElicitResult | undefined> {
  try {
    const mode = params.mode === 'url' ? 'url' : 'form'
    const url = 'url' in params ? (params.url as string) : undefined
    const elicitationId =
      'elicitationId' in params
        ? (params.elicitationId as string | undefined)
        : undefined

    const { elicitationResponse, blockingError } =
      await executeElicitationHooks({
        serverName,
        message: params.message,
        requestedSchema:
          'requestedSchema' in params
            ? (params.requestedSchema as Record<string, unknown>)
            : undefined,
        signal,
        mode,
        url,
        elicitationId,
      })

    if (blockingError) {
      return { action: 'decline' }
    }

    if (elicitationResponse) {
      return {
        action: elicitationResponse.action,
        content: elicitationResponse.content,
      }
    }

    return undefined
  } catch (error) {
    logMCPError(serverName, `Elicitation hook error: ${error}`)
    return undefined
  }
}

/**
 * Run ElicitationResult hooks after the user has responded, then fire a
 * `elicitation_response` notification. Returns a (potentially modified)
 * ElicitResult — hooks may override the action/content or block the response.
 */
export async function runElicitationResultHooks(
  serverName: string,
  result: ElicitResult,
  signal: AbortSignal,
  mode?: 'form' | 'url',
  elicitationId?: string,
): Promise<ElicitResult> {
  try {
    const { elicitationResultResponse, blockingError } =
      await executeElicitationResultHooks({
        serverName,
        action: result.action,
        content: result.content as Record<string, unknown> | undefined,
        signal,
        mode,
        elicitationId,
      })

    if (blockingError) {
      void executeNotificationHooks({
        message: `Elicitation response for server "${serverName}": decline`,
        notificationType: 'elicitation_response',
      })
      return { action: 'decline' }
    }

    const finalResult = elicitationResultResponse
      ? {
          action: elicitationResultResponse.action,
          content: elicitationResultResponse.content ?? result.content,
        }
      : result

    // Fire a notification for observability
    void executeNotificationHooks({
      message: `Elicitation response for server "${serverName}": ${finalResult.action}`,
      notificationType: 'elicitation_response',
    })

    return finalResult
  } catch (error) {
    logMCPError(serverName, `ElicitationResult hook error: ${error}`)
    // Fire notification even on error
    void executeNotificationHooks({
      message: `Elicitation response for server "${serverName}": ${result.action}`,
      notificationType: 'elicitation_response',
    })
    return result
  }
}
