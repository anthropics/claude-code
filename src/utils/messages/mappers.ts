import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import { randomUUID, type UUID } from 'crypto'
import { getSessionId } from 'src/bootstrap/state.js'
import {
  LOCAL_COMMAND_STDERR_TAG,
  LOCAL_COMMAND_STDOUT_TAG,
} from 'src/constants/xml.js'
import type {
  SDKAssistantMessage,
  SDKCompactBoundaryMessage,
  SDKMessage,
  SDKRateLimitInfo,
} from 'src/entrypoints/agentSdkTypes.js'
import type { ClaudeAILimits } from 'src/services/claudeAiLimits.js'
import { EXIT_PLAN_MODE_V2_TOOL_NAME } from 'src/tools/ExitPlanModeTool/constants.js'
import type {
  AssistantMessage,
  CompactMetadata,
  Message,
} from 'src/types/message.js'
import type { DeepImmutable } from 'src/types/utils.js'
import stripAnsi from 'strip-ansi'
import { createAssistantMessage } from '../messages.js'
import { getPlan } from '../plans.js'

export function toInternalMessages(
  messages: readonly DeepImmutable<SDKMessage>[],
): Message[] {
  return messages.flatMap(message => {
    switch (message.type) {
      case 'assistant':
        return [
          {
            type: 'assistant',
            message: message.message,
            uuid: message.uuid,
            requestId: undefined,
            timestamp: new Date().toISOString(),
          } as Message,
        ]
      case 'user':
        return [
          {
            type: 'user',
            message: message.message,
            uuid: message.uuid ?? randomUUID(),
            timestamp: message.timestamp ?? new Date().toISOString(),
            isMeta: message.isSynthetic,
          } as Message,
        ]
      case 'system':
        // Handle compact boundary messages
        if (message.subtype === 'compact_boundary') {
          const compactMsg = message
          return [
            {
              type: 'system',
              content: 'Conversation compacted',
              level: 'info',
              subtype: 'compact_boundary',
              compactMetadata: fromSDKCompactMetadata(
                compactMsg.compact_metadata,
              ),
              uuid: message.uuid,
              timestamp: new Date().toISOString(),
            },
          ]
        }
        return []
      default:
        return []
    }
  })
}

type SDKCompactMetadata = SDKCompactBoundaryMessage['compact_metadata']

export function toSDKCompactMetadata(
  meta: CompactMetadata,
): SDKCompactMetadata {
  const seg = meta.preservedSegment
  return {
    trigger: meta.trigger,
    pre_tokens: meta.preTokens,
    ...(seg && {
      preserved_segment: {
        head_uuid: seg.headUuid,
        anchor_uuid: seg.anchorUuid,
        tail_uuid: seg.tailUuid,
      },
    }),
  }
}

/**
 * Shared SDK→internal compact_metadata converter.
 */
export function fromSDKCompactMetadata(
  meta: SDKCompactMetadata,
): CompactMetadata {
  const seg = meta.preserved_segment
  return {
    trigger: meta.trigger,
    preTokens: meta.pre_tokens,
    ...(seg && {
      preservedSegment: {
        headUuid: seg.head_uuid,
        anchorUuid: seg.anchor_uuid,
        tailUuid: seg.tail_uuid,
      },
    }),
  }
}

export function toSDKMessages(messages: Message[]): SDKMessage[] {
  return messages.flatMap((message): SDKMessage[] => {
    switch (message.type) {
      case 'assistant':
        return [
          {
            type: 'assistant',
            message: normalizeAssistantMessageForSDK(message),
            session_id: getSessionId(),
            parent_tool_use_id: null,
            uuid: message.uuid,
            error: message.error,
          },
        ]
      case 'user':
        return [
          {
            type: 'user',
            message: message.message,
            session_id: getSessionId(),
            parent_tool_use_id: null,
            uuid: message.uuid,
            timestamp: message.timestamp,
            isSynthetic: message.isMeta || message.isVisibleInTranscriptOnly,
            // Structured tool output (not the string content sent to the
            // model — the full Output object). Rides the protobuf catchall
            // so web viewers can read things like BriefTool's file_uuid
            // without it polluting model context.
            ...(message.toolUseResult !== undefined
              ? { tool_use_result: message.toolUseResult }
              : {}),
          },
        ]
      case 'system':
        if (message.subtype === 'compact_boundary' && message.compactMetadata) {
          return [
            {
              type: 'system',
              subtype: 'compact_boundary' as const,
              session_id: getSessionId(),
              uuid: message.uuid,
              compact_metadata: toSDKCompactMetadata(message.compactMetadata),
            },
          ]
        }
        // Only convert local_command messages that contain actual command
        // output (stdout/stderr). The same subtype is also used for command
        // input metadata (e.g. <command-name>...</command-name>) which must
        // not leak to the RC web UI.
        if (
          message.subtype === 'local_command' &&
          (message.content.includes(`<${LOCAL_COMMAND_STDOUT_TAG}>`) ||
            message.content.includes(`<${LOCAL_COMMAND_STDERR_TAG}>`))
        ) {
          return [
            localCommandOutputToSDKAssistantMessage(
              message.content,
              message.uuid,
            ),
          ]
        }
        return []
      default:
        return []
    }
  })
}

