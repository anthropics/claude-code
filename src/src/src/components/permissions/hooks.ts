import { feature } from 'bun:bundle'
import { useEffect, useRef } from 'react'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { sanitizeToolNameForAnalytics } from 'src/services/analytics/metadata.js'
import { BashTool } from 'src/tools/BashTool/BashTool.js'
import { splitCommand_DEPRECATED } from 'src/utils/bash/commands.js'
import type {
  PermissionDecisionReason,
  PermissionResult,
} from 'src/utils/permissions/PermissionResult.js'
import {
  extractRules,
  hasRules,
} from 'src/utils/permissions/PermissionUpdate.js'
import { permissionRuleValueToString } from 'src/utils/permissions/permissionRuleParser.js'
import { SandboxManager } from 'src/utils/sandbox/sandbox-adapter.js'
import type { ToolUseConfirm } from '../../components/permissions/PermissionRequest.js'
import { useSetAppState } from '../../state/AppState.js'
import { env } from '../../utils/env.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { type CompletionType, logUnaryEvent } from '../../utils/unaryLogging.js'

export type UnaryEvent = {
  completion_type: CompletionType
  language_name: string | Promise<string>
}

function permissionResultToLog(permissionResult: PermissionResult): string {
  switch (permissionResult.behavior) {
    case 'allow':
      return 'allow'
    case 'ask': {
      const rules = extractRules(permissionResult.suggestions)
      const suggestions =
        rules.length > 0
          ? rules.map(r => permissionRuleValueToString(r)).join(', ')
          : 'none'
      return `ask: ${permissionResult.message}, 
suggestions: ${suggestions}
reason: ${decisionReasonToString(permissionResult.decisionReason)}`
    }
    case 'deny':
      return `deny: ${permissionResult.message},
reason: ${decisionReasonToString(permissionResult.decisionReason)}`
    case 'passthrough': {
      const rules = extractRules(permissionResult.suggestions)
      const suggestions =
        rules.length > 0
          ? rules.map(r => permissionRuleValueToString(r)).join(', ')
          : 'none'
      return `passthrough: ${permissionResult.message},
suggestions: ${suggestions}
reason: ${decisionReasonToString(permissionResult.decisionReason)}`
    }
  }
}

function decisionReasonToString(
  decisionReason: PermissionDecisionReason | undefined,
): string {
  if (!decisionReason) {
    return 'No decision reason'
  }
  if (
    (feature('BASH_CLASSIFIER') || feature('TRANSCRIPT_CLASSIFIER')) &&
    decisionReason.type === 'classifier'
  ) {
    return `Classifier: ${decisionReason.classifier}, Reason: ${decisionReason.reason}`
  }
  switch (decisionReason.type) {
    case 'rule':
      return `Rule: ${permissionRuleValueToString(decisionReason.rule.ruleValue)}`
    case 'mode':
      return `Mode: ${decisionReason.mode}`
    case 'subcommandResults':
      return `Subcommand Results: ${Array.from(decisionReason.reasons.entries())
        .map(([key, value]) => `${key}: ${permissionResultToLog(value)}`)
        .join(', \n')}`
    case 'permissionPromptTool':
      return `Permission Tool: ${decisionReason.permissionPromptToolName}, Result: ${jsonStringify(decisionReason.toolResult)}`
    case 'hook':
      return `Hook: ${decisionReason.hookName}${decisionReason.reason ? `, Reason: ${decisionReason.reason}` : ''}`
    case 'workingDir':
      return `Working Directory: ${decisionReason.reason}`
    case 'safetyCheck':
      return `Safety check: ${decisionReason.reason}`
    case 'other':
      return `Other: ${decisionReason.reason}`
    default:
      return jsonStringify(decisionReason, null, 2)
  }
}

/**
 * Logs permission request events using analytics and unary logging.
 * Handles both the analytics event and the unary event logging.
 */
