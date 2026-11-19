import { feature } from 'bun:bundle'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import { randomUUID } from 'crypto'
import { logForDebugging } from 'src/utils/debug.js'
import { getAllowedChannels } from '../../../bootstrap/state.js'
import type { BridgePermissionCallbacks } from '../../../bridge/bridgePermissionCallbacks.js'
import { getTerminalFocused } from '../../../ink/terminal-focus-state.js'
import {
  CHANNEL_PERMISSION_REQUEST_METHOD,
  type ChannelPermissionRequestParams,
  findChannelEntry,
} from '../../../services/mcp/channelNotification.js'
import type { ChannelPermissionCallbacks } from '../../../services/mcp/channelPermissions.js'
import {
  filterPermissionRelayClients,
  shortRequestId,
  truncateForPreview,
} from '../../../services/mcp/channelPermissions.js'
import { executeAsyncClassifierCheck } from '../../../tools/BashTool/bashPermissions.js'
import { BASH_TOOL_NAME } from '../../../tools/BashTool/toolName.js'
import {
  clearClassifierChecking,
  setClassifierApproval,
  setClassifierChecking,
  setYoloClassifierApproval,
} from '../../../utils/classifierApprovals.js'
import { errorMessage } from '../../../utils/errors.js'
import type { PermissionDecision } from '../../../utils/permissions/PermissionResult.js'
import type { PermissionUpdate } from '../../../utils/permissions/PermissionUpdateSchema.js'
import { hasPermissionsToUseTool } from '../../../utils/permissions/permissions.js'
import type { PermissionContext } from '../PermissionContext.js'
import { createResolveOnce } from '../PermissionContext.js'

type InteractivePermissionParams = {
  ctx: PermissionContext
  description: string
  result: PermissionDecision & { behavior: 'ask' }
  awaitAutomatedChecksBeforeDialog: boolean | undefined
  bridgeCallbacks?: BridgePermissionCallbacks
  channelCallbacks?: ChannelPermissionCallbacks
}

/**
 * Handles the interactive (main-agent) permission flow.
 *
 * Pushes a ToolUseConfirm entry to the confirm queue with callbacks:
 * onAbort, onAllow, onReject, recheckPermission, onUserInteraction.
 *
 * Runs permission hooks and bash classifier checks asynchronously in the
 * background, racing them against user interaction. Uses a resolve-once
 * guard and `userInteracted` flag to prevent multiple resolutions.
 *
 * This function does NOT return a Promise -- it sets up callbacks that
 * eventually call `resolve()` to resolve the outer promise owned by
 * the caller.
 */