/**
 * Converts local command output (e.g. /voice, /cost) to a well-formed
 * SDKAssistantMessage so downstream consumers (mobile apps, session-ingress
 * v1alpha→v1beta converter) can parse it without schema changes.
 *
 * Emitted as assistant instead of the dedicated SDKLocalCommandOutputMessage
 * because the system/local_command_output subtype is unknown to:
 *   - mobile-apps Android SdkMessageTypes.kt (no local_command_output handler)
 *   - api-go session-ingress convertSystemEvent (only init/compact_boundary)
 * See: https://anthropic.sentry.io/issues/7266299248/ (Android)
 *
 * Strips ANSI (e.g. chalk.dim() in /cost) then unwraps the XML wrapper tags.
 */
export function localCommandOutputToSDKAssistantMessage(
  rawContent: string,
  uuid: UUID,
): SDKAssistantMessage {
  const cleanContent = stripAnsi(rawContent)
    .replace(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/, '$1')
    .replace(/<local-command-stderr>([\s\S]*?)<\/local-command-stderr>/, '$1')
    .trim()
  // createAssistantMessage builds a complete APIAssistantMessage with id, type,
  // model: SYNTHETIC_MODEL, role, stop_reason, usage — all fields required by
  // downstream deserializers like Android's SdkAssistantMessage.
  const synthetic = createAssistantMessage({ content: cleanContent })
  return {
    type: 'assistant',
    message: synthetic.message,
    parent_tool_use_id: null,
    session_id: getSessionId(),
    uuid,
  }
}

/**
 * Maps internal ClaudeAILimits to the SDK-facing SDKRateLimitInfo type,
 * stripping internal-only fields like unifiedRateLimitFallbackAvailable.
 */
export function toSDKRateLimitInfo(
  limits: ClaudeAILimits | undefined,
): SDKRateLimitInfo | undefined {
  if (!limits) {
    return undefined
  }
  return {
    status: limits.status,
    ...(limits.resetsAt !== undefined && { resetsAt: limits.resetsAt }),
    ...(limits.rateLimitType !== undefined && {
      rateLimitType: limits.rateLimitType,
    }),
    ...(limits.utilization !== undefined && {
      utilization: limits.utilization,
    }),
    ...(limits.overageStatus !== undefined && {
      overageStatus: limits.overageStatus,
    }),
    ...(limits.overageResetsAt !== undefined && {
      overageResetsAt: limits.overageResetsAt,
    }),
    ...(limits.overageDisabledReason !== undefined && {
      overageDisabledReason: limits.overageDisabledReason,
    }),
    ...(limits.isUsingOverage !== undefined && {
      isUsingOverage: limits.isUsingOverage,
    }),
    ...(limits.surpassedThreshold !== undefined && {
      surpassedThreshold: limits.surpassedThreshold,
    }),
  }
}

/**
 * Normalizes tool inputs in assistant message content for SDK consumption.
 * Specifically injects plan content into ExitPlanModeV2 tool inputs since
 * the V2 tool reads plan from file instead of input, but SDK users expect
 * tool_input.plan to exist.
 */
function normalizeAssistantMessageForSDK(
  message: AssistantMessage,
): AssistantMessage['message'] {
  const content = message.message.content
  if (!Array.isArray(content)) {
    return message.message
  }

  const normalizedContent = content.map((block): BetaContentBlock => {
    if (block.type !== 'tool_use') {
      return block
    }

    if (block.name === EXIT_PLAN_MODE_V2_TOOL_NAME) {
      const plan = getPlan()
      if (plan) {
        return {
          ...block,
          input: { ...(block.input as Record<string, unknown>), plan },
        }
      }
    }

    return block
  })

  return {
    ...message.message,
    content: normalizedContent,
  }
}