export function usePermissionRequestLogging(
  toolUseConfirm: ToolUseConfirm,
  unaryEvent: UnaryEvent,
): void {
  const setAppState = useSetAppState()
  // Guard against effect re-firing if toolUseConfirm's object reference
  // changes during a single dialog's lifetime (e.g., parent re-renders with a
  // fresh object). Without this, the unconditional setAppState below can
  // cascade into an infinite microtask loop — each re-fire does another
  // setAppState spread + (ant builds) splitCommand → shell-quote regex,
  // pegging CPU at 100% and leaking ~500MB/min in JSRopeString/RegExp allocs.
  // The component is keyed by toolUseID, so this ref resets on remount —
  // we only need to dedupe re-fires WITHIN one dialog instance.
  const loggedToolUseID = useRef<string | null>(null)

  useEffect(() => {
    if (loggedToolUseID.current === toolUseConfirm.toolUseID) {
      return
    }
    loggedToolUseID.current = toolUseConfirm.toolUseID

    // Increment permission prompt count for attribution tracking
    setAppState(prev => ({
      ...prev,
      attribution: {
        ...prev.attribution,
        permissionPromptCount: prev.attribution.permissionPromptCount + 1,
      },
    }))

    // Log analytics event
    logEvent('tengu_tool_use_show_permission_request', {
      messageID: toolUseConfirm.assistantMessage.message
        .id as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      toolName: sanitizeToolNameForAnalytics(toolUseConfirm.tool.name),
      isMcp: toolUseConfirm.tool.isMcp ?? false,
      decisionReasonType: toolUseConfirm.permissionResult.decisionReason
        ?.type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      sandboxEnabled: SandboxManager.isSandboxingEnabled(),
    })

    if (process.env.USER_TYPE === 'ant') {
      const permissionResult = toolUseConfirm.permissionResult
      if (
        toolUseConfirm.tool.name === BashTool.name &&
        permissionResult.behavior === 'ask' &&
        !hasRules(permissionResult.suggestions)
      ) {
        // Log if no rule suggestions ("always allow") are provided
        logEvent('tengu_internal_tool_use_permission_request_no_always_allow', {
          messageID: toolUseConfirm.assistantMessage.message
            .id as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          toolName: sanitizeToolNameForAnalytics(toolUseConfirm.tool.name),
          isMcp: toolUseConfirm.tool.isMcp ?? false,
          decisionReasonType: (permissionResult.decisionReason?.type ??
            'unknown') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          sandboxEnabled: SandboxManager.isSandboxingEnabled(),

          // This DOES contain code/filepaths and should not be logged in the public build!
          decisionReasonDetails: decisionReasonToString(
            permissionResult.decisionReason,
          ) as never,
        })
      }
    }

    // [ANT-ONLY] Log bash tool calls, so we can categorize
    // & burn down calls that should have been allowed
    if (process.env.USER_TYPE === 'ant') {
      const parsedInput = BashTool.inputSchema.safeParse(toolUseConfirm.input)
      if (
        toolUseConfirm.tool.name === BashTool.name &&
        toolUseConfirm.permissionResult.behavior === 'ask' &&
        parsedInput.success
      ) {
        // Note: All metadata fields in this event contain code/filepaths
        let split = [parsedInput.data.command]
        try {
          split = splitCommand_DEPRECATED(parsedInput.data.command)
        } catch {
          // Ignore parse errors here - just log the full command
        }
        logEvent('tengu_internal_bash_tool_use_permission_request', {
          parts: jsonStringify(
            split,
          ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          input: jsonStringify(
            toolUseConfirm.input,
          ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          decisionReasonType: toolUseConfirm.permissionResult.decisionReason
            ?.type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          decisionReason: decisionReasonToString(
            toolUseConfirm.permissionResult.decisionReason,
          ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
      }
    }

    void logUnaryEvent({
      completion_type: unaryEvent.completion_type,
      event: 'response',
      metadata: {
        language_name: unaryEvent.language_name,
        message_id: toolUseConfirm.assistantMessage.message.id,
        platform: env.platform,
      },
    })
  }, [toolUseConfirm, unaryEvent, setAppState])
}