function handleInteractivePermission(
  params: InteractivePermissionParams,
  resolve: (decision: PermissionDecision) => void,
): void {
  const {
    ctx,
    description,
    result,
    awaitAutomatedChecksBeforeDialog,
    bridgeCallbacks,
    channelCallbacks,
  } = params

  const { resolve: resolveOnce, isResolved, claim } = createResolveOnce(resolve)
  let userInteracted = false
  let checkmarkTransitionTimer: ReturnType<typeof setTimeout> | undefined
  // Hoisted so onDismissCheckmark (Esc during checkmark window) can also
  // remove the abort listener — not just the timer callback.
  let checkmarkAbortHandler: (() => void) | undefined
  const bridgeRequestId = bridgeCallbacks ? randomUUID() : undefined
  // Hoisted so local/hook/classifier wins can remove the pending channel
  // entry. No "tell remote to dismiss" equivalent — the text sits in your
  // phone, and a stale "yes abc123" after local-resolve falls through
  // tryConsumeReply (entry gone) and gets enqueued as normal chat.
  let channelUnsubscribe: (() => void) | undefined

  const permissionPromptStartTimeMs = Date.now()
  const displayInput = result.updatedInput ?? ctx.input

  function clearClassifierIndicator(): void {
    if (feature('BASH_CLASSIFIER')) {
      ctx.updateQueueItem({ classifierCheckInProgress: false })
    }
  }

  ctx.pushToQueue({
    assistantMessage: ctx.assistantMessage,
    tool: ctx.tool,
    description,
    input: displayInput,
    toolUseContext: ctx.toolUseContext,
    toolUseID: ctx.toolUseID,
    permissionResult: result,
    permissionPromptStartTimeMs,
    ...(feature('BASH_CLASSIFIER')
      ? {
          classifierCheckInProgress:
            !!result.pendingClassifierCheck &&
            !awaitAutomatedChecksBeforeDialog,
        }
      : {}),
    onUserInteraction() {
      // Called when user starts interacting with the permission dialog
      // (e.g., arrow keys, tab, typing feedback)
      // Hide the classifier indicator since auto-approve is no longer possible
      //
      // Grace period: ignore interactions in the first 200ms to prevent
      // accidental keypresses from canceling the classifier prematurely
      const GRACE_PERIOD_MS = 200
      if (Date.now() - permissionPromptStartTimeMs < GRACE_PERIOD_MS) {
        return
      }
      userInteracted = true
      clearClassifierChecking(ctx.toolUseID)
      clearClassifierIndicator()
    },
    onDismissCheckmark() {
      if (checkmarkTransitionTimer) {
        clearTimeout(checkmarkTransitionTimer)
        checkmarkTransitionTimer = undefined
        if (checkmarkAbortHandler) {
          ctx.toolUseContext.abortController.signal.removeEventListener(
            'abort',
            checkmarkAbortHandler,
          )
          checkmarkAbortHandler = undefined
        }
        ctx.removeFromQueue()
      }
    },
    onAbort() {
      if (!claim()) return
      if (bridgeCallbacks && bridgeRequestId) {
        bridgeCallbacks.sendResponse(bridgeRequestId, {
          behavior: 'deny',
          message: 'User aborted',
        })
        bridgeCallbacks.cancelRequest(bridgeRequestId)
      }
      channelUnsubscribe?.()
      ctx.logCancelled()
      ctx.logDecision(
        { decision: 'reject', source: { type: 'user_abort' } },
        { permissionPromptStartTimeMs },
      )
      resolveOnce(ctx.cancelAndAbort(undefined, true))
    },
    async onAllow(
      updatedInput,
      permissionUpdates: PermissionUpdate[],
      feedback?: string,
      contentBlocks?: ContentBlockParam[],
    ) {
      if (!claim()) return // atomic check-and-mark before await

      if (bridgeCallbacks && bridgeRequestId) {
        bridgeCallbacks.sendResponse(bridgeRequestId, {
          behavior: 'allow',
          updatedInput,
          updatedPermissions: permissionUpdates,
        })
        bridgeCallbacks.cancelRequest(bridgeRequestId)
      }
      channelUnsubscribe?.()

      resolveOnce(
        await ctx.handleUserAllow(
          updatedInput,
          permissionUpdates,
          feedback,
          permissionPromptStartTimeMs,
          contentBlocks,
          result.decisionReason,
        ),
      )
    },
    onReject(feedback?: string, contentBlocks?: ContentBlockParam[]) {
      if (!claim()) return

      if (bridgeCallbacks && bridgeRequestId) {
        bridgeCallbacks.sendResponse(bridgeRequestId, {
          behavior: 'deny',
          message: feedback ?? 'User denied permission',
        })
        bridgeCallbacks.cancelRequest(bridgeRequestId)
      }
      channelUnsubscribe?.()

      ctx.logDecision(
        {
          decision: 'reject',
          source: { type: 'user_reject', hasFeedback: !!feedback },
        },
        { permissionPromptStartTimeMs },
      )
      resolveOnce(ctx.cancelAndAbort(feedback, undefined, contentBlocks))
    },
    async recheckPermission() {
      if (isResolved()) return
      const freshResult = await hasPermissionsToUseTool(
        ctx.tool,
        ctx.input,
        ctx.toolUseContext,
        ctx.assistantMessage,
        ctx.toolUseID,
      )
      if (freshResult.behavior === 'allow') {
        // claim() (atomic check-and-mark), not isResolved() — the async
        // hasPermissionsToUseTool call above opens a window where CCR
        // could have responded in flight. Matches onAllow/onReject/hook
        // paths. cancelRequest tells CCR to dismiss its prompt — without
        // it, the web UI shows a stale prompt for a tool that's already
        // executing (particularly visible when recheck is triggered by
        // a CCR-initiated mode switch, the very case this callback exists
        // for after useReplBridge started calling it).
        if (!claim()) return
        if (bridgeCallbacks && bridgeRequestId) {
          bridgeCallbacks.cancelRequest(bridgeRequestId)
        }
        channelUnsubscribe?.()
        ctx.removeFromQueue()
        ctx.logDecision({ decision: 'accept', source: 'config' })
        resolveOnce(ctx.buildAllow(freshResult.updatedInput ?? ctx.input))
      }
    },
  })

  // Race 4: Bridge permission response from CCR (claude.ai)
  // When the bridge is connected, send the permission request to CCR and
  // subscribe for a response. Whichever side (CLI or CCR) responds first
  // wins via claim().
  //
  // All tools are forwarded — CCR's generic allow/deny modal handles any
  // tool, and can return `updatedInput` when it has a dedicated renderer
  // (e.g. plan edit). Tools whose local dialog injects fields (ReviewArtifact
  // `selected`, AskUserQuestion `answers`) tolerate the field being missing
  // so generic remote approval degrades gracefully instead of throwing.
  if (bridgeCallbacks && bridgeRequestId) {
    bridgeCallbacks.sendRequest(
      bridgeRequestId,
      ctx.tool.name,
      displayInput,
      ctx.toolUseID,
      description,
      result.suggestions,
      result.blockedPath,
    )

    const signal = ctx.toolUseContext.abortController.signal
    const unsubscribe = bridgeCallbacks.onResponse(
      bridgeRequestId,
      response => {
        if (!claim()) return // Local user/hook/classifier already responded
        signal.removeEventListener('abort', unsubscribe)
        clearClassifierChecking(ctx.toolUseID)
        clearClassifierIndicator()
        ctx.removeFromQueue()
        channelUnsubscribe?.()

        if (response.behavior === 'allow') {
          if (response.updatedPermissions?.length) {
            void ctx.persistPermissions(response.updatedPermissions)
          }
          ctx.logDecision(
            {
              decision: 'accept',
              source: {
                type: 'user',
                permanent: !!response.updatedPermissions?.length,
              },
            },
            { permissionPromptStartTimeMs },
          )
          resolveOnce(ctx.buildAllow(response.updatedInput ?? displayInput))
        } else {
          ctx.logDecision(
            {
              decision: 'reject',
              source: {
                type: 'user_reject',
                hasFeedback: !!response.message,
              },
            },
            { permissionPromptStartTimeMs },
          )
          resolveOnce(ctx.cancelAndAbort(response.message))
        }
      },
    )

    signal.addEventListener('abort', unsubscribe, { once: true })
  }

  // Channel permission relay — races alongside the bridge block above. Send a
  // permission prompt to every active channel (Telegram, iMessage, etc.) via
  // its MCP send_message tool, then race the reply against local/bridge/hook/
  // classifier. The inbound "yes abc123" is intercepted in the notification
  // handler (useManageMCPConnections.ts) BEFORE enqueue, so it never reaches
  // Claude as a conversation turn.
  //
  // Unlike the bridge block, this still guards on `requiresUserInteraction` —
  // channel replies are pure yes/no with no `updatedInput` path. In practice
  // the guard is dead code today: all three `requiresUserInteraction` tools
  // (ExitPlanMode, AskUserQuestion, ReviewArtifact) return `isEnabled()===false`
  // when channels are configured, so they never reach this handler.
  //
  // Fire-and-forget send: if callTool fails (channel down, tool missing),
  // the subscription never fires and another racer wins. Graceful degradation
  // — the local dialog is always there as the floor.
  if (
    (feature('KAIROS') || feature('KAIROS_CHANNELS')) &&
    channelCallbacks &&
    !ctx.tool.requiresUserInteraction?.()
  ) {
    const channelRequestId = shortRequestId(ctx.toolUseID)
    const allowedChannels = getAllowedChannels()
    const channelClients = filterPermissionRelayClients(
      ctx.toolUseContext.getAppState().mcp.clients,
      name => findChannelEntry(name, allowedChannels) !== undefined,
    )

    if (channelClients.length > 0) {
      // Outbound is structured too (Kenneth's symmetry ask) — server owns
      // message formatting for its platform (Telegram markdown, iMessage
      // rich text, Discord embed). CC sends the RAW parts; server composes.
      // The old callTool('send_message', {text,content,message}) triple-key
      // hack is gone — no more guessing which arg name each plugin takes.
      const params: ChannelPermissionRequestParams = {
        request_id: channelRequestId,
        tool_name: ctx.tool.name,
        description,
        input_preview: truncateForPreview(displayInput),
      }

      for (const client of channelClients) {
        if (client.type !== 'connected') continue // refine for TS
        void client.client
          .notification({
            method: CHANNEL_PERMISSION_REQUEST_METHOD,
            params,
          })
          .catch(e => {
            logForDebugging(
              `Channel permission_request failed for ${client.name}: ${errorMessage(e)}`,
              { level: 'error' },
            )
          })
      }

      const channelSignal = ctx.toolUseContext.abortController.signal
      // Wrap so BOTH the map delete AND the abort-listener teardown happen
      // at every call site. The 6 channelUnsubscribe?.() sites after local/
      // hook/classifier wins previously only deleted the map entry — the
      // dead closure stayed registered on the session-scoped abort signal
      // until the session ended. Not a functional bug (Map.delete is
      // idempotent), but it held the closure alive.
      const mapUnsub = channelCallbacks.onResponse(
        channelRequestId,
        response => {
          if (!claim()) return // Another racer won
          channelUnsubscribe?.() // both: map delete + listener remove
          clearClassifierChecking(ctx.toolUseID)
          clearClassifierIndicator()
          ctx.removeFromQueue()
          // Bridge is the other remote — tell it we're done.
          if (bridgeCallbacks && bridgeRequestId) {
            bridgeCallbacks.cancelRequest(bridgeRequestId)
          }

          if (response.behavior === 'allow') {
            ctx.logDecision(
              {
                decision: 'accept',
                source: { type: 'user', permanent: false },
              },
              { permissionPromptStartTimeMs },
            )
            resolveOnce(ctx.buildAllow(displayInput))
          } else {
            ctx.logDecision(
              {
                decision: 'reject',
                source: { type: 'user_reject', hasFeedback: false },
              },
              { permissionPromptStartTimeMs },
            )
            resolveOnce(
              ctx.cancelAndAbort(`Denied via channel ${response.fromServer}`),
            )
          }
        },
      )
      channelUnsubscribe = () => {
        mapUnsub()
        channelSignal.removeEventListener('abort', channelUnsubscribe!)
      }

      channelSignal.addEventListener('abort', channelUnsubscribe, {
        once: true,
      })
    }
  }

  // Skip hooks if they were already awaited in the coordinator branch above
  if (!awaitAutomatedChecksBeforeDialog) {
    // Execute PermissionRequest hooks asynchronously
    // If hook returns a decision before user responds, apply it
    void (async () => {
      if (isResolved()) return
      const currentAppState = ctx.toolUseContext.getAppState()
      const hookDecision = await ctx.runHooks(
        currentAppState.toolPermissionContext.mode,
        result.suggestions,
        result.updatedInput,
        permissionPromptStartTimeMs,
      )
      if (!hookDecision || !claim()) return
      if (bridgeCallbacks && bridgeRequestId) {
        bridgeCallbacks.cancelRequest(bridgeRequestId)
      }
      channelUnsubscribe?.()
      ctx.removeFromQueue()
      resolveOnce(hookDecision)
    })()
  }

  // Execute bash classifier check asynchronously (if applicable)
  if (
    feature('BASH_CLASSIFIER') &&
    result.pendingClassifierCheck &&
    ctx.tool.name === BASH_TOOL_NAME &&
    !awaitAutomatedChecksBeforeDialog
  ) {
    // UI indicator for "classifier running" — set here (not in
    // toolExecution.ts) so commands that auto-allow via prefix rules
    // don't flash the indicator for a split second before allow returns.
    setClassifierChecking(ctx.toolUseID)
    void executeAsyncClassifierCheck(
      result.pendingClassifierCheck,
      ctx.toolUseContext.abortController.signal,
      ctx.toolUseContext.options.isNonInteractiveSession,
      {
        shouldContinue: () => !isResolved() && !userInteracted,
        onComplete: () => {
          clearClassifierChecking(ctx.toolUseID)
          clearClassifierIndicator()
        },
        onAllow: decisionReason => {
          if (!claim()) return
          if (bridgeCallbacks && bridgeRequestId) {
            bridgeCallbacks.cancelRequest(bridgeRequestId)
          }
          channelUnsubscribe?.()
          clearClassifierChecking(ctx.toolUseID)

          const matchedRule =
            decisionReason.type === 'classifier'
              ? (decisionReason.reason.match(
                  /^Allowed by prompt rule: "(.+)"$/,
                )?.[1] ?? decisionReason.reason)
              : undefined

          // Show auto-approved transition with dimmed options
          if (feature('TRANSCRIPT_CLASSIFIER')) {
            ctx.updateQueueItem({
              classifierCheckInProgress: false,
              classifierAutoApproved: true,
              classifierMatchedRule: matchedRule,
            })
          }

          if (
            feature('TRANSCRIPT_CLASSIFIER') &&
            decisionReason.type === 'classifier'
          ) {
            if (decisionReason.classifier === 'auto-mode') {
              setYoloClassifierApproval(ctx.toolUseID, decisionReason.reason)
            } else if (matchedRule) {
              setClassifierApproval(ctx.toolUseID, matchedRule)
            }
          }

          ctx.logDecision(
            { decision: 'accept', source: { type: 'classifier' } },
            { permissionPromptStartTimeMs },
          )
          resolveOnce(ctx.buildAllow(ctx.input, { decisionReason }))

          // Keep checkmark visible, then remove dialog.
          // 3s if terminal is focused (user can see it), 1s if not.
          // User can dismiss early with Esc via onDismissCheckmark.
          const signal = ctx.toolUseContext.abortController.signal
          checkmarkAbortHandler = () => {
            if (checkmarkTransitionTimer) {
              clearTimeout(checkmarkTransitionTimer)
              checkmarkTransitionTimer = undefined
              // Sibling Bash error can fire this (StreamingToolExecutor
              // cascades via siblingAbortController) — must drop the
              // cosmetic ✓ dialog or it blocks the next queued item.
              ctx.removeFromQueue()
            }
          }
          const checkmarkMs = getTerminalFocused() ? 3000 : 1000
          checkmarkTransitionTimer = setTimeout(() => {
            checkmarkTransitionTimer = undefined
            if (checkmarkAbortHandler) {
              signal.removeEventListener('abort', checkmarkAbortHandler)
              checkmarkAbortHandler = undefined
            }
            ctx.removeFromQueue()
          }, checkmarkMs)
          signal.addEventListener('abort', checkmarkAbortHandler, {
            once: true,
          })
        },
      },
    ).catch(error => {
      // Log classifier API errors for debugging but don't propagate them as interruptions
      // These errors can be network failures, rate limits, or model issues - not user cancellations
      logForDebugging(`Async classifier check failed: ${errorMessage(error)}`, {
        level: 'error',
      })
    })
  }
}

// --

export { handleInteractivePermission }
export type { InteractivePermissionParams }
