import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { ImageBlockParam, TextBlockParam, ThinkingBlockParam, ToolResultBlockParam, ToolUseBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import * as React from 'react';
import type { Command } from '../commands.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { Box } from '../ink.js';
import type { Tools } from '../Tool.js';
import { type ConnectorTextBlock, isConnectorTextBlock } from '../types/connectorText.js';
import type { AssistantMessage, AttachmentMessage as AttachmentMessageType, CollapsedReadSearchGroup as CollapsedReadSearchGroupType, GroupedToolUseMessage as GroupedToolUseMessageType, NormalizedUserMessage, ProgressMessage, SystemMessage } from '../types/message.js';
import { type AdvisorBlock, isAdvisorBlock } from '../utils/advisor.js';
import { isFullscreenEnvEnabled } from '../utils/fullscreen.js';
import { logError } from '../utils/log.js';
import type { buildMessageLookups } from '../utils/messages.js';
import { CompactSummary } from './CompactSummary.js';
import { AdvisorMessage } from './messages/AdvisorMessage.js';
import { AssistantRedactedThinkingMessage } from './messages/AssistantRedactedThinkingMessage.js';
import { AssistantTextMessage } from './messages/AssistantTextMessage.js';
import { AssistantThinkingMessage } from './messages/AssistantThinkingMessage.js';
import { AssistantToolUseMessage } from './messages/AssistantToolUseMessage.js';
import { AttachmentMessage } from './messages/AttachmentMessage.js';
import { CollapsedReadSearchContent } from './messages/CollapsedReadSearchContent.js';
import { CompactBoundaryMessage } from './messages/CompactBoundaryMessage.js';
import { GroupedToolUseContent } from './messages/GroupedToolUseContent.js';
import { SystemTextMessage } from './messages/SystemTextMessage.js';
import { UserImageMessage } from './messages/UserImageMessage.js';
import { UserTextMessage } from './messages/UserTextMessage.js';
import { UserToolResultMessage } from './messages/UserToolResultMessage/UserToolResultMessage.js';
import { OffscreenFreeze } from './OffscreenFreeze.js';
import { ExpandShellOutputProvider } from './shell/ExpandShellOutputContext.js';
export type Props = {
  message: NormalizedUserMessage | AssistantMessage | AttachmentMessageType | SystemMessage | GroupedToolUseMessageType | CollapsedReadSearchGroupType;
  lookups: ReturnType<typeof buildMessageLookups>;
  // TODO: Find a way to remove this, and leave spacing to the consumer
  /** Absolute width for the container Box. When provided, eliminates a wrapper Box in the caller. */
  containerWidth?: number;
  addMargin: boolean;
  tools: Tools;
  commands: Command[];
  verbose: boolean;
  inProgressToolUseIDs: Set<string>;
  progressMessagesForMessage: ProgressMessage[];
  shouldAnimate: boolean;
  shouldShowDot: boolean;
  style?: 'condensed';
  width?: number | string;
  isTranscriptMode: boolean;
  isStatic: boolean;
  onOpenRateLimitOptions?: () => void;
  isActiveCollapsedGroup?: boolean;
  isUserContinuation?: boolean;
  /** ID of the last thinking block (uuid:index) to show, used for hiding past thinking in transcript mode */
  lastThinkingBlockId?: string | null;
  /** UUID of the latest user bash output message (for auto-expanding) */
  latestBashOutputUUID?: string | null;
};
function MessageImpl(t0) {
  const $ = _c(94);
  const {
    message,
    lookups,
    containerWidth,
    addMargin,
    tools,
    commands,
    verbose,
    inProgressToolUseIDs,
    progressMessagesForMessage,
    shouldAnimate,
    shouldShowDot,
    style,
    width,
    isTranscriptMode,
    onOpenRateLimitOptions,
    isActiveCollapsedGroup,
    isUserContinuation: t1,
    lastThinkingBlockId,
    latestBashOutputUUID
  } = t0;
  const isUserContinuation = t1 === undefined ? false : t1;
  switch (message.type) {
    case "attachment":
      {
        let t2;
        if ($[0] !== addMargin || $[1] !== isTranscriptMode || $[2] !== message.attachment || $[3] !== verbose) {
          t2 = <AttachmentMessage addMargin={addMargin} attachment={message.attachment} verbose={verbose} isTranscriptMode={isTranscriptMode} />;
          $[0] = addMargin;
          $[1] = isTranscriptMode;
          $[2] = message.attachment;
          $[3] = verbose;
          $[4] = t2;
        } else {
          t2 = $[4];
        }
        return t2;
      }
    case "assistant":
      {
        const t2 = containerWidth ?? "100%";
        let t3;
        if ($[5] !== addMargin || $[6] !== commands || $[7] !== inProgressToolUseIDs || $[8] !== isTranscriptMode || $[9] !== lastThinkingBlockId || $[10] !== lookups || $[11] !== message.advisorModel || $[12] !== message.message.content || $[13] !== message.uuid || $[14] !== onOpenRateLimitOptions || $[15] !== progressMessagesForMessage || $[16] !== shouldAnimate || $[17] !== shouldShowDot || $[18] !== tools || $[19] !== verbose || $[20] !== width) {
          let t4;
          if ($[22] !== addMargin || $[23] !== commands || $[24] !== inProgressToolUseIDs || $[25] !== isTranscriptMode || $[26] !== lastThinkingBlockId || $[27] !== lookups || $[28] !== message.advisorModel || $[29] !== message.uuid || $[30] !== onOpenRateLimitOptions || $[31] !== progressMessagesForMessage || $[32] !== shouldAnimate || $[33] !== shouldShowDot || $[34] !== tools || $[35] !== verbose || $[36] !== width) {
            t4 = (_, index_0) => <AssistantMessageBlock key={index_0} param={_} addMargin={addMargin} tools={tools} commands={commands} verbose={verbose} inProgressToolUseIDs={inProgressToolUseIDs} progressMessagesForMessage={progressMessagesForMessage} shouldAnimate={shouldAnimate} shouldShowDot={shouldShowDot} width={width} inProgressToolCallCount={inProgressToolUseIDs.size} isTranscriptMode={isTranscriptMode} lookups={lookups} onOpenRateLimitOptions={onOpenRateLimitOptions} thinkingBlockId={`${message.uuid}:${index_0}`} lastThinkingBlockId={lastThinkingBlockId} advisorModel={message.advisorModel} />;
            $[22] = addMargin;
            $[23] = commands;
            $[24] = inProgressToolUseIDs;
            $[25] = isTranscriptMode;
            $[26] = lastThinkingBlockId;
            $[27] = lookups;
            $[28] = message.advisorModel;
            $[29] = message.uuid;
            $[30] = onOpenRateLimitOptions;
            $[31] = progressMessagesForMessage;
            $[32] = shouldAnimate;
            $[33] = shouldShowDot;
            $[34] = tools;
            $[35] = verbose;
            $[36] = width;
            $[37] = t4;
          } else {
            t4 = $[37];
          }
          t3 = message.message.content.map(t4);
          $[5] = addMargin;
          $[6] = commands;
          $[7] = inProgressToolUseIDs;
          $[8] = isTranscriptMode;
          $[9] = lastThinkingBlockId;
          $[10] = lookups;
          $[11] = message.advisorModel;
          $[12] = message.message.content;
          $[13] = message.uuid;
          $[14] = onOpenRateLimitOptions;
          $[15] = progressMessagesForMessage;
          $[16] = shouldAnimate;
          $[17] = shouldShowDot;
          $[18] = tools;
          $[19] = verbose;
          $[20] = width;
          $[21] = t3;
        } else {
          t3 = $[21];
        }
        let t4;
        if ($[38] !== t2 || $[39] !== t3) {
          t4 = <Box flexDirection="column" width={t2}>{t3}</Box>;
          $[38] = t2;
          $[39] = t3;
          $[40] = t4;
        } else {
          t4 = $[40];
        }
        return t4;
      }
    case "user":
      {
        if (message.isCompactSummary) {
          const t2 = isTranscriptMode ? "transcript" : "prompt";
          let t3;
          if ($[41] !== message || $[42] !== t2) {
            t3 = <CompactSummary message={message} screen={t2} />;
            $[41] = message;
            $[42] = t2;
            $[43] = t3;
          } else {
            t3 = $[43];
          }
          return t3;
        }
        let imageIndices;
        if ($[44] !== message.imagePasteIds || $[45] !== message.message.content) {
          imageIndices = [];
          let imagePosition = 0;
          for (const param of message.message.content) {
            if (param.type === "image") {
              const id = message.imagePasteIds?.[imagePosition];
              imagePosition++;
              imageIndices.push(id ?? imagePosition);
            } else {
              imageIndices.push(imagePosition);
            }
          }
          $[44] = message.imagePasteIds;
          $[45] = message.message.content;
          $[46] = imageIndices;
        } else {
          imageIndices = $[46];
        }
        const isLatestBashOutput = latestBashOutputUUID === message.uuid;
        const t2 = containerWidth ?? "100%";
        let t3;
        if ($[47] !== addMargin || $[48] !== imageIndices || $[49] !== isTranscriptMode || $[50] !== isUserContinuation || $[51] !== lookups || $[52] !== message || $[53] !== progressMessagesForMessage || $[54] !== style || $[55] !== tools || $[56] !== verbose) {
          t3 = message.message.content.map((param_0, index) => <UserMessage key={index} message={message} addMargin={addMargin} tools={tools} progressMessagesForMessage={progressMessagesForMessage} param={param_0} style={style} verbose={verbose} imageIndex={imageIndices[index]} isUserContinuation={isUserContinuation} lookups={lookups} isTranscriptMode={isTranscriptMode} />);
          $[47] = addMargin;
          $[48] = imageIndices;
          $[49] = isTranscriptMode;
          $[50] = isUserContinuation;
          $[51] = lookups;
          $[52] = message;
          $[53] = progressMessagesForMessage;
          $[54] = style;
          $[55] = tools;
          $[56] = verbose;
          $[57] = t3;
        } else {
          t3 = $[57];
        }
        let t4;
        if ($[58] !== t2 || $[59] !== t3) {
          t4 = <Box flexDirection="column" width={t2}>{t3}</Box>;
          $[58] = t2;
          $[59] = t3;
          $[60] = t4;
        } else {
          t4 = $[60];
        }
        const content = t4;
        let t5;
        if ($[61] !== content || $[62] !== isLatestBashOutput) {
          t5 = isLatestBashOutput ? <ExpandShellOutputProvider>{content}</ExpandShellOutputProvider> : content;
          $[61] = content;
          $[62] = isLatestBashOutput;
          $[63] = t5;
        } else {
          t5 = $[63];
        }
        return t5;
      }
    case "system":
      {
        if (message.subtype === "compact_boundary") {
          if (isFullscreenEnvEnabled()) {
            return null;
          }
          let t2;
          if ($[64] === Symbol.for("react.memo_cache_sentinel")) {
            t2 = <CompactBoundaryMessage />;
            $[64] = t2;
          } else {
            t2 = $[64];
          }
          return t2;
        }
        if (message.subtype === "microcompact_boundary") {
          return null;
        }
        if (feature("HISTORY_SNIP")) {
          const {
            isSnipBoundaryMessage
          } = require("../services/compact/snipProjection.js") as typeof import('../services/compact/snipProjection.js');
          const {
            isSnipMarkerMessage
          } = require("../services/compact/snipCompact.js") as typeof import('../services/compact/snipCompact.js');
          if (isSnipBoundaryMessage(message)) {
            let t2;
            if ($[65] === Symbol.for("react.memo_cache_sentinel")) {
              t2 = require("./messages/SnipBoundaryMessage.js");
              $[65] = t2;
            } else {
              t2 = $[65];
            }
            const {
              SnipBoundaryMessage
            } = t2 as typeof import('./messages/SnipBoundaryMessage.js');
            let t3;
            if ($[66] !== message) {
              t3 = <SnipBoundaryMessage message={message} />;
              $[66] = message;
              $[67] = t3;
            } else {
              t3 = $[67];
            }
            return t3;
          }
          if (isSnipMarkerMessage(message)) {
            return null;
          }
        }
        if (message.subtype === "local_command") {
          let t2;
          if ($[68] !== message.content) {
            t2 = {
              type: "text",
              text: message.content
            };
            $[68] = message.content;
            $[69] = t2;
          } else {
            t2 = $[69];
          }
          let t3;
          if ($[70] !== addMargin || $[71] !== isTranscriptMode || $[72] !== t2 || $[73] !== verbose) {
            t3 = <UserTextMessage addMargin={addMargin} param={t2} verbose={verbose} isTranscriptMode={isTranscriptMode} />;
            $[70] = addMargin;
            $[71] = isTranscriptMode;
            $[72] = t2;
            $[73] = verbose;
            $[74] = t3;
          } else {
            t3 = $[74];
          }
          return t3;
        }
        let t2;
        if ($[75] !== addMargin || $[76] !== isTranscriptMode || $[77] !== message || $[78] !== verbose) {
          t2 = <SystemTextMessage message={message} addMargin={addMargin} verbose={verbose} isTranscriptMode={isTranscriptMode} />;
          $[75] = addMargin;
          $[76] = isTranscriptMode;
          $[77] = message;
          $[78] = verbose;
          $[79] = t2;
        } else {
          t2 = $[79];
        }
        return t2;
      }
    case "grouped_tool_use":
      {
        let t2;
        if ($[80] !== inProgressToolUseIDs || $[81] !== lookups || $[82] !== message || $[83] !== shouldAnimate || $[84] !== tools) {
          t2 = <GroupedToolUseContent message={message} tools={tools} lookups={lookups} inProgressToolUseIDs={inProgressToolUseIDs} shouldAnimate={shouldAnimate} />;
          $[80] = inProgressToolUseIDs;
          $[81] = lookups;
          $[82] = message;
          $[83] = shouldAnimate;
          $[84] = tools;
          $[85] = t2;
        } else {
          t2 = $[85];
        }
        return t2;
      }
    case "collapsed_read_search":
      {
        const t2 = verbose || isTranscriptMode;
        let t3;
        if ($[86] !== inProgressToolUseIDs || $[87] !== isActiveCollapsedGroup || $[88] !== lookups || $[89] !== message || $[90] !== shouldAnimate || $[91] !== t2 || $[92] !== tools) {
          t3 = <OffscreenFreeze><CollapsedReadSearchContent message={message} inProgressToolUseIDs={inProgressToolUseIDs} shouldAnimate={shouldAnimate} verbose={t2} tools={tools} lookups={lookups} isActiveGroup={isActiveCollapsedGroup} /></OffscreenFreeze>;
          $[86] = inProgressToolUseIDs;
          $[87] = isActiveCollapsedGroup;
          $[88] = lookups;
          $[89] = message;
          $[90] = shouldAnimate;
          $[91] = t2;
          $[92] = tools;
          $[93] = t3;
        } else {
          t3 = $[93];
        }
        return t3;
      }
  }
}
function UserMessage(t0) {
  const $ = _c(20);
  const {
    message,
    addMargin,
    tools,
    progressMessagesForMessage,
    param,
    style,
    verbose,
    imageIndex,
    isUserContinuation,
    lookups,
    isTranscriptMode
  } = t0;
  const {
    columns
  } = useTerminalSize();
  switch (param.type) {
    case "text":
      {
        let t1;
        if ($[0] !== addMargin || $[1] !== isTranscriptMode || $[2] !== message.planContent || $[3] !== message.timestamp || $[4] !== param || $[5] !== verbose) {
          t1 = <UserTextMessage addMargin={addMargin} param={param} verbose={verbose} planContent={message.planContent} isTranscriptMode={isTranscriptMode} timestamp={message.timestamp} />;
          $[0] = addMargin;
          $[1] = isTranscriptMode;
          $[2] = message.planContent;
          $[3] = message.timestamp;
          $[4] = param;
          $[5] = verbose;
          $[6] = t1;
        } else {
          t1 = $[6];
        }
        return t1;
      }
    case "image":
      {
        const t1 = addMargin && !isUserContinuation;
        let t2;
        if ($[7] !== imageIndex || $[8] !== t1) {
          t2 = <UserImageMessage imageId={imageIndex} addMargin={t1} />;
          $[7] = imageIndex;
          $[8] = t1;
          $[9] = t2;
        } else {
          t2 = $[9];
        }
        return t2;
      }
    case "tool_result":
      {
        const t1 = columns - 5;
        let t2;
        if ($[10] !== isTranscriptMode || $[11] !== lookups || $[12] !== message || $[13] !== param || $[14] !== progressMessagesForMessage || $[15] !== style || $[16] !== t1 || $[17] !== tools || $[18] !== verbose) {
          t2 = <UserToolResultMessage param={param} message={message} lookups={lookups} progressMessagesForMessage={progressMessagesForMessage} style={style} tools={tools} verbose={verbose} width={t1} isTranscriptMode={isTranscriptMode} />;
          $[10] = isTranscriptMode;
          $[11] = lookups;
          $[12] = message;
          $[13] = param;
          $[14] = progressMessagesForMessage;
          $[15] = style;
          $[16] = t1;
          $[17] = tools;
          $[18] = verbose;
          $[19] = t2;
        } else {
          t2 = $[19];
        }
        return t2;
      }
    default:
      {
        return;
      }
  }
}
function AssistantMessageBlock(t0) {
  const $ = _c(45);
  const {
    param,
    addMargin,
    tools,
    commands,
    verbose,
    inProgressToolUseIDs,
    progressMessagesForMessage,
    shouldAnimate,
    shouldShowDot,
    width,
    inProgressToolCallCount,
    isTranscriptMode,
    lookups,
    onOpenRateLimitOptions,
    thinkingBlockId,
    lastThinkingBlockId,
    advisorModel
  } = t0;
  if (feature("CONNECTOR_TEXT")) {
    if (isConnectorTextBlock(param)) {
      let t1;
      if ($[0] !== param.connector_text) {
        t1 = {
          type: "text",
          text: param.connector_text
        };
        $[0] = param.connector_text;
        $[1] = t1;
      } else {
        t1 = $[1];
      }
      let t2;
      if ($[2] !== addMargin || $[3] !== onOpenRateLimitOptions || $[4] !== shouldShowDot || $[5] !== t1 || $[6] !== verbose || $[7] !== width) {
        t2 = <AssistantTextMessage param={t1} addMargin={addMargin} shouldShowDot={shouldShowDot} verbose={verbose} width={width} onOpenRateLimitOptions={onOpenRateLimitOptions} />;
        $[2] = addMargin;
        $[3] = onOpenRateLimitOptions;
        $[4] = shouldShowDot;
        $[5] = t1;
        $[6] = verbose;
        $[7] = width;
        $[8] = t2;
      } else {
        t2 = $[8];
      }
      return t2;
    }
  }
  switch (param.type) {
    case "tool_use":
      {
        let t1;
        if ($[9] !== addMargin || $[10] !== commands || $[11] !== inProgressToolCallCount || $[12] !== inProgressToolUseIDs || $[13] !== isTranscriptMode || $[14] !== lookups || $[15] !== param || $[16] !== progressMessagesForMessage || $[17] !== shouldAnimate || $[18] !== shouldShowDot || $[19] !== tools || $[20] !== verbose) {
          t1 = <AssistantToolUseMessage param={param} addMargin={addMargin} tools={tools} commands={commands} verbose={verbose} inProgressToolUseIDs={inProgressToolUseIDs} progressMessagesForMessage={progressMessagesForMessage} shouldAnimate={shouldAnimate} shouldShowDot={shouldShowDot} inProgressToolCallCount={inProgressToolCallCount} lookups={lookups} isTranscriptMode={isTranscriptMode} />;
          $[9] = addMargin;
          $[10] = commands;
          $[11] = inProgressToolCallCount;
          $[12] = inProgressToolUseIDs;
          $[13] = isTranscriptMode;
          $[14] = lookups;
          $[15] = param;
          $[16] = progressMessagesForMessage;
          $[17] = shouldAnimate;
          $[18] = shouldShowDot;
          $[19] = tools;
          $[20] = verbose;
          $[21] = t1;
        } else {
          t1 = $[21];
        }
        return t1;
      }
    case "text":
      {
        let t1;
        if ($[22] !== addMargin || $[23] !== onOpenRateLimitOptions || $[24] !== param || $[25] !== shouldShowDot || $[26] !== verbose || $[27] !== width) {
          t1 = <AssistantTextMessage param={param} addMargin={addMargin} shouldShowDot={shouldShowDot} verbose={verbose} width={width} onOpenRateLimitOptions={onOpenRateLimitOptions} />;
          $[22] = addMargin;
          $[23] = onOpenRateLimitOptions;
          $[24] = param;
          $[25] = shouldShowDot;
          $[26] = verbose;
          $[27] = width;
          $[28] = t1;
        } else {
          t1 = $[28];
        }
        return t1;
      }
    case "redacted_thinking":
      {
        if (!isTranscriptMode && !verbose) {
          return null;
        }
        let t1;
        if ($[29] !== addMargin) {
          t1 = <AssistantRedactedThinkingMessage addMargin={addMargin} />;
          $[29] = addMargin;
          $[30] = t1;
        } else {
          t1 = $[30];
        }
        return t1;
      }
    case "thinking":
      {
        if (!isTranscriptMode && !verbose) {
          return null;
        }
        const isLastThinking = !lastThinkingBlockId || thinkingBlockId === lastThinkingBlockId;
        const t1 = isTranscriptMode && !isLastThinking;
        let t2;
        if ($[31] !== addMargin || $[32] !== isTranscriptMode || $[33] !== param || $[34] !== t1 || $[35] !== verbose) {
          t2 = <AssistantThinkingMessage addMargin={addMargin} param={param} isTranscriptMode={isTranscriptMode} verbose={verbose} hideInTranscript={t1} />;
          $[31] = addMargin;
          $[32] = isTranscriptMode;
          $[33] = param;
          $[34] = t1;
          $[35] = verbose;
          $[36] = t2;
        } else {
          t2 = $[36];
        }
        return t2;
      }
    case "server_tool_use":
    case "advisor_tool_result":
      {
        if (isAdvisorBlock(param)) {
          const t1 = verbose || isTranscriptMode;
          let t2;
          if ($[37] !== addMargin || $[38] !== advisorModel || $[39] !== lookups.erroredToolUseIDs || $[40] !== lookups.resolvedToolUseIDs || $[41] !== param || $[42] !== shouldAnimate || $[43] !== t1) {
            t2 = <AdvisorMessage block={param} addMargin={addMargin} resolvedToolUseIDs={lookups.resolvedToolUseIDs} erroredToolUseIDs={lookups.erroredToolUseIDs} shouldAnimate={shouldAnimate} verbose={t1} advisorModel={advisorModel} />;
            $[37] = addMargin;
            $[38] = advisorModel;
            $[39] = lookups.erroredToolUseIDs;
            $[40] = lookups.resolvedToolUseIDs;
            $[41] = param;
            $[42] = shouldAnimate;
            $[43] = t1;
            $[44] = t2;
          } else {
            t2 = $[44];
          }
          return t2;
        }
        logError(new Error(`Unable to render server tool block: ${param.type}`));
        return null;
      }
    default:
      {
        logError(new Error(`Unable to render message type: ${param.type}`));
        return null;
      }
  }
}
export function hasThinkingContent(m: {
  type: string;
  message?: {
    content: Array<{
      type: string;
    }>;
  };
}): boolean {
  if (m.type !== 'assistant' || !m.message) return false;
  return m.message.content.some(b => b.type === 'thinking' || b.type === 'redacted_thinking');
}

/** Exported for testing */
export function areMessagePropsEqual(prev: Props, next: Props): boolean {
  if (prev.message.uuid !== next.message.uuid) return false;
  // Only re-render on lastThinkingBlockId change if this message actually
  // has thinking content — otherwise every message in scrollback re-renders
  // whenever streaming thinking starts/stops (CC-941).
  if (prev.lastThinkingBlockId !== next.lastThinkingBlockId && hasThinkingContent(next.message)) {
    return false;
  }
  // Verbose toggle changes thinking block visibility/expansion
  if (prev.verbose !== next.verbose) return false;
  // Only re-render if this message's "is latest bash output" status changed,
  // not when the global latestBashOutputUUID changes to a different message
  const prevIsLatest = prev.latestBashOutputUUID === prev.message.uuid;
  const nextIsLatest = next.latestBashOutputUUID === next.message.uuid;
  if (prevIsLatest !== nextIsLatest) return false;
  if (prev.isTranscriptMode !== next.isTranscriptMode) return false;
  // containerWidth is an absolute number in the no-metadata path (wrapper
  // Box is skipped). Static messages must re-render on terminal resize.
  if (prev.containerWidth !== next.containerWidth) return false;
  if (prev.isStatic && next.isStatic) return true;
  return false;
}
export const Message = React.memo(MessageImpl, areMessagePropsEqual);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiQmV0YUNvbnRlbnRCbG9jayIsIkltYWdlQmxvY2tQYXJhbSIsIlRleHRCbG9ja1BhcmFtIiwiVGhpbmtpbmdCbG9ja1BhcmFtIiwiVG9vbFJlc3VsdEJsb2NrUGFyYW0iLCJUb29sVXNlQmxvY2tQYXJhbSIsIlJlYWN0IiwiQ29tbWFuZCIsInVzZVRlcm1pbmFsU2l6ZSIsIkJveCIsIlRvb2xzIiwiQ29ubmVjdG9yVGV4dEJsb2NrIiwiaXNDb25uZWN0b3JUZXh0QmxvY2siLCJBc3Npc3RhbnRNZXNzYWdlIiwiQXR0YWNobWVudE1lc3NhZ2UiLCJBdHRhY2htZW50TWVzc2FnZVR5cGUiLCJDb2xsYXBzZWRSZWFkU2VhcmNoR3JvdXAiLCJDb2xsYXBzZWRSZWFkU2VhcmNoR3JvdXBUeXBlIiwiR3JvdXBlZFRvb2xVc2VNZXNzYWdlIiwiR3JvdXBlZFRvb2xVc2VNZXNzYWdlVHlwZSIsIk5vcm1hbGl6ZWRVc2VyTWVzc2FnZSIsIlByb2dyZXNzTWVzc2FnZSIsIlN5c3RlbU1lc3NhZ2UiLCJBZHZpc29yQmxvY2siLCJpc0Fkdmlzb3JCbG9jayIsImlzRnVsbHNjcmVlbkVudkVuYWJsZWQiLCJsb2dFcnJvciIsImJ1aWxkTWVzc2FnZUxvb2t1cHMiLCJDb21wYWN0U3VtbWFyeSIsIkFkdmlzb3JNZXNzYWdlIiwiQXNzaXN0YW50UmVkYWN0ZWRUaGlua2luZ01lc3NhZ2UiLCJBc3Npc3RhbnRUZXh0TWVzc2FnZSIsIkFzc2lzdGFudFRoaW5raW5nTWVzc2FnZSIsIkFzc2lzdGFudFRvb2xVc2VNZXNzYWdlIiwiQ29sbGFwc2VkUmVhZFNlYXJjaENvbnRlbnQiLCJDb21wYWN0Qm91bmRhcnlNZXNzYWdlIiwiR3JvdXBlZFRvb2xVc2VDb250ZW50IiwiU3lzdGVtVGV4dE1lc3NhZ2UiLCJVc2VySW1hZ2VNZXNzYWdlIiwiVXNlclRleHRNZXNzYWdlIiwiVXNlclRvb2xSZXN1bHRNZXNzYWdlIiwiT2Zmc2NyZWVuRnJlZXplIiwiRXhwYW5kU2hlbGxPdXRwdXRQcm92aWRlciIsIlByb3BzIiwibWVzc2FnZSIsImxvb2t1cHMiLCJSZXR1cm5UeXBlIiwiY29udGFpbmVyV2lkdGgiLCJhZGRNYXJnaW4iLCJ0b29scyIsImNvbW1hbmRzIiwidmVyYm9zZSIsImluUHJvZ3Jlc3NUb29sVXNlSURzIiwiU2V0IiwicHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2UiLCJzaG91bGRBbmltYXRlIiwic2hvdWxkU2hvd0RvdCIsInN0eWxlIiwid2lkdGgiLCJpc1RyYW5zY3JpcHRNb2RlIiwiaXNTdGF0aWMiLCJvbk9wZW5SYXRlTGltaXRPcHRpb25zIiwiaXNBY3RpdmVDb2xsYXBzZWRHcm91cCIsImlzVXNlckNvbnRpbnVhdGlvbiIsImxhc3RUaGlua2luZ0Jsb2NrSWQiLCJsYXRlc3RCYXNoT3V0cHV0VVVJRCIsIk1lc3NhZ2VJbXBsIiwidDAiLCIkIiwiX2MiLCJ0MSIsInVuZGVmaW5lZCIsInR5cGUiLCJ0MiIsImF0dGFjaG1lbnQiLCJ0MyIsImFkdmlzb3JNb2RlbCIsImNvbnRlbnQiLCJ1dWlkIiwidDQiLCJfIiwiaW5kZXhfMCIsImluZGV4Iiwic2l6ZSIsIm1hcCIsImlzQ29tcGFjdFN1bW1hcnkiLCJpbWFnZUluZGljZXMiLCJpbWFnZVBhc3RlSWRzIiwiaW1hZ2VQb3NpdGlvbiIsInBhcmFtIiwiaWQiLCJwdXNoIiwiaXNMYXRlc3RCYXNoT3V0cHV0IiwicGFyYW1fMCIsInQ1Iiwic3VidHlwZSIsIlN5bWJvbCIsImZvciIsImlzU25pcEJvdW5kYXJ5TWVzc2FnZSIsInJlcXVpcmUiLCJpc1NuaXBNYXJrZXJNZXNzYWdlIiwiU25pcEJvdW5kYXJ5TWVzc2FnZSIsInRleHQiLCJVc2VyTWVzc2FnZSIsImltYWdlSW5kZXgiLCJjb2x1bW5zIiwicGxhbkNvbnRlbnQiLCJ0aW1lc3RhbXAiLCJBc3Npc3RhbnRNZXNzYWdlQmxvY2siLCJpblByb2dyZXNzVG9vbENhbGxDb3VudCIsInRoaW5raW5nQmxvY2tJZCIsImNvbm5lY3Rvcl90ZXh0IiwiaXNMYXN0VGhpbmtpbmciLCJlcnJvcmVkVG9vbFVzZUlEcyIsInJlc29sdmVkVG9vbFVzZUlEcyIsIkVycm9yIiwiaGFzVGhpbmtpbmdDb250ZW50IiwibSIsIkFycmF5Iiwic29tZSIsImIiLCJhcmVNZXNzYWdlUHJvcHNFcXVhbCIsInByZXYiLCJuZXh0IiwicHJldklzTGF0ZXN0IiwibmV4dElzTGF0ZXN0IiwiTWVzc2FnZSIsIm1lbW8iXSwic291cmNlcyI6WyJNZXNzYWdlLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcbmltcG9ydCB0eXBlIHsgQmV0YUNvbnRlbnRCbG9jayB9IGZyb20gJ0BhbnRocm9waWMtYWkvc2RrL3Jlc291cmNlcy9iZXRhL21lc3NhZ2VzL21lc3NhZ2VzLm1qcydcbmltcG9ydCB0eXBlIHtcbiAgSW1hZ2VCbG9ja1BhcmFtLFxuICBUZXh0QmxvY2tQYXJhbSxcbiAgVGhpbmtpbmdCbG9ja1BhcmFtLFxuICBUb29sUmVzdWx0QmxvY2tQYXJhbSxcbiAgVG9vbFVzZUJsb2NrUGFyYW0sXG59IGZyb20gJ0BhbnRocm9waWMtYWkvc2RrL3Jlc291cmNlcy9pbmRleC5tanMnXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB0eXBlIHsgQ29tbWFuZCB9IGZyb20gJy4uL2NvbW1hbmRzLmpzJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnLi4vaG9va3MvdXNlVGVybWluYWxTaXplLmpzJ1xuaW1wb3J0IHsgQm94IH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHR5cGUgeyBUb29scyB9IGZyb20gJy4uL1Rvb2wuanMnXG5pbXBvcnQge1xuICB0eXBlIENvbm5lY3RvclRleHRCbG9jayxcbiAgaXNDb25uZWN0b3JUZXh0QmxvY2ssXG59IGZyb20gJy4uL3R5cGVzL2Nvbm5lY3RvclRleHQuanMnXG5pbXBvcnQgdHlwZSB7XG4gIEFzc2lzdGFudE1lc3NhZ2UsXG4gIEF0dGFjaG1lbnRNZXNzYWdlIGFzIEF0dGFjaG1lbnRNZXNzYWdlVHlwZSxcbiAgQ29sbGFwc2VkUmVhZFNlYXJjaEdyb3VwIGFzIENvbGxhcHNlZFJlYWRTZWFyY2hHcm91cFR5cGUsXG4gIEdyb3VwZWRUb29sVXNlTWVzc2FnZSBhcyBHcm91cGVkVG9vbFVzZU1lc3NhZ2VUeXBlLFxuICBOb3JtYWxpemVkVXNlck1lc3NhZ2UsXG4gIFByb2dyZXNzTWVzc2FnZSxcbiAgU3lzdGVtTWVzc2FnZSxcbn0gZnJvbSAnLi4vdHlwZXMvbWVzc2FnZS5qcydcbmltcG9ydCB7IHR5cGUgQWR2aXNvckJsb2NrLCBpc0Fkdmlzb3JCbG9jayB9IGZyb20gJy4uL3V0aWxzL2Fkdmlzb3IuanMnXG5pbXBvcnQgeyBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkIH0gZnJvbSAnLi4vdXRpbHMvZnVsbHNjcmVlbi5qcydcbmltcG9ydCB7IGxvZ0Vycm9yIH0gZnJvbSAnLi4vdXRpbHMvbG9nLmpzJ1xuaW1wb3J0IHR5cGUgeyBidWlsZE1lc3NhZ2VMb29rdXBzIH0gZnJvbSAnLi4vdXRpbHMvbWVzc2FnZXMuanMnXG5pbXBvcnQgeyBDb21wYWN0U3VtbWFyeSB9IGZyb20gJy4vQ29tcGFjdFN1bW1hcnkuanMnXG5pbXBvcnQgeyBBZHZpc29yTWVzc2FnZSB9IGZyb20gJy4vbWVzc2FnZXMvQWR2aXNvck1lc3NhZ2UuanMnXG5pbXBvcnQgeyBBc3Npc3RhbnRSZWRhY3RlZFRoaW5raW5nTWVzc2FnZSB9IGZyb20gJy4vbWVzc2FnZXMvQXNzaXN0YW50UmVkYWN0ZWRUaGlua2luZ01lc3NhZ2UuanMnXG5pbXBvcnQgeyBBc3Npc3RhbnRUZXh0TWVzc2FnZSB9IGZyb20gJy4vbWVzc2FnZXMvQXNzaXN0YW50VGV4dE1lc3NhZ2UuanMnXG5pbXBvcnQgeyBBc3Npc3RhbnRUaGlua2luZ01lc3NhZ2UgfSBmcm9tICcuL21lc3NhZ2VzL0Fzc2lzdGFudFRoaW5raW5nTWVzc2FnZS5qcydcbmltcG9ydCB7IEFzc2lzdGFudFRvb2xVc2VNZXNzYWdlIH0gZnJvbSAnLi9tZXNzYWdlcy9Bc3Npc3RhbnRUb29sVXNlTWVzc2FnZS5qcydcbmltcG9ydCB7IEF0dGFjaG1lbnRNZXNzYWdlIH0gZnJvbSAnLi9tZXNzYWdlcy9BdHRhY2htZW50TWVzc2FnZS5qcydcbmltcG9ydCB7IENvbGxhcHNlZFJlYWRTZWFyY2hDb250ZW50IH0gZnJvbSAnLi9tZXNzYWdlcy9Db2xsYXBzZWRSZWFkU2VhcmNoQ29udGVudC5qcydcbmltcG9ydCB7IENvbXBhY3RCb3VuZGFyeU1lc3NhZ2UgfSBmcm9tICcuL21lc3NhZ2VzL0NvbXBhY3RCb3VuZGFyeU1lc3NhZ2UuanMnXG5pbXBvcnQgeyBHcm91cGVkVG9vbFVzZUNvbnRlbnQgfSBmcm9tICcuL21lc3NhZ2VzL0dyb3VwZWRUb29sVXNlQ29udGVudC5qcydcbmltcG9ydCB7IFN5c3RlbVRleHRNZXNzYWdlIH0gZnJvbSAnLi9tZXNzYWdlcy9TeXN0ZW1UZXh0TWVzc2FnZS5qcydcbmltcG9ydCB7IFVzZXJJbWFnZU1lc3NhZ2UgfSBmcm9tICcuL21lc3NhZ2VzL1VzZXJJbWFnZU1lc3NhZ2UuanMnXG5pbXBvcnQgeyBVc2VyVGV4dE1lc3NhZ2UgfSBmcm9tICcuL21lc3NhZ2VzL1VzZXJUZXh0TWVzc2FnZS5qcydcbmltcG9ydCB7IFVzZXJUb29sUmVzdWx0TWVzc2FnZSB9IGZyb20gJy4vbWVzc2FnZXMvVXNlclRvb2xSZXN1bHRNZXNzYWdlL1VzZXJUb29sUmVzdWx0TWVzc2FnZS5qcydcbmltcG9ydCB7IE9mZnNjcmVlbkZyZWV6ZSB9IGZyb20gJy4vT2Zmc2NyZWVuRnJlZXplLmpzJ1xuaW1wb3J0IHsgRXhwYW5kU2hlbGxPdXRwdXRQcm92aWRlciB9IGZyb20gJy4vc2hlbGwvRXhwYW5kU2hlbGxPdXRwdXRDb250ZXh0LmpzJ1xuXG5leHBvcnQgdHlwZSBQcm9wcyA9IHtcbiAgbWVzc2FnZTpcbiAgICB8IE5vcm1hbGl6ZWRVc2VyTWVzc2FnZVxuICAgIHwgQXNzaXN0YW50TWVzc2FnZVxuICAgIHwgQXR0YWNobWVudE1lc3NhZ2VUeXBlXG4gICAgfCBTeXN0ZW1NZXNzYWdlXG4gICAgfCBHcm91cGVkVG9vbFVzZU1lc3NhZ2VUeXBlXG4gICAgfCBDb2xsYXBzZWRSZWFkU2VhcmNoR3JvdXBUeXBlXG4gIGxvb2t1cHM6IFJldHVyblR5cGU8dHlwZW9mIGJ1aWxkTWVzc2FnZUxvb2t1cHM+XG4gIC8vIFRPRE86IEZpbmQgYSB3YXkgdG8gcmVtb3ZlIHRoaXMsIGFuZCBsZWF2ZSBzcGFjaW5nIHRvIHRoZSBjb25zdW1lclxuICAvKiogQWJzb2x1dGUgd2lkdGggZm9yIHRoZSBjb250YWluZXIgQm94LiBXaGVuIHByb3ZpZGVkLCBlbGltaW5hdGVzIGEgd3JhcHBlciBCb3ggaW4gdGhlIGNhbGxlci4gKi9cbiAgY29udGFpbmVyV2lkdGg/OiBudW1iZXJcbiAgYWRkTWFyZ2luOiBib29sZWFuXG4gIHRvb2xzOiBUb29sc1xuICBjb21tYW5kczogQ29tbWFuZFtdXG4gIHZlcmJvc2U6IGJvb2xlYW5cbiAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM6IFNldDxzdHJpbmc+XG4gIHByb2dyZXNzTWVzc2FnZXNGb3JNZXNzYWdlOiBQcm9ncmVzc01lc3NhZ2VbXVxuICBzaG91bGRBbmltYXRlOiBib29sZWFuXG4gIHNob3VsZFNob3dEb3Q6IGJvb2xlYW5cbiAgc3R5bGU/OiAnY29uZGVuc2VkJ1xuICB3aWR0aD86IG51bWJlciB8IHN0cmluZ1xuICBpc1RyYW5zY3JpcHRNb2RlOiBib29sZWFuXG4gIGlzU3RhdGljOiBib29sZWFuXG4gIG9uT3BlblJhdGVMaW1pdE9wdGlvbnM/OiAoKSA9PiB2b2lkXG4gIGlzQWN0aXZlQ29sbGFwc2VkR3JvdXA/OiBib29sZWFuXG4gIGlzVXNlckNvbnRpbnVhdGlvbj86IGJvb2xlYW5cbiAgLyoqIElEIG9mIHRoZSBsYXN0IHRoaW5raW5nIGJsb2NrICh1dWlkOmluZGV4KSB0byBzaG93LCB1c2VkIGZvciBoaWRpbmcgcGFzdCB0aGlua2luZyBpbiB0cmFuc2NyaXB0IG1vZGUgKi9cbiAgbGFzdFRoaW5raW5nQmxvY2tJZD86IHN0cmluZyB8IG51bGxcbiAgLyoqIFVVSUQgb2YgdGhlIGxhdGVzdCB1c2VyIGJhc2ggb3V0cHV0IG1lc3NhZ2UgKGZvciBhdXRvLWV4cGFuZGluZykgKi9cbiAgbGF0ZXN0QmFzaE91dHB1dFVVSUQ/OiBzdHJpbmcgfCBudWxsXG59XG5cbmZ1bmN0aW9uIE1lc3NhZ2VJbXBsKHtcbiAgbWVzc2FnZSxcbiAgbG9va3VwcyxcbiAgY29udGFpbmVyV2lkdGgsXG4gIGFkZE1hcmdpbixcbiAgdG9vbHMsXG4gIGNvbW1hbmRzLFxuICB2ZXJib3NlLFxuICBpblByb2dyZXNzVG9vbFVzZUlEcyxcbiAgcHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2UsXG4gIHNob3VsZEFuaW1hdGUsXG4gIHNob3VsZFNob3dEb3QsXG4gIHN0eWxlLFxuICB3aWR0aCxcbiAgaXNUcmFuc2NyaXB0TW9kZSxcbiAgb25PcGVuUmF0ZUxpbWl0T3B0aW9ucyxcbiAgaXNBY3RpdmVDb2xsYXBzZWRHcm91cCxcbiAgaXNVc2VyQ29udGludWF0aW9uID0gZmFsc2UsXG4gIGxhc3RUaGlua2luZ0Jsb2NrSWQsXG4gIGxhdGVzdEJhc2hPdXRwdXRVVUlELFxufTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuICAgIGNhc2UgJ2F0dGFjaG1lbnQnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPEF0dGFjaG1lbnRNZXNzYWdlXG4gICAgICAgICAgYWRkTWFyZ2luPXthZGRNYXJnaW59XG4gICAgICAgICAgYXR0YWNobWVudD17bWVzc2FnZS5hdHRhY2htZW50fVxuICAgICAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICAgICAgaXNUcmFuc2NyaXB0TW9kZT17aXNUcmFuc2NyaXB0TW9kZX1cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICBjYXNlICdhc3Npc3RhbnQnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgd2lkdGg9e2NvbnRhaW5lcldpZHRoID8/ICcxMDAlJ30+XG4gICAgICAgICAge21lc3NhZ2UubWVzc2FnZS5jb250ZW50Lm1hcCgoXywgaW5kZXgpID0+IChcbiAgICAgICAgICAgIDxBc3Npc3RhbnRNZXNzYWdlQmxvY2tcbiAgICAgICAgICAgICAga2V5PXtpbmRleH1cbiAgICAgICAgICAgICAgcGFyYW09e199XG4gICAgICAgICAgICAgIGFkZE1hcmdpbj17YWRkTWFyZ2lufVxuICAgICAgICAgICAgICB0b29scz17dG9vbHN9XG4gICAgICAgICAgICAgIGNvbW1hbmRzPXtjb21tYW5kc31cbiAgICAgICAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgICAgICAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM9e2luUHJvZ3Jlc3NUb29sVXNlSURzfVxuICAgICAgICAgICAgICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZT17cHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2V9XG4gICAgICAgICAgICAgIHNob3VsZEFuaW1hdGU9e3Nob3VsZEFuaW1hdGV9XG4gICAgICAgICAgICAgIHNob3VsZFNob3dEb3Q9e3Nob3VsZFNob3dEb3R9XG4gICAgICAgICAgICAgIHdpZHRoPXt3aWR0aH1cbiAgICAgICAgICAgICAgaW5Qcm9ncmVzc1Rvb2xDYWxsQ291bnQ9e2luUHJvZ3Jlc3NUb29sVXNlSURzLnNpemV9XG4gICAgICAgICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2lzVHJhbnNjcmlwdE1vZGV9XG4gICAgICAgICAgICAgIGxvb2t1cHM9e2xvb2t1cHN9XG4gICAgICAgICAgICAgIG9uT3BlblJhdGVMaW1pdE9wdGlvbnM9e29uT3BlblJhdGVMaW1pdE9wdGlvbnN9XG4gICAgICAgICAgICAgIHRoaW5raW5nQmxvY2tJZD17YCR7bWVzc2FnZS51dWlkfToke2luZGV4fWB9XG4gICAgICAgICAgICAgIGxhc3RUaGlua2luZ0Jsb2NrSWQ9e2xhc3RUaGlua2luZ0Jsb2NrSWR9XG4gICAgICAgICAgICAgIGFkdmlzb3JNb2RlbD17bWVzc2FnZS5hZHZpc29yTW9kZWx9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICkpfVxuICAgICAgICA8L0JveD5cbiAgICAgIClcbiAgICBjYXNlICd1c2VyJzoge1xuICAgICAgaWYgKG1lc3NhZ2UuaXNDb21wYWN0U3VtbWFyeSkge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxDb21wYWN0U3VtbWFyeVxuICAgICAgICAgICAgbWVzc2FnZT17bWVzc2FnZX1cbiAgICAgICAgICAgIHNjcmVlbj17aXNUcmFuc2NyaXB0TW9kZSA/ICd0cmFuc2NyaXB0JyA6ICdwcm9tcHQnfVxuICAgICAgICAgIC8+XG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIC8vIFByZWNvbXB1dGUgdGhlIGltYWdlSW5kZXggcHJvcCBmb3IgZWFjaCBjb250ZW50IGJsb2NrLiBUaGUgcHJldmlvdXNcbiAgICAgIC8vIHZlcnNpb24gaW5jcmVtZW50ZWQgYSBjb3VudGVyIGluc2lkZSB0aGUgLm1hcCgpIGNhbGxiYWNrLCB3aGljaFxuICAgICAgLy8gUmVhY3QgQ29tcGlsZXIgYmFpbHMgb24gKFwiVXBkYXRlRXhwcmVzc2lvbiB0byB2YXJpYWJsZXMgY2FwdHVyZWRcbiAgICAgIC8vIHdpdGhpbiBsYW1iZGFzXCIpLiBBIHBsYWluIGZvciBsb29wIGtlZXBzIHRoZSBtdXRhdGlvbiBvdXQgb2YgYVxuICAgICAgLy8gY2xvc3VyZSBzbyB0aGUgY29tcGlsZXIgY2FuIG1lbW9pemUgTWVzc2FnZUltcGwuXG4gICAgICBjb25zdCBpbWFnZUluZGljZXM6IG51bWJlcltdID0gW11cbiAgICAgIGxldCBpbWFnZVBvc2l0aW9uID0gMFxuICAgICAgZm9yIChjb25zdCBwYXJhbSBvZiBtZXNzYWdlLm1lc3NhZ2UuY29udGVudCkge1xuICAgICAgICBpZiAocGFyYW0udHlwZSA9PT0gJ2ltYWdlJykge1xuICAgICAgICAgIGNvbnN0IGlkID0gbWVzc2FnZS5pbWFnZVBhc3RlSWRzPy5baW1hZ2VQb3NpdGlvbl1cbiAgICAgICAgICBpbWFnZVBvc2l0aW9uKytcbiAgICAgICAgICBpbWFnZUluZGljZXMucHVzaChpZCA/PyBpbWFnZVBvc2l0aW9uKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGltYWdlSW5kaWNlcy5wdXNoKGltYWdlUG9zaXRpb24pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIENoZWNrIGlmIHRoaXMgbWVzc2FnZSBpcyB0aGUgbGF0ZXN0IGJhc2ggb3V0cHV0IC0gaWYgc28sIHdyYXAgY29udGVudFxuICAgICAgLy8gd2l0aCBwcm92aWRlciBzbyBPdXRwdXRMaW5lIGNhbiBzaG93IGZ1bGwgb3V0cHV0IHZpYSBjb250ZXh0XG4gICAgICBjb25zdCBpc0xhdGVzdEJhc2hPdXRwdXQgPSBsYXRlc3RCYXNoT3V0cHV0VVVJRCA9PT0gbWVzc2FnZS51dWlkXG4gICAgICBjb25zdCBjb250ZW50ID0gKFxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD17Y29udGFpbmVyV2lkdGggPz8gJzEwMCUnfT5cbiAgICAgICAgICB7bWVzc2FnZS5tZXNzYWdlLmNvbnRlbnQubWFwKChwYXJhbSwgaW5kZXgpID0+IChcbiAgICAgICAgICAgIDxVc2VyTWVzc2FnZVxuICAgICAgICAgICAgICBrZXk9e2luZGV4fVxuICAgICAgICAgICAgICBtZXNzYWdlPXttZXNzYWdlfVxuICAgICAgICAgICAgICBhZGRNYXJnaW49e2FkZE1hcmdpbn1cbiAgICAgICAgICAgICAgdG9vbHM9e3Rvb2xzfVxuICAgICAgICAgICAgICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZT17cHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2V9XG4gICAgICAgICAgICAgIHBhcmFtPXtwYXJhbX1cbiAgICAgICAgICAgICAgc3R5bGU9e3N0eWxlfVxuICAgICAgICAgICAgICB2ZXJib3NlPXt2ZXJib3NlfVxuICAgICAgICAgICAgICBpbWFnZUluZGV4PXtpbWFnZUluZGljZXNbaW5kZXhdIX1cbiAgICAgICAgICAgICAgaXNVc2VyQ29udGludWF0aW9uPXtpc1VzZXJDb250aW51YXRpb259XG4gICAgICAgICAgICAgIGxvb2t1cHM9e2xvb2t1cHN9XG4gICAgICAgICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2lzVHJhbnNjcmlwdE1vZGV9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICkpfVxuICAgICAgICA8L0JveD5cbiAgICAgIClcbiAgICAgIHJldHVybiBpc0xhdGVzdEJhc2hPdXRwdXQgPyAoXG4gICAgICAgIDxFeHBhbmRTaGVsbE91dHB1dFByb3ZpZGVyPntjb250ZW50fTwvRXhwYW5kU2hlbGxPdXRwdXRQcm92aWRlcj5cbiAgICAgICkgOiAoXG4gICAgICAgIGNvbnRlbnRcbiAgICAgIClcbiAgICB9XG4gICAgY2FzZSAnc3lzdGVtJzpcbiAgICAgIGlmIChtZXNzYWdlLnN1YnR5cGUgPT09ICdjb21wYWN0X2JvdW5kYXJ5Jykge1xuICAgICAgICAvLyBGdWxsc2NyZWVuIGtlZXBzIHByZS1jb21wYWN0IG1lc3NhZ2VzIGluIHRoZSBTY3JvbGxCb3ggKFJFUEwudHN4XG4gICAgICAgIC8vIGFwcGVuZHMgaW5zdGVhZCBvZiByZXNldHRpbmcsIE1lc3NhZ2VzLnRzeCBza2lwcyB0aGUgYm91bmRhcnlcbiAgICAgICAgLy8gZmlsdGVyKSDigJQgc2Nyb2xsIHVwIGZvciBoaXN0b3J5LCBubyBuZWVkIGZvciB0aGUgY3RybCtvIGhpbnQuXG4gICAgICAgIGlmIChpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiA8Q29tcGFjdEJvdW5kYXJ5TWVzc2FnZSAvPlxuICAgICAgfVxuICAgICAgaWYgKG1lc3NhZ2Uuc3VidHlwZSA9PT0gJ21pY3JvY29tcGFjdF9ib3VuZGFyeScpIHtcbiAgICAgICAgLy8gTG9nZ2VkIGF0IGNyZWF0aW9uIHRpbWUgaW4gY3JlYXRlTWljcm9jb21wYWN0Qm91bmRhcnlNZXNzYWdlXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgICBpZiAoZmVhdHVyZSgnSElTVE9SWV9TTklQJykpIHtcbiAgICAgICAgLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgICBjb25zdCB7IGlzU25pcEJvdW5kYXJ5TWVzc2FnZSB9ID1cbiAgICAgICAgICByZXF1aXJlKCcuLi9zZXJ2aWNlcy9jb21wYWN0L3NuaXBQcm9qZWN0aW9uLmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi4vc2VydmljZXMvY29tcGFjdC9zbmlwUHJvamVjdGlvbi5qcycpXG4gICAgICAgIGNvbnN0IHsgaXNTbmlwTWFya2VyTWVzc2FnZSB9ID1cbiAgICAgICAgICByZXF1aXJlKCcuLi9zZXJ2aWNlcy9jb21wYWN0L3NuaXBDb21wYWN0LmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi4vc2VydmljZXMvY29tcGFjdC9zbmlwQ29tcGFjdC5qcycpXG4gICAgICAgIC8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgICBpZiAoaXNTbmlwQm91bmRhcnlNZXNzYWdlKG1lc3NhZ2UpKSB7XG4gICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgICAgIGNvbnN0IHsgU25pcEJvdW5kYXJ5TWVzc2FnZSB9ID1cbiAgICAgICAgICAgIHJlcXVpcmUoJy4vbWVzc2FnZXMvU25pcEJvdW5kYXJ5TWVzc2FnZS5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4vbWVzc2FnZXMvU25pcEJvdW5kYXJ5TWVzc2FnZS5qcycpXG4gICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gICAgICAgICAgcmV0dXJuIDxTbmlwQm91bmRhcnlNZXNzYWdlIG1lc3NhZ2U9e21lc3NhZ2V9IC8+XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzU25pcE1hcmtlck1lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICAgICAgICAvLyBJbnRlcm5hbCByZWdpc3RyYXRpb24gbWFya2VyIOKAlCBub3QgdXNlci1mYWNpbmcuIFRoZSBib3VuZGFyeVxuICAgICAgICAgIC8vIG1lc3NhZ2UgKGFib3ZlKSBpcyB3aGF0IHNob3dzIHdoZW4gc25pcHMgYWN0dWFsbHkgZXhlY3V0ZS5cbiAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAobWVzc2FnZS5zdWJ0eXBlID09PSAnbG9jYWxfY29tbWFuZCcpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8VXNlclRleHRNZXNzYWdlXG4gICAgICAgICAgICBhZGRNYXJnaW49e2FkZE1hcmdpbn1cbiAgICAgICAgICAgIHBhcmFtPXt7IHR5cGU6ICd0ZXh0JywgdGV4dDogbWVzc2FnZS5jb250ZW50IH19XG4gICAgICAgICAgICB2ZXJib3NlPXt2ZXJib3NlfVxuICAgICAgICAgICAgaXNUcmFuc2NyaXB0TW9kZT17aXNUcmFuc2NyaXB0TW9kZX1cbiAgICAgICAgICAvPlxuICAgICAgICApXG4gICAgICB9XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8U3lzdGVtVGV4dE1lc3NhZ2VcbiAgICAgICAgICBtZXNzYWdlPXttZXNzYWdlfVxuICAgICAgICAgIGFkZE1hcmdpbj17YWRkTWFyZ2lufVxuICAgICAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICAgICAgaXNUcmFuc2NyaXB0TW9kZT17aXNUcmFuc2NyaXB0TW9kZX1cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICBjYXNlICdncm91cGVkX3Rvb2xfdXNlJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxHcm91cGVkVG9vbFVzZUNvbnRlbnRcbiAgICAgICAgICBtZXNzYWdlPXttZXNzYWdlfVxuICAgICAgICAgIHRvb2xzPXt0b29sc31cbiAgICAgICAgICBsb29rdXBzPXtsb29rdXBzfVxuICAgICAgICAgIGluUHJvZ3Jlc3NUb29sVXNlSURzPXtpblByb2dyZXNzVG9vbFVzZUlEc31cbiAgICAgICAgICBzaG91bGRBbmltYXRlPXtzaG91bGRBbmltYXRlfVxuICAgICAgICAvPlxuICAgICAgKVxuICAgIGNhc2UgJ2NvbGxhcHNlZF9yZWFkX3NlYXJjaCc6XG4gICAgICAvLyBPZmZzY3JlZW5GcmVlemU6IHRoZSB2ZXJiIGZsaXBzIFwiUmVhZGluZ+KAplwi4oaSXCJSZWFkXCIgd2hlbiB0b29scyBjb21wbGV0ZS5cbiAgICAgIC8vIElmIHRoZSBncm91cCBoYXMgc2Nyb2xsZWQgaW50byBzY3JvbGxiYWNrIGJ5IHRoZW4sIHRoZSB1cGRhdGUgdHJpZ2dlcnNcbiAgICAgIC8vIGEgZnVsbCB0ZXJtaW5hbCByZXNldCAoQ0MtMTE1NSkuIFRoaXMgY29tcG9uZW50IGlzIG5ldmVyIG1hcmtlZCBzdGF0aWNcbiAgICAgIC8vIGluIHByb21wdCBtb2RlIChzaG91bGRSZW5kZXJTdGF0aWNhbGx5IHJldHVybnMgZmFsc2UgdG8gYWxsb3cgbGl2ZVxuICAgICAgLy8gdXBkYXRlcyBiZXR3ZWVuIEFQSSB0dXJucyksIHNvIHRoZSBtZW1vIGNhbid0IGhlbHAuIEZyZWV6ZSB3aGVuXG4gICAgICAvLyBvZmZzY3JlZW4g4oCUIHNjcm9sbGJhY2sgc2hvd3Mgd2hhdGV2ZXIgc3RhdGUgd2FzIHZpc2libGUgd2hlbiBpdCBsZWZ0LlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPE9mZnNjcmVlbkZyZWV6ZT5cbiAgICAgICAgICA8Q29sbGFwc2VkUmVhZFNlYXJjaENvbnRlbnRcbiAgICAgICAgICAgIG1lc3NhZ2U9e21lc3NhZ2V9XG4gICAgICAgICAgICBpblByb2dyZXNzVG9vbFVzZUlEcz17aW5Qcm9ncmVzc1Rvb2xVc2VJRHN9XG4gICAgICAgICAgICBzaG91bGRBbmltYXRlPXtzaG91bGRBbmltYXRlfVxuICAgICAgICAgICAgLy8gY3RybCtvIHRyYW5zY3JpcHQgbW9kZSBzaG91bGQgZXhwYW5kIHRoZSBncm91cCB0aGUgc2FtZSB3YXlcbiAgICAgICAgICAgIC8vIC0tdmVyYm9zZSBkb2VzLCBzbyByZWNhbGxlZCBtZW1vcmllcyArIHRvb2wgZGV0YWlscyBhcmUgdmlzaWJsZS5cbiAgICAgICAgICAgIC8vIEF0dGFjaG1lbnRNZXNzYWdlLnRzeCdzIHN0YW5kYWxvbmUgcmVsZXZhbnRfbWVtb3JpZXMgYnJhbmNoXG4gICAgICAgICAgICAvLyBhbHJlYWR5IGNoZWNrcyAodmVyYm9zZSB8fCBpc1RyYW5zY3JpcHRNb2RlKTsgdGhpcyBhbGlnbnMgdGhlXG4gICAgICAgICAgICAvLyBjb2xsYXBzZWQtZ3JvdXAgcGF0aCB0byBtYXRjaC5cbiAgICAgICAgICAgIHZlcmJvc2U9e3ZlcmJvc2UgfHwgaXNUcmFuc2NyaXB0TW9kZX1cbiAgICAgICAgICAgIHRvb2xzPXt0b29sc31cbiAgICAgICAgICAgIGxvb2t1cHM9e2xvb2t1cHN9XG4gICAgICAgICAgICBpc0FjdGl2ZUdyb3VwPXtpc0FjdGl2ZUNvbGxhcHNlZEdyb3VwfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvT2Zmc2NyZWVuRnJlZXplPlxuICAgICAgKVxuICB9XG59XG5cbmZ1bmN0aW9uIFVzZXJNZXNzYWdlKHtcbiAgbWVzc2FnZSxcbiAgYWRkTWFyZ2luLFxuICB0b29scyxcbiAgcHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2UsXG4gIHBhcmFtLFxuICBzdHlsZSxcbiAgdmVyYm9zZSxcbiAgaW1hZ2VJbmRleCxcbiAgaXNVc2VyQ29udGludWF0aW9uLFxuICBsb29rdXBzLFxuICBpc1RyYW5zY3JpcHRNb2RlLFxufToge1xuICBtZXNzYWdlOiBOb3JtYWxpemVkVXNlck1lc3NhZ2VcbiAgYWRkTWFyZ2luOiBib29sZWFuXG4gIHRvb2xzOiBUb29sc1xuICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZTogUHJvZ3Jlc3NNZXNzYWdlW11cbiAgcGFyYW06XG4gICAgfCBUZXh0QmxvY2tQYXJhbVxuICAgIHwgSW1hZ2VCbG9ja1BhcmFtXG4gICAgfCBUb29sVXNlQmxvY2tQYXJhbVxuICAgIHwgVG9vbFJlc3VsdEJsb2NrUGFyYW1cbiAgc3R5bGU/OiAnY29uZGVuc2VkJ1xuICB2ZXJib3NlOiBib29sZWFuXG4gIGltYWdlSW5kZXg/OiBudW1iZXJcbiAgaXNVc2VyQ29udGludWF0aW9uOiBib29sZWFuXG4gIGxvb2t1cHM6IFJldHVyblR5cGU8dHlwZW9mIGJ1aWxkTWVzc2FnZUxvb2t1cHM+XG4gIGlzVHJhbnNjcmlwdE1vZGU6IGJvb2xlYW5cbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCB7IGNvbHVtbnMgfSA9IHVzZVRlcm1pbmFsU2l6ZSgpXG4gIHN3aXRjaCAocGFyYW0udHlwZSkge1xuICAgIGNhc2UgJ3RleHQnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPFVzZXJUZXh0TWVzc2FnZVxuICAgICAgICAgIGFkZE1hcmdpbj17YWRkTWFyZ2lufVxuICAgICAgICAgIHBhcmFtPXtwYXJhbX1cbiAgICAgICAgICB2ZXJib3NlPXt2ZXJib3NlfVxuICAgICAgICAgIHBsYW5Db250ZW50PXttZXNzYWdlLnBsYW5Db250ZW50fVxuICAgICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2lzVHJhbnNjcmlwdE1vZGV9XG4gICAgICAgICAgdGltZXN0YW1wPXttZXNzYWdlLnRpbWVzdGFtcH1cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICBjYXNlICdpbWFnZSc6XG4gICAgICAvLyBJZiBwcmV2aW91cyBtZXNzYWdlIGlzIHVzZXIgKHRleHQgb3IgaW1hZ2UpLCB0aGlzIGlzIGEgY29udGludWF0aW9uIC0gdXNlIGNvbm5lY3RvclxuICAgICAgLy8gT3RoZXJ3aXNlIHRoaXMgaW1hZ2Ugc3RhcnRzIGEgbmV3IHVzZXIgdHVybiAtIHVzZSBtYXJnaW5cbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxVc2VySW1hZ2VNZXNzYWdlXG4gICAgICAgICAgaW1hZ2VJZD17aW1hZ2VJbmRleH1cbiAgICAgICAgICBhZGRNYXJnaW49e2FkZE1hcmdpbiAmJiAhaXNVc2VyQ29udGludWF0aW9ufVxuICAgICAgICAvPlxuICAgICAgKVxuICAgIGNhc2UgJ3Rvb2xfcmVzdWx0JzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxVc2VyVG9vbFJlc3VsdE1lc3NhZ2VcbiAgICAgICAgICBwYXJhbT17cGFyYW19XG4gICAgICAgICAgbWVzc2FnZT17bWVzc2FnZX1cbiAgICAgICAgICBsb29rdXBzPXtsb29rdXBzfVxuICAgICAgICAgIHByb2dyZXNzTWVzc2FnZXNGb3JNZXNzYWdlPXtwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZX1cbiAgICAgICAgICBzdHlsZT17c3R5bGV9XG4gICAgICAgICAgdG9vbHM9e3Rvb2xzfVxuICAgICAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICAgICAgd2lkdGg9e2NvbHVtbnMgLSA1fVxuICAgICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2lzVHJhbnNjcmlwdE1vZGV9XG4gICAgICAgIC8+XG4gICAgICApXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgfVxufVxuXG5mdW5jdGlvbiBBc3Npc3RhbnRNZXNzYWdlQmxvY2soe1xuICBwYXJhbSxcbiAgYWRkTWFyZ2luLFxuICB0b29scyxcbiAgY29tbWFuZHMsXG4gIHZlcmJvc2UsXG4gIGluUHJvZ3Jlc3NUb29sVXNlSURzLFxuICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZSxcbiAgc2hvdWxkQW5pbWF0ZSxcbiAgc2hvdWxkU2hvd0RvdCxcbiAgd2lkdGgsXG4gIGluUHJvZ3Jlc3NUb29sQ2FsbENvdW50LFxuICBpc1RyYW5zY3JpcHRNb2RlLFxuICBsb29rdXBzLFxuICBvbk9wZW5SYXRlTGltaXRPcHRpb25zLFxuICB0aGlua2luZ0Jsb2NrSWQsXG4gIGxhc3RUaGlua2luZ0Jsb2NrSWQsXG4gIGFkdmlzb3JNb2RlbCxcbn06IHtcbiAgcGFyYW06XG4gICAgfCBCZXRhQ29udGVudEJsb2NrXG4gICAgfCBDb25uZWN0b3JUZXh0QmxvY2tcbiAgICB8IEFkdmlzb3JCbG9ja1xuICAgIHwgVGV4dEJsb2NrUGFyYW1cbiAgICB8IEltYWdlQmxvY2tQYXJhbVxuICAgIHwgVGhpbmtpbmdCbG9ja1BhcmFtXG4gICAgfCBUb29sVXNlQmxvY2tQYXJhbVxuICAgIHwgVG9vbFJlc3VsdEJsb2NrUGFyYW1cbiAgYWRkTWFyZ2luOiBib29sZWFuXG4gIHRvb2xzOiBUb29sc1xuICBjb21tYW5kczogQ29tbWFuZFtdXG4gIHZlcmJvc2U6IGJvb2xlYW5cbiAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM6IFNldDxzdHJpbmc+XG4gIHByb2dyZXNzTWVzc2FnZXNGb3JNZXNzYWdlOiBQcm9ncmVzc01lc3NhZ2VbXVxuICBzaG91bGRBbmltYXRlOiBib29sZWFuXG4gIHNob3VsZFNob3dEb3Q6IGJvb2xlYW5cbiAgd2lkdGg/OiBudW1iZXIgfCBzdHJpbmdcbiAgaW5Qcm9ncmVzc1Rvb2xDYWxsQ291bnQ/OiBudW1iZXJcbiAgaXNUcmFuc2NyaXB0TW9kZTogYm9vbGVhblxuICBsb29rdXBzOiBSZXR1cm5UeXBlPHR5cGVvZiBidWlsZE1lc3NhZ2VMb29rdXBzPlxuICBvbk9wZW5SYXRlTGltaXRPcHRpb25zPzogKCkgPT4gdm9pZFxuICAvKiogSUQgb2YgdGhpcyBjb250ZW50IGJsb2NrJ3MgbWVzc2FnZTppbmRleCBmb3IgdGhpbmtpbmcgYmxvY2sgY29tcGFyaXNvbiAqL1xuICB0aGlua2luZ0Jsb2NrSWQ6IHN0cmluZ1xuICAvKiogSUQgb2YgdGhlIGxhc3QgdGhpbmtpbmcgYmxvY2sgdG8gc2hvdywgbnVsbCBtZWFucyBzaG93IGFsbCAqL1xuICBsYXN0VGhpbmtpbmdCbG9ja0lkPzogc3RyaW5nIHwgbnVsbFxuICBhZHZpc29yTW9kZWw/OiBzdHJpbmdcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBpZiAoZmVhdHVyZSgnQ09OTkVDVE9SX1RFWFQnKSkge1xuICAgIGlmIChpc0Nvbm5lY3RvclRleHRCbG9jayhwYXJhbSkpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxBc3Npc3RhbnRUZXh0TWVzc2FnZVxuICAgICAgICAgIHBhcmFtPXt7IHR5cGU6ICd0ZXh0JywgdGV4dDogcGFyYW0uY29ubmVjdG9yX3RleHQgfX1cbiAgICAgICAgICBhZGRNYXJnaW49e2FkZE1hcmdpbn1cbiAgICAgICAgICBzaG91bGRTaG93RG90PXtzaG91bGRTaG93RG90fVxuICAgICAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICAgICAgd2lkdGg9e3dpZHRofVxuICAgICAgICAgIG9uT3BlblJhdGVMaW1pdE9wdGlvbnM9e29uT3BlblJhdGVMaW1pdE9wdGlvbnN9XG4gICAgICAgIC8+XG4gICAgICApXG4gICAgfVxuICB9XG4gIHN3aXRjaCAocGFyYW0udHlwZSkge1xuICAgIGNhc2UgJ3Rvb2xfdXNlJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxBc3Npc3RhbnRUb29sVXNlTWVzc2FnZVxuICAgICAgICAgIHBhcmFtPXtwYXJhbX1cbiAgICAgICAgICBhZGRNYXJnaW49e2FkZE1hcmdpbn1cbiAgICAgICAgICB0b29scz17dG9vbHN9XG4gICAgICAgICAgY29tbWFuZHM9e2NvbW1hbmRzfVxuICAgICAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICAgICAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM9e2luUHJvZ3Jlc3NUb29sVXNlSURzfVxuICAgICAgICAgIHByb2dyZXNzTWVzc2FnZXNGb3JNZXNzYWdlPXtwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZX1cbiAgICAgICAgICBzaG91bGRBbmltYXRlPXtzaG91bGRBbmltYXRlfVxuICAgICAgICAgIHNob3VsZFNob3dEb3Q9e3Nob3VsZFNob3dEb3R9XG4gICAgICAgICAgaW5Qcm9ncmVzc1Rvb2xDYWxsQ291bnQ9e2luUHJvZ3Jlc3NUb29sQ2FsbENvdW50fVxuICAgICAgICAgIGxvb2t1cHM9e2xvb2t1cHN9XG4gICAgICAgICAgaXNUcmFuc2NyaXB0TW9kZT17aXNUcmFuc2NyaXB0TW9kZX1cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICBjYXNlICd0ZXh0JzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxBc3Npc3RhbnRUZXh0TWVzc2FnZVxuICAgICAgICAgIHBhcmFtPXtwYXJhbX1cbiAgICAgICAgICBhZGRNYXJnaW49e2FkZE1hcmdpbn1cbiAgICAgICAgICBzaG91bGRTaG93RG90PXtzaG91bGRTaG93RG90fVxuICAgICAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICAgICAgd2lkdGg9e3dpZHRofVxuICAgICAgICAgIG9uT3BlblJhdGVMaW1pdE9wdGlvbnM9e29uT3BlblJhdGVMaW1pdE9wdGlvbnN9XG4gICAgICAgIC8+XG4gICAgICApXG4gICAgY2FzZSAncmVkYWN0ZWRfdGhpbmtpbmcnOlxuICAgICAgaWYgKCFpc1RyYW5zY3JpcHRNb2RlICYmICF2ZXJib3NlKSB7XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgICByZXR1cm4gPEFzc2lzdGFudFJlZGFjdGVkVGhpbmtpbmdNZXNzYWdlIGFkZE1hcmdpbj17YWRkTWFyZ2lufSAvPlxuICAgIGNhc2UgJ3RoaW5raW5nJzoge1xuICAgICAgaWYgKCFpc1RyYW5zY3JpcHRNb2RlICYmICF2ZXJib3NlKSB7XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgICAvLyBJbiB0cmFuc2NyaXB0IG1vZGUgd2l0aCBoaWRlUGFzdFRoaW5raW5nLCBvbmx5IHNob3cgdGhlIGxhc3QgdGhpbmtpbmcgYmxvY2tcbiAgICAgIGNvbnN0IGlzTGFzdFRoaW5raW5nID1cbiAgICAgICAgIWxhc3RUaGlua2luZ0Jsb2NrSWQgfHwgdGhpbmtpbmdCbG9ja0lkID09PSBsYXN0VGhpbmtpbmdCbG9ja0lkXG4gICAgICByZXR1cm4gKFxuICAgICAgICA8QXNzaXN0YW50VGhpbmtpbmdNZXNzYWdlXG4gICAgICAgICAgYWRkTWFyZ2luPXthZGRNYXJnaW59XG4gICAgICAgICAgcGFyYW09e3BhcmFtfVxuICAgICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2lzVHJhbnNjcmlwdE1vZGV9XG4gICAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgICBoaWRlSW5UcmFuc2NyaXB0PXtpc1RyYW5zY3JpcHRNb2RlICYmICFpc0xhc3RUaGlua2luZ31cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICB9XG4gICAgY2FzZSAnc2VydmVyX3Rvb2xfdXNlJzpcbiAgICBjYXNlICdhZHZpc29yX3Rvb2xfcmVzdWx0JzpcbiAgICAgIGlmIChpc0Fkdmlzb3JCbG9jayhwYXJhbSkpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8QWR2aXNvck1lc3NhZ2VcbiAgICAgICAgICAgIGJsb2NrPXtwYXJhbX1cbiAgICAgICAgICAgIGFkZE1hcmdpbj17YWRkTWFyZ2lufVxuICAgICAgICAgICAgcmVzb2x2ZWRUb29sVXNlSURzPXtsb29rdXBzLnJlc29sdmVkVG9vbFVzZUlEc31cbiAgICAgICAgICAgIGVycm9yZWRUb29sVXNlSURzPXtsb29rdXBzLmVycm9yZWRUb29sVXNlSURzfVxuICAgICAgICAgICAgc2hvdWxkQW5pbWF0ZT17c2hvdWxkQW5pbWF0ZX1cbiAgICAgICAgICAgIHZlcmJvc2U9e3ZlcmJvc2UgfHwgaXNUcmFuc2NyaXB0TW9kZX1cbiAgICAgICAgICAgIGFkdmlzb3JNb2RlbD17YWR2aXNvck1vZGVsfVxuICAgICAgICAgIC8+XG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGxvZ0Vycm9yKG5ldyBFcnJvcihgVW5hYmxlIHRvIHJlbmRlciBzZXJ2ZXIgdG9vbCBibG9jazogJHtwYXJhbS50eXBlfWApKVxuICAgICAgcmV0dXJuIG51bGxcbiAgICBkZWZhdWx0OlxuICAgICAgbG9nRXJyb3IobmV3IEVycm9yKGBVbmFibGUgdG8gcmVuZGVyIG1lc3NhZ2UgdHlwZTogJHtwYXJhbS50eXBlfWApKVxuICAgICAgcmV0dXJuIG51bGxcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzVGhpbmtpbmdDb250ZW50KG06IHtcbiAgdHlwZTogc3RyaW5nXG4gIG1lc3NhZ2U/OiB7IGNvbnRlbnQ6IEFycmF5PHsgdHlwZTogc3RyaW5nIH0+IH1cbn0pOiBib29sZWFuIHtcbiAgaWYgKG0udHlwZSAhPT0gJ2Fzc2lzdGFudCcgfHwgIW0ubWVzc2FnZSkgcmV0dXJuIGZhbHNlXG4gIHJldHVybiBtLm1lc3NhZ2UuY29udGVudC5zb21lKFxuICAgIGIgPT4gYi50eXBlID09PSAndGhpbmtpbmcnIHx8IGIudHlwZSA9PT0gJ3JlZGFjdGVkX3RoaW5raW5nJyxcbiAgKVxufVxuXG4vKiogRXhwb3J0ZWQgZm9yIHRlc3RpbmcgKi9cbmV4cG9ydCBmdW5jdGlvbiBhcmVNZXNzYWdlUHJvcHNFcXVhbChwcmV2OiBQcm9wcywgbmV4dDogUHJvcHMpOiBib29sZWFuIHtcbiAgaWYgKHByZXYubWVzc2FnZS51dWlkICE9PSBuZXh0Lm1lc3NhZ2UudXVpZCkgcmV0dXJuIGZhbHNlXG4gIC8vIE9ubHkgcmUtcmVuZGVyIG9uIGxhc3RUaGlua2luZ0Jsb2NrSWQgY2hhbmdlIGlmIHRoaXMgbWVzc2FnZSBhY3R1YWxseVxuICAvLyBoYXMgdGhpbmtpbmcgY29udGVudCDigJQgb3RoZXJ3aXNlIGV2ZXJ5IG1lc3NhZ2UgaW4gc2Nyb2xsYmFjayByZS1yZW5kZXJzXG4gIC8vIHdoZW5ldmVyIHN0cmVhbWluZyB0aGlua2luZyBzdGFydHMvc3RvcHMgKENDLTk0MSkuXG4gIGlmIChcbiAgICBwcmV2Lmxhc3RUaGlua2luZ0Jsb2NrSWQgIT09IG5leHQubGFzdFRoaW5raW5nQmxvY2tJZCAmJlxuICAgIGhhc1RoaW5raW5nQ29udGVudChuZXh0Lm1lc3NhZ2UpXG4gICkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIC8vIFZlcmJvc2UgdG9nZ2xlIGNoYW5nZXMgdGhpbmtpbmcgYmxvY2sgdmlzaWJpbGl0eS9leHBhbnNpb25cbiAgaWYgKHByZXYudmVyYm9zZSAhPT0gbmV4dC52ZXJib3NlKSByZXR1cm4gZmFsc2VcbiAgLy8gT25seSByZS1yZW5kZXIgaWYgdGhpcyBtZXNzYWdlJ3MgXCJpcyBsYXRlc3QgYmFzaCBvdXRwdXRcIiBzdGF0dXMgY2hhbmdlZCxcbiAgLy8gbm90IHdoZW4gdGhlIGdsb2JhbCBsYXRlc3RCYXNoT3V0cHV0VVVJRCBjaGFuZ2VzIHRvIGEgZGlmZmVyZW50IG1lc3NhZ2VcbiAgY29uc3QgcHJldklzTGF0ZXN0ID0gcHJldi5sYXRlc3RCYXNoT3V0cHV0VVVJRCA9PT0gcHJldi5tZXNzYWdlLnV1aWRcbiAgY29uc3QgbmV4dElzTGF0ZXN0ID0gbmV4dC5sYXRlc3RCYXNoT3V0cHV0VVVJRCA9PT0gbmV4dC5tZXNzYWdlLnV1aWRcbiAgaWYgKHByZXZJc0xhdGVzdCAhPT0gbmV4dElzTGF0ZXN0KSByZXR1cm4gZmFsc2VcbiAgaWYgKHByZXYuaXNUcmFuc2NyaXB0TW9kZSAhPT0gbmV4dC5pc1RyYW5zY3JpcHRNb2RlKSByZXR1cm4gZmFsc2VcbiAgLy8gY29udGFpbmVyV2lkdGggaXMgYW4gYWJzb2x1dGUgbnVtYmVyIGluIHRoZSBuby1tZXRhZGF0YSBwYXRoICh3cmFwcGVyXG4gIC8vIEJveCBpcyBza2lwcGVkKS4gU3RhdGljIG1lc3NhZ2VzIG11c3QgcmUtcmVuZGVyIG9uIHRlcm1pbmFsIHJlc2l6ZS5cbiAgaWYgKHByZXYuY29udGFpbmVyV2lkdGggIT09IG5leHQuY29udGFpbmVyV2lkdGgpIHJldHVybiBmYWxzZVxuICBpZiAocHJldi5pc1N0YXRpYyAmJiBuZXh0LmlzU3RhdGljKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gZmFsc2Vcbn1cblxuZXhwb3J0IGNvbnN0IE1lc3NhZ2UgPSBSZWFjdC5tZW1vKE1lc3NhZ2VJbXBsLCBhcmVNZXNzYWdlUHJvcHNFcXVhbClcbiJdLCJtYXBwaW5ncyI6IjtBQUFBLFNBQVNBLE9BQU8sUUFBUSxZQUFZO0FBQ3BDLGNBQWNDLGdCQUFnQixRQUFRLHdEQUF3RDtBQUM5RixjQUNFQyxlQUFlLEVBQ2ZDLGNBQWMsRUFDZEMsa0JBQWtCLEVBQ2xCQyxvQkFBb0IsRUFDcEJDLGlCQUFpQixRQUNaLHVDQUF1QztBQUM5QyxPQUFPLEtBQUtDLEtBQUssTUFBTSxPQUFPO0FBQzlCLGNBQWNDLE9BQU8sUUFBUSxnQkFBZ0I7QUFDN0MsU0FBU0MsZUFBZSxRQUFRLDZCQUE2QjtBQUM3RCxTQUFTQyxHQUFHLFFBQVEsV0FBVztBQUMvQixjQUFjQyxLQUFLLFFBQVEsWUFBWTtBQUN2QyxTQUNFLEtBQUtDLGtCQUFrQixFQUN2QkMsb0JBQW9CLFFBQ2YsMkJBQTJCO0FBQ2xDLGNBQ0VDLGdCQUFnQixFQUNoQkMsaUJBQWlCLElBQUlDLHFCQUFxQixFQUMxQ0Msd0JBQXdCLElBQUlDLDRCQUE0QixFQUN4REMscUJBQXFCLElBQUlDLHlCQUF5QixFQUNsREMscUJBQXFCLEVBQ3JCQyxlQUFlLEVBQ2ZDLGFBQWEsUUFDUixxQkFBcUI7QUFDNUIsU0FBUyxLQUFLQyxZQUFZLEVBQUVDLGNBQWMsUUFBUSxxQkFBcUI7QUFDdkUsU0FBU0Msc0JBQXNCLFFBQVEsd0JBQXdCO0FBQy9ELFNBQVNDLFFBQVEsUUFBUSxpQkFBaUI7QUFDMUMsY0FBY0MsbUJBQW1CLFFBQVEsc0JBQXNCO0FBQy9ELFNBQVNDLGNBQWMsUUFBUSxxQkFBcUI7QUFDcEQsU0FBU0MsY0FBYyxRQUFRLDhCQUE4QjtBQUM3RCxTQUFTQyxnQ0FBZ0MsUUFBUSxnREFBZ0Q7QUFDakcsU0FBU0Msb0JBQW9CLFFBQVEsb0NBQW9DO0FBQ3pFLFNBQVNDLHdCQUF3QixRQUFRLHdDQUF3QztBQUNqRixTQUFTQyx1QkFBdUIsUUFBUSx1Q0FBdUM7QUFDL0UsU0FBU25CLGlCQUFpQixRQUFRLGlDQUFpQztBQUNuRSxTQUFTb0IsMEJBQTBCLFFBQVEsMENBQTBDO0FBQ3JGLFNBQVNDLHNCQUFzQixRQUFRLHNDQUFzQztBQUM3RSxTQUFTQyxxQkFBcUIsUUFBUSxxQ0FBcUM7QUFDM0UsU0FBU0MsaUJBQWlCLFFBQVEsaUNBQWlDO0FBQ25FLFNBQVNDLGdCQUFnQixRQUFRLGdDQUFnQztBQUNqRSxTQUFTQyxlQUFlLFFBQVEsK0JBQStCO0FBQy9ELFNBQVNDLHFCQUFxQixRQUFRLDJEQUEyRDtBQUNqRyxTQUFTQyxlQUFlLFFBQVEsc0JBQXNCO0FBQ3RELFNBQVNDLHlCQUF5QixRQUFRLHFDQUFxQztBQUUvRSxPQUFPLEtBQUtDLEtBQUssR0FBRztFQUNsQkMsT0FBTyxFQUNIeEIscUJBQXFCLEdBQ3JCUCxnQkFBZ0IsR0FDaEJFLHFCQUFxQixHQUNyQk8sYUFBYSxHQUNiSCx5QkFBeUIsR0FDekJGLDRCQUE0QjtFQUNoQzRCLE9BQU8sRUFBRUMsVUFBVSxDQUFDLE9BQU9uQixtQkFBbUIsQ0FBQztFQUMvQztFQUNBO0VBQ0FvQixjQUFjLENBQUMsRUFBRSxNQUFNO0VBQ3ZCQyxTQUFTLEVBQUUsT0FBTztFQUNsQkMsS0FBSyxFQUFFdkMsS0FBSztFQUNad0MsUUFBUSxFQUFFM0MsT0FBTyxFQUFFO0VBQ25CNEMsT0FBTyxFQUFFLE9BQU87RUFDaEJDLG9CQUFvQixFQUFFQyxHQUFHLENBQUMsTUFBTSxDQUFDO0VBQ2pDQywwQkFBMEIsRUFBRWpDLGVBQWUsRUFBRTtFQUM3Q2tDLGFBQWEsRUFBRSxPQUFPO0VBQ3RCQyxhQUFhLEVBQUUsT0FBTztFQUN0QkMsS0FBSyxDQUFDLEVBQUUsV0FBVztFQUNuQkMsS0FBSyxDQUFDLEVBQUUsTUFBTSxHQUFHLE1BQU07RUFDdkJDLGdCQUFnQixFQUFFLE9BQU87RUFDekJDLFFBQVEsRUFBRSxPQUFPO0VBQ2pCQyxzQkFBc0IsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJO0VBQ25DQyxzQkFBc0IsQ0FBQyxFQUFFLE9BQU87RUFDaENDLGtCQUFrQixDQUFDLEVBQUUsT0FBTztFQUM1QjtFQUNBQyxtQkFBbUIsQ0FBQyxFQUFFLE1BQU0sR0FBRyxJQUFJO0VBQ25DO0VBQ0FDLG9CQUFvQixDQUFDLEVBQUUsTUFBTSxHQUFHLElBQUk7QUFDdEMsQ0FBQztBQUVELFNBQUFDLFlBQUFDLEVBQUE7RUFBQSxNQUFBQyxDQUFBLEdBQUFDLEVBQUE7RUFBcUI7SUFBQXpCLE9BQUE7SUFBQUMsT0FBQTtJQUFBRSxjQUFBO0lBQUFDLFNBQUE7SUFBQUMsS0FBQTtJQUFBQyxRQUFBO0lBQUFDLE9BQUE7SUFBQUMsb0JBQUE7SUFBQUUsMEJBQUE7SUFBQUMsYUFBQTtJQUFBQyxhQUFBO0lBQUFDLEtBQUE7SUFBQUMsS0FBQTtJQUFBQyxnQkFBQTtJQUFBRSxzQkFBQTtJQUFBQyxzQkFBQTtJQUFBQyxrQkFBQSxFQUFBTyxFQUFBO0lBQUFOLG1CQUFBO0lBQUFDO0VBQUEsSUFBQUUsRUFvQmI7RUFITixNQUFBSixrQkFBQSxHQUFBTyxFQUEwQixLQUExQkMsU0FBMEIsR0FBMUIsS0FBMEIsR0FBMUJELEVBQTBCO0VBSTFCLFFBQVExQixPQUFPLENBQUE0QixJQUFLO0lBQUEsS0FDYixZQUFZO01BQUE7UUFBQSxJQUFBQyxFQUFBO1FBQUEsSUFBQUwsQ0FBQSxRQUFBcEIsU0FBQSxJQUFBb0IsQ0FBQSxRQUFBVCxnQkFBQSxJQUFBUyxDQUFBLFFBQUF4QixPQUFBLENBQUE4QixVQUFBLElBQUFOLENBQUEsUUFBQWpCLE9BQUE7VUFFYnNCLEVBQUEsSUFBQyxpQkFBaUIsQ0FDTHpCLFNBQVMsQ0FBVEEsVUFBUSxDQUFDLENBQ1IsVUFBa0IsQ0FBbEIsQ0FBQUosT0FBTyxDQUFBOEIsVUFBVSxDQUFDLENBQ3JCdkIsT0FBTyxDQUFQQSxRQUFNLENBQUMsQ0FDRVEsZ0JBQWdCLENBQWhCQSxpQkFBZSxDQUFDLEdBQ2xDO1VBQUFTLENBQUEsTUFBQXBCLFNBQUE7VUFBQW9CLENBQUEsTUFBQVQsZ0JBQUE7VUFBQVMsQ0FBQSxNQUFBeEIsT0FBQSxDQUFBOEIsVUFBQTtVQUFBTixDQUFBLE1BQUFqQixPQUFBO1VBQUFpQixDQUFBLE1BQUFLLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFMLENBQUE7UUFBQTtRQUFBLE9BTEZLLEVBS0U7TUFBQTtJQUFBLEtBRUQsV0FBVztNQUFBO1FBRXVCLE1BQUFBLEVBQUEsR0FBQTFCLGNBQXdCLElBQXhCLE1BQXdCO1FBQUEsSUFBQTRCLEVBQUE7UUFBQSxJQUFBUCxDQUFBLFFBQUFwQixTQUFBLElBQUFvQixDQUFBLFFBQUFsQixRQUFBLElBQUFrQixDQUFBLFFBQUFoQixvQkFBQSxJQUFBZ0IsQ0FBQSxRQUFBVCxnQkFBQSxJQUFBUyxDQUFBLFFBQUFKLG1CQUFBLElBQUFJLENBQUEsU0FBQXZCLE9BQUEsSUFBQXVCLENBQUEsU0FBQXhCLE9BQUEsQ0FBQWdDLFlBQUEsSUFBQVIsQ0FBQSxTQUFBeEIsT0FBQSxDQUFBQSxPQUFBLENBQUFpQyxPQUFBLElBQUFULENBQUEsU0FBQXhCLE9BQUEsQ0FBQWtDLElBQUEsSUFBQVYsQ0FBQSxTQUFBUCxzQkFBQSxJQUFBTyxDQUFBLFNBQUFkLDBCQUFBLElBQUFjLENBQUEsU0FBQWIsYUFBQSxJQUFBYSxDQUFBLFNBQUFaLGFBQUEsSUFBQVksQ0FBQSxTQUFBbkIsS0FBQSxJQUFBbUIsQ0FBQSxTQUFBakIsT0FBQSxJQUFBaUIsQ0FBQSxTQUFBVixLQUFBO1VBQUEsSUFBQXFCLEVBQUE7VUFBQSxJQUFBWCxDQUFBLFNBQUFwQixTQUFBLElBQUFvQixDQUFBLFNBQUFsQixRQUFBLElBQUFrQixDQUFBLFNBQUFoQixvQkFBQSxJQUFBZ0IsQ0FBQSxTQUFBVCxnQkFBQSxJQUFBUyxDQUFBLFNBQUFKLG1CQUFBLElBQUFJLENBQUEsU0FBQXZCLE9BQUEsSUFBQXVCLENBQUEsU0FBQXhCLE9BQUEsQ0FBQWdDLFlBQUEsSUFBQVIsQ0FBQSxTQUFBeEIsT0FBQSxDQUFBa0MsSUFBQSxJQUFBVixDQUFBLFNBQUFQLHNCQUFBLElBQUFPLENBQUEsU0FBQWQsMEJBQUEsSUFBQWMsQ0FBQSxTQUFBYixhQUFBLElBQUFhLENBQUEsU0FBQVosYUFBQSxJQUFBWSxDQUFBLFNBQUFuQixLQUFBLElBQUFtQixDQUFBLFNBQUFqQixPQUFBLElBQUFpQixDQUFBLFNBQUFWLEtBQUE7WUFDNUJxQixFQUFBLEdBQUFBLENBQUFDLENBQUEsRUFBQUMsT0FBQSxLQUMzQixDQUFDLHFCQUFxQixDQUNmQyxHQUFLLENBQUxBLFFBQUksQ0FBQyxDQUNIRixLQUFDLENBQURBLEVBQUEsQ0FBQyxDQUNHaEMsU0FBUyxDQUFUQSxVQUFRLENBQUMsQ0FDYkMsS0FBSyxDQUFMQSxNQUFJLENBQUMsQ0FDRkMsUUFBUSxDQUFSQSxTQUFPLENBQUMsQ0FDVEMsT0FBTyxDQUFQQSxRQUFNLENBQUMsQ0FDTUMsb0JBQW9CLENBQXBCQSxxQkFBbUIsQ0FBQyxDQUNkRSwwQkFBMEIsQ0FBMUJBLDJCQUF5QixDQUFDLENBQ3ZDQyxhQUFhLENBQWJBLGNBQVksQ0FBQyxDQUNiQyxhQUFhLENBQWJBLGNBQVksQ0FBQyxDQUNyQkUsS0FBSyxDQUFMQSxNQUFJLENBQUMsQ0FDYSx1QkFBeUIsQ0FBekIsQ0FBQU4sb0JBQW9CLENBQUErQixJQUFJLENBQUMsQ0FDaEN4QixnQkFBZ0IsQ0FBaEJBLGlCQUFlLENBQUMsQ0FDekJkLE9BQU8sQ0FBUEEsUUFBTSxDQUFDLENBQ1FnQixzQkFBc0IsQ0FBdEJBLHVCQUFxQixDQUFDLENBQzdCLGVBQTBCLENBQTFCLElBQUdqQixPQUFPLENBQUFrQyxJQUFLLElBQUlJLE9BQUssRUFBQyxDQUFDLENBQ3RCbEIsbUJBQW1CLENBQW5CQSxvQkFBa0IsQ0FBQyxDQUMxQixZQUFvQixDQUFwQixDQUFBcEIsT0FBTyxDQUFBZ0MsWUFBWSxDQUFDLEdBRXJDO1lBQUFSLENBQUEsT0FBQXBCLFNBQUE7WUFBQW9CLENBQUEsT0FBQWxCLFFBQUE7WUFBQWtCLENBQUEsT0FBQWhCLG9CQUFBO1lBQUFnQixDQUFBLE9BQUFULGdCQUFBO1lBQUFTLENBQUEsT0FBQUosbUJBQUE7WUFBQUksQ0FBQSxPQUFBdkIsT0FBQTtZQUFBdUIsQ0FBQSxPQUFBeEIsT0FBQSxDQUFBZ0MsWUFBQTtZQUFBUixDQUFBLE9BQUF4QixPQUFBLENBQUFrQyxJQUFBO1lBQUFWLENBQUEsT0FBQVAsc0JBQUE7WUFBQU8sQ0FBQSxPQUFBZCwwQkFBQTtZQUFBYyxDQUFBLE9BQUFiLGFBQUE7WUFBQWEsQ0FBQSxPQUFBWixhQUFBO1lBQUFZLENBQUEsT0FBQW5CLEtBQUE7WUFBQW1CLENBQUEsT0FBQWpCLE9BQUE7WUFBQWlCLENBQUEsT0FBQVYsS0FBQTtZQUFBVSxDQUFBLE9BQUFXLEVBQUE7VUFBQTtZQUFBQSxFQUFBLEdBQUFYLENBQUE7VUFBQTtVQXJCQU8sRUFBQSxHQUFBL0IsT0FBTyxDQUFBQSxPQUFRLENBQUFpQyxPQUFRLENBQUFPLEdBQUksQ0FBQ0wsRUFxQjVCLENBQUM7VUFBQVgsQ0FBQSxNQUFBcEIsU0FBQTtVQUFBb0IsQ0FBQSxNQUFBbEIsUUFBQTtVQUFBa0IsQ0FBQSxNQUFBaEIsb0JBQUE7VUFBQWdCLENBQUEsTUFBQVQsZ0JBQUE7VUFBQVMsQ0FBQSxNQUFBSixtQkFBQTtVQUFBSSxDQUFBLE9BQUF2QixPQUFBO1VBQUF1QixDQUFBLE9BQUF4QixPQUFBLENBQUFnQyxZQUFBO1VBQUFSLENBQUEsT0FBQXhCLE9BQUEsQ0FBQUEsT0FBQSxDQUFBaUMsT0FBQTtVQUFBVCxDQUFBLE9BQUF4QixPQUFBLENBQUFrQyxJQUFBO1VBQUFWLENBQUEsT0FBQVAsc0JBQUE7VUFBQU8sQ0FBQSxPQUFBZCwwQkFBQTtVQUFBYyxDQUFBLE9BQUFiLGFBQUE7VUFBQWEsQ0FBQSxPQUFBWixhQUFBO1VBQUFZLENBQUEsT0FBQW5CLEtBQUE7VUFBQW1CLENBQUEsT0FBQWpCLE9BQUE7VUFBQWlCLENBQUEsT0FBQVYsS0FBQTtVQUFBVSxDQUFBLE9BQUFPLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFQLENBQUE7UUFBQTtRQUFBLElBQUFXLEVBQUE7UUFBQSxJQUFBWCxDQUFBLFNBQUFLLEVBQUEsSUFBQUwsQ0FBQSxTQUFBTyxFQUFBO1VBdEJKSSxFQUFBLElBQUMsR0FBRyxDQUFlLGFBQVEsQ0FBUixRQUFRLENBQVEsS0FBd0IsQ0FBeEIsQ0FBQU4sRUFBdUIsQ0FBQyxDQUN4RCxDQUFBRSxFQXFCQSxDQUNILEVBdkJDLEdBQUcsQ0F1QkU7VUFBQVAsQ0FBQSxPQUFBSyxFQUFBO1VBQUFMLENBQUEsT0FBQU8sRUFBQTtVQUFBUCxDQUFBLE9BQUFXLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFYLENBQUE7UUFBQTtRQUFBLE9BdkJOVyxFQXVCTTtNQUFBO0lBQUEsS0FFTCxNQUFNO01BQUE7UUFDVCxJQUFJbkMsT0FBTyxDQUFBeUMsZ0JBQWlCO1VBSWQsTUFBQVosRUFBQSxHQUFBZCxnQkFBZ0IsR0FBaEIsWUFBMEMsR0FBMUMsUUFBMEM7VUFBQSxJQUFBZ0IsRUFBQTtVQUFBLElBQUFQLENBQUEsU0FBQXhCLE9BQUEsSUFBQXdCLENBQUEsU0FBQUssRUFBQTtZQUZwREUsRUFBQSxJQUFDLGNBQWMsQ0FDSi9CLE9BQU8sQ0FBUEEsUUFBTSxDQUFDLENBQ1IsTUFBMEMsQ0FBMUMsQ0FBQTZCLEVBQXlDLENBQUMsR0FDbEQ7WUFBQUwsQ0FBQSxPQUFBeEIsT0FBQTtZQUFBd0IsQ0FBQSxPQUFBSyxFQUFBO1lBQUFMLENBQUEsT0FBQU8sRUFBQTtVQUFBO1lBQUFBLEVBQUEsR0FBQVAsQ0FBQTtVQUFBO1VBQUEsT0FIRk8sRUFHRTtRQUFBO1FBRUwsSUFBQVcsWUFBQTtRQUFBLElBQUFsQixDQUFBLFNBQUF4QixPQUFBLENBQUEyQyxhQUFBLElBQUFuQixDQUFBLFNBQUF4QixPQUFBLENBQUFBLE9BQUEsQ0FBQWlDLE9BQUE7VUFNRFMsWUFBQSxHQUErQixFQUFFO1VBQ2pDLElBQUFFLGFBQUEsR0FBb0IsQ0FBQztVQUNyQixLQUFLLE1BQUFDLEtBQVcsSUFBSTdDLE9BQU8sQ0FBQUEsT0FBUSxDQUFBaUMsT0FBUTtZQUN6QyxJQUFJWSxLQUFLLENBQUFqQixJQUFLLEtBQUssT0FBTztjQUN4QixNQUFBa0IsRUFBQSxHQUFXOUMsT0FBTyxDQUFBMkMsYUFBK0IsR0FBZEMsYUFBYSxDQUFDO2NBQ2pEQSxhQUFhLEVBQUU7Y0FDZkYsWUFBWSxDQUFBSyxJQUFLLENBQUNELEVBQW1CLElBQW5CRixhQUFtQixDQUFDO1lBQUE7Y0FFdENGLFlBQVksQ0FBQUssSUFBSyxDQUFDSCxhQUFhLENBQUM7WUFBQTtVQUNqQztVQUNGcEIsQ0FBQSxPQUFBeEIsT0FBQSxDQUFBMkMsYUFBQTtVQUFBbkIsQ0FBQSxPQUFBeEIsT0FBQSxDQUFBQSxPQUFBLENBQUFpQyxPQUFBO1VBQUFULENBQUEsT0FBQWtCLFlBQUE7UUFBQTtVQUFBQSxZQUFBLEdBQUFsQixDQUFBO1FBQUE7UUFHRCxNQUFBd0Isa0JBQUEsR0FBMkIzQixvQkFBb0IsS0FBS3JCLE9BQU8sQ0FBQWtDLElBQUs7UUFFM0IsTUFBQUwsRUFBQSxHQUFBMUIsY0FBd0IsSUFBeEIsTUFBd0I7UUFBQSxJQUFBNEIsRUFBQTtRQUFBLElBQUFQLENBQUEsU0FBQXBCLFNBQUEsSUFBQW9CLENBQUEsU0FBQWtCLFlBQUEsSUFBQWxCLENBQUEsU0FBQVQsZ0JBQUEsSUFBQVMsQ0FBQSxTQUFBTCxrQkFBQSxJQUFBSyxDQUFBLFNBQUF2QixPQUFBLElBQUF1QixDQUFBLFNBQUF4QixPQUFBLElBQUF3QixDQUFBLFNBQUFkLDBCQUFBLElBQUFjLENBQUEsU0FBQVgsS0FBQSxJQUFBVyxDQUFBLFNBQUFuQixLQUFBLElBQUFtQixDQUFBLFNBQUFqQixPQUFBO1VBQ3hEd0IsRUFBQSxHQUFBL0IsT0FBTyxDQUFBQSxPQUFRLENBQUFpQyxPQUFRLENBQUFPLEdBQUksQ0FBQyxDQUFBUyxPQUFBLEVBQUFYLEtBQUEsS0FDM0IsQ0FBQyxXQUFXLENBQ0xBLEdBQUssQ0FBTEEsTUFBSSxDQUFDLENBQ0R0QyxPQUFPLENBQVBBLFFBQU0sQ0FBQyxDQUNMSSxTQUFTLENBQVRBLFVBQVEsQ0FBQyxDQUNiQyxLQUFLLENBQUxBLE1BQUksQ0FBQyxDQUNnQkssMEJBQTBCLENBQTFCQSwyQkFBeUIsQ0FBQyxDQUMvQ21DLEtBQUssQ0FBTEEsUUFBSSxDQUFDLENBQ0xoQyxLQUFLLENBQUxBLE1BQUksQ0FBQyxDQUNITixPQUFPLENBQVBBLFFBQU0sQ0FBQyxDQUNKLFVBQW1CLENBQW5CLENBQUFtQyxZQUFZLENBQUNKLEtBQUssRUFBQyxDQUNYbkIsa0JBQWtCLENBQWxCQSxtQkFBaUIsQ0FBQyxDQUM3QmxCLE9BQU8sQ0FBUEEsUUFBTSxDQUFDLENBQ0VjLGdCQUFnQixDQUFoQkEsaUJBQWUsQ0FBQyxHQUVyQyxDQUFDO1VBQUFTLENBQUEsT0FBQXBCLFNBQUE7VUFBQW9CLENBQUEsT0FBQWtCLFlBQUE7VUFBQWxCLENBQUEsT0FBQVQsZ0JBQUE7VUFBQVMsQ0FBQSxPQUFBTCxrQkFBQTtVQUFBSyxDQUFBLE9BQUF2QixPQUFBO1VBQUF1QixDQUFBLE9BQUF4QixPQUFBO1VBQUF3QixDQUFBLE9BQUFkLDBCQUFBO1VBQUFjLENBQUEsT0FBQVgsS0FBQTtVQUFBVyxDQUFBLE9BQUFuQixLQUFBO1VBQUFtQixDQUFBLE9BQUFqQixPQUFBO1VBQUFpQixDQUFBLE9BQUFPLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFQLENBQUE7UUFBQTtRQUFBLElBQUFXLEVBQUE7UUFBQSxJQUFBWCxDQUFBLFNBQUFLLEVBQUEsSUFBQUwsQ0FBQSxTQUFBTyxFQUFBO1VBaEJKSSxFQUFBLElBQUMsR0FBRyxDQUFlLGFBQVEsQ0FBUixRQUFRLENBQVEsS0FBd0IsQ0FBeEIsQ0FBQU4sRUFBdUIsQ0FBQyxDQUN4RCxDQUFBRSxFQWVBLENBQ0gsRUFqQkMsR0FBRyxDQWlCRTtVQUFBUCxDQUFBLE9BQUFLLEVBQUE7VUFBQUwsQ0FBQSxPQUFBTyxFQUFBO1VBQUFQLENBQUEsT0FBQVcsRUFBQTtRQUFBO1VBQUFBLEVBQUEsR0FBQVgsQ0FBQTtRQUFBO1FBbEJSLE1BQUFTLE9BQUEsR0FDRUUsRUFpQk07UUFDUCxJQUFBZSxFQUFBO1FBQUEsSUFBQTFCLENBQUEsU0FBQVMsT0FBQSxJQUFBVCxDQUFBLFNBQUF3QixrQkFBQTtVQUNNRSxFQUFBLEdBQUFGLGtCQUFrQixHQUN2QixDQUFDLHlCQUF5QixDQUFFZixRQUFNLENBQUUsRUFBbkMseUJBQXlCLENBRzNCLEdBSk1BLE9BSU47VUFBQVQsQ0FBQSxPQUFBUyxPQUFBO1VBQUFULENBQUEsT0FBQXdCLGtCQUFBO1VBQUF4QixDQUFBLE9BQUEwQixFQUFBO1FBQUE7VUFBQUEsRUFBQSxHQUFBMUIsQ0FBQTtRQUFBO1FBQUEsT0FKTTBCLEVBSU47TUFBQTtJQUFBLEtBRUUsUUFBUTtNQUFBO1FBQ1gsSUFBSWxELE9BQU8sQ0FBQW1ELE9BQVEsS0FBSyxrQkFBa0I7VUFJeEMsSUFBSXRFLHNCQUFzQixDQUFDLENBQUM7WUFBQSxPQUNuQixJQUFJO1VBQUE7VUFDWixJQUFBZ0QsRUFBQTtVQUFBLElBQUFMLENBQUEsU0FBQTRCLE1BQUEsQ0FBQUMsR0FBQTtZQUNNeEIsRUFBQSxJQUFDLHNCQUFzQixHQUFHO1lBQUFMLENBQUEsT0FBQUssRUFBQTtVQUFBO1lBQUFBLEVBQUEsR0FBQUwsQ0FBQTtVQUFBO1VBQUEsT0FBMUJLLEVBQTBCO1FBQUE7UUFFbkMsSUFBSTdCLE9BQU8sQ0FBQW1ELE9BQVEsS0FBSyx1QkFBdUI7VUFBQSxPQUV0QyxJQUFJO1FBQUE7UUFFYixJQUFJaEcsT0FBTyxDQUFDLGNBQWMsQ0FBQztVQUV6QjtZQUFBbUc7VUFBQSxJQUNFQyxPQUFPLENBQUMsdUNBQXVDLENBQUMsSUFBSSxPQUFPLE9BQU8sdUNBQXVDLENBQUM7VUFDNUc7WUFBQUM7VUFBQSxJQUNFRCxPQUFPLENBQUMsb0NBQW9DLENBQUMsSUFBSSxPQUFPLE9BQU8sb0NBQW9DLENBQUM7VUFFdEcsSUFBSUQscUJBQXFCLENBQUN0RCxPQUFPLENBQUM7WUFBQSxJQUFBNkIsRUFBQTtZQUFBLElBQUFMLENBQUEsU0FBQTRCLE1BQUEsQ0FBQUMsR0FBQTtjQUc5QnhCLEVBQUEsR0FBQTBCLE9BQU8sQ0FBQyxtQ0FBbUMsQ0FBQztjQUFBL0IsQ0FBQSxPQUFBSyxFQUFBO1lBQUE7Y0FBQUEsRUFBQSxHQUFBTCxDQUFBO1lBQUE7WUFEOUM7Y0FBQWlDO1lBQUEsSUFDRTVCLEVBQTRDLElBQUksT0FBTyxPQUFPLG1DQUFtQyxDQUFDO1lBQUEsSUFBQUUsRUFBQTtZQUFBLElBQUFQLENBQUEsU0FBQXhCLE9BQUE7Y0FFN0YrQixFQUFBLElBQUMsbUJBQW1CLENBQVUvQixPQUFPLENBQVBBLFFBQU0sQ0FBQyxHQUFJO2NBQUF3QixDQUFBLE9BQUF4QixPQUFBO2NBQUF3QixDQUFBLE9BQUFPLEVBQUE7WUFBQTtjQUFBQSxFQUFBLEdBQUFQLENBQUE7WUFBQTtZQUFBLE9BQXpDTyxFQUF5QztVQUFBO1VBRWxELElBQUl5QixtQkFBbUIsQ0FBQ3hELE9BQU8sQ0FBQztZQUFBLE9BR3ZCLElBQUk7VUFBQTtRQUNaO1FBRUgsSUFBSUEsT0FBTyxDQUFBbUQsT0FBUSxLQUFLLGVBQWU7VUFBQSxJQUFBdEIsRUFBQTtVQUFBLElBQUFMLENBQUEsU0FBQXhCLE9BQUEsQ0FBQWlDLE9BQUE7WUFJMUJKLEVBQUE7Y0FBQUQsSUFBQSxFQUFRLE1BQU07Y0FBQThCLElBQUEsRUFBUTFELE9BQU8sQ0FBQWlDO1lBQVMsQ0FBQztZQUFBVCxDQUFBLE9BQUF4QixPQUFBLENBQUFpQyxPQUFBO1lBQUFULENBQUEsT0FBQUssRUFBQTtVQUFBO1lBQUFBLEVBQUEsR0FBQUwsQ0FBQTtVQUFBO1VBQUEsSUFBQU8sRUFBQTtVQUFBLElBQUFQLENBQUEsU0FBQXBCLFNBQUEsSUFBQW9CLENBQUEsU0FBQVQsZ0JBQUEsSUFBQVMsQ0FBQSxTQUFBSyxFQUFBLElBQUFMLENBQUEsU0FBQWpCLE9BQUE7WUFGaER3QixFQUFBLElBQUMsZUFBZSxDQUNIM0IsU0FBUyxDQUFUQSxVQUFRLENBQUMsQ0FDYixLQUF1QyxDQUF2QyxDQUFBeUIsRUFBc0MsQ0FBQyxDQUNyQ3RCLE9BQU8sQ0FBUEEsUUFBTSxDQUFDLENBQ0VRLGdCQUFnQixDQUFoQkEsaUJBQWUsQ0FBQyxHQUNsQztZQUFBUyxDQUFBLE9BQUFwQixTQUFBO1lBQUFvQixDQUFBLE9BQUFULGdCQUFBO1lBQUFTLENBQUEsT0FBQUssRUFBQTtZQUFBTCxDQUFBLE9BQUFqQixPQUFBO1lBQUFpQixDQUFBLE9BQUFPLEVBQUE7VUFBQTtZQUFBQSxFQUFBLEdBQUFQLENBQUE7VUFBQTtVQUFBLE9BTEZPLEVBS0U7UUFBQTtRQUVMLElBQUFGLEVBQUE7UUFBQSxJQUFBTCxDQUFBLFNBQUFwQixTQUFBLElBQUFvQixDQUFBLFNBQUFULGdCQUFBLElBQUFTLENBQUEsU0FBQXhCLE9BQUEsSUFBQXdCLENBQUEsU0FBQWpCLE9BQUE7VUFFQ3NCLEVBQUEsSUFBQyxpQkFBaUIsQ0FDUDdCLE9BQU8sQ0FBUEEsUUFBTSxDQUFDLENBQ0xJLFNBQVMsQ0FBVEEsVUFBUSxDQUFDLENBQ1hHLE9BQU8sQ0FBUEEsUUFBTSxDQUFDLENBQ0VRLGdCQUFnQixDQUFoQkEsaUJBQWUsQ0FBQyxHQUNsQztVQUFBUyxDQUFBLE9BQUFwQixTQUFBO1VBQUFvQixDQUFBLE9BQUFULGdCQUFBO1VBQUFTLENBQUEsT0FBQXhCLE9BQUE7VUFBQXdCLENBQUEsT0FBQWpCLE9BQUE7VUFBQWlCLENBQUEsT0FBQUssRUFBQTtRQUFBO1VBQUFBLEVBQUEsR0FBQUwsQ0FBQTtRQUFBO1FBQUEsT0FMRkssRUFLRTtNQUFBO0lBQUEsS0FFRCxrQkFBa0I7TUFBQTtRQUFBLElBQUFBLEVBQUE7UUFBQSxJQUFBTCxDQUFBLFNBQUFoQixvQkFBQSxJQUFBZ0IsQ0FBQSxTQUFBdkIsT0FBQSxJQUFBdUIsQ0FBQSxTQUFBeEIsT0FBQSxJQUFBd0IsQ0FBQSxTQUFBYixhQUFBLElBQUFhLENBQUEsU0FBQW5CLEtBQUE7VUFFbkJ3QixFQUFBLElBQUMscUJBQXFCLENBQ1g3QixPQUFPLENBQVBBLFFBQU0sQ0FBQyxDQUNUSyxLQUFLLENBQUxBLE1BQUksQ0FBQyxDQUNISixPQUFPLENBQVBBLFFBQU0sQ0FBQyxDQUNNTyxvQkFBb0IsQ0FBcEJBLHFCQUFtQixDQUFDLENBQzNCRyxhQUFhLENBQWJBLGNBQVksQ0FBQyxHQUM1QjtVQUFBYSxDQUFBLE9BQUFoQixvQkFBQTtVQUFBZ0IsQ0FBQSxPQUFBdkIsT0FBQTtVQUFBdUIsQ0FBQSxPQUFBeEIsT0FBQTtVQUFBd0IsQ0FBQSxPQUFBYixhQUFBO1VBQUFhLENBQUEsT0FBQW5CLEtBQUE7VUFBQW1CLENBQUEsT0FBQUssRUFBQTtRQUFBO1VBQUFBLEVBQUEsR0FBQUwsQ0FBQTtRQUFBO1FBQUEsT0FORkssRUFNRTtNQUFBO0lBQUEsS0FFRCx1QkFBdUI7TUFBQTtRQWtCWCxNQUFBQSxFQUFBLEdBQUF0QixPQUEyQixJQUEzQlEsZ0JBQTJCO1FBQUEsSUFBQWdCLEVBQUE7UUFBQSxJQUFBUCxDQUFBLFNBQUFoQixvQkFBQSxJQUFBZ0IsQ0FBQSxTQUFBTixzQkFBQSxJQUFBTSxDQUFBLFNBQUF2QixPQUFBLElBQUF1QixDQUFBLFNBQUF4QixPQUFBLElBQUF3QixDQUFBLFNBQUFiLGFBQUEsSUFBQWEsQ0FBQSxTQUFBSyxFQUFBLElBQUFMLENBQUEsU0FBQW5CLEtBQUE7VUFWeEMwQixFQUFBLElBQUMsZUFBZSxDQUNkLENBQUMsMEJBQTBCLENBQ2hCL0IsT0FBTyxDQUFQQSxRQUFNLENBQUMsQ0FDTVEsb0JBQW9CLENBQXBCQSxxQkFBbUIsQ0FBQyxDQUMzQkcsYUFBYSxDQUFiQSxjQUFZLENBQUMsQ0FNbkIsT0FBMkIsQ0FBM0IsQ0FBQWtCLEVBQTBCLENBQUMsQ0FDN0J4QixLQUFLLENBQUxBLE1BQUksQ0FBQyxDQUNISixPQUFPLENBQVBBLFFBQU0sQ0FBQyxDQUNEaUIsYUFBc0IsQ0FBdEJBLHVCQUFxQixDQUFDLEdBRXpDLEVBZkMsZUFBZSxDQWVFO1VBQUFNLENBQUEsT0FBQWhCLG9CQUFBO1VBQUFnQixDQUFBLE9BQUFOLHNCQUFBO1VBQUFNLENBQUEsT0FBQXZCLE9BQUE7VUFBQXVCLENBQUEsT0FBQXhCLE9BQUE7VUFBQXdCLENBQUEsT0FBQWIsYUFBQTtVQUFBYSxDQUFBLE9BQUFLLEVBQUE7VUFBQUwsQ0FBQSxPQUFBbkIsS0FBQTtVQUFBbUIsQ0FBQSxPQUFBTyxFQUFBO1FBQUE7VUFBQUEsRUFBQSxHQUFBUCxDQUFBO1FBQUE7UUFBQSxPQWZsQk8sRUFla0I7TUFBQTtFQUV4QjtBQUFDO0FBR0gsU0FBQTRCLFlBQUFwQyxFQUFBO0VBQUEsTUFBQUMsQ0FBQSxHQUFBQyxFQUFBO0VBQXFCO0lBQUF6QixPQUFBO0lBQUFJLFNBQUE7SUFBQUMsS0FBQTtJQUFBSywwQkFBQTtJQUFBbUMsS0FBQTtJQUFBaEMsS0FBQTtJQUFBTixPQUFBO0lBQUFxRCxVQUFBO0lBQUF6QyxrQkFBQTtJQUFBbEIsT0FBQTtJQUFBYztFQUFBLElBQUFRLEVBNEJwQjtFQUNDO0lBQUFzQztFQUFBLElBQW9CakcsZUFBZSxDQUFDLENBQUM7RUFDckMsUUFBUWlGLEtBQUssQ0FBQWpCLElBQUs7SUFBQSxLQUNYLE1BQU07TUFBQTtRQUFBLElBQUFGLEVBQUE7UUFBQSxJQUFBRixDQUFBLFFBQUFwQixTQUFBLElBQUFvQixDQUFBLFFBQUFULGdCQUFBLElBQUFTLENBQUEsUUFBQXhCLE9BQUEsQ0FBQThELFdBQUEsSUFBQXRDLENBQUEsUUFBQXhCLE9BQUEsQ0FBQStELFNBQUEsSUFBQXZDLENBQUEsUUFBQXFCLEtBQUEsSUFBQXJCLENBQUEsUUFBQWpCLE9BQUE7VUFFUG1CLEVBQUEsSUFBQyxlQUFlLENBQ0h0QixTQUFTLENBQVRBLFVBQVEsQ0FBQyxDQUNieUMsS0FBSyxDQUFMQSxNQUFJLENBQUMsQ0FDSHRDLE9BQU8sQ0FBUEEsUUFBTSxDQUFDLENBQ0gsV0FBbUIsQ0FBbkIsQ0FBQVAsT0FBTyxDQUFBOEQsV0FBVyxDQUFDLENBQ2QvQyxnQkFBZ0IsQ0FBaEJBLGlCQUFlLENBQUMsQ0FDdkIsU0FBaUIsQ0FBakIsQ0FBQWYsT0FBTyxDQUFBK0QsU0FBUyxDQUFDLEdBQzVCO1VBQUF2QyxDQUFBLE1BQUFwQixTQUFBO1VBQUFvQixDQUFBLE1BQUFULGdCQUFBO1VBQUFTLENBQUEsTUFBQXhCLE9BQUEsQ0FBQThELFdBQUE7VUFBQXRDLENBQUEsTUFBQXhCLE9BQUEsQ0FBQStELFNBQUE7VUFBQXZDLENBQUEsTUFBQXFCLEtBQUE7VUFBQXJCLENBQUEsTUFBQWpCLE9BQUE7VUFBQWlCLENBQUEsTUFBQUUsRUFBQTtRQUFBO1VBQUFBLEVBQUEsR0FBQUYsQ0FBQTtRQUFBO1FBQUEsT0FQRkUsRUFPRTtNQUFBO0lBQUEsS0FFRCxPQUFPO01BQUE7UUFNSyxNQUFBQSxFQUFBLEdBQUF0QixTQUFnQyxJQUFoQyxDQUFjZSxrQkFBa0I7UUFBQSxJQUFBVSxFQUFBO1FBQUEsSUFBQUwsQ0FBQSxRQUFBb0MsVUFBQSxJQUFBcEMsQ0FBQSxRQUFBRSxFQUFBO1VBRjdDRyxFQUFBLElBQUMsZ0JBQWdCLENBQ04rQixPQUFVLENBQVZBLFdBQVMsQ0FBQyxDQUNSLFNBQWdDLENBQWhDLENBQUFsQyxFQUErQixDQUFDLEdBQzNDO1VBQUFGLENBQUEsTUFBQW9DLFVBQUE7VUFBQXBDLENBQUEsTUFBQUUsRUFBQTtVQUFBRixDQUFBLE1BQUFLLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFMLENBQUE7UUFBQTtRQUFBLE9BSEZLLEVBR0U7TUFBQTtJQUFBLEtBRUQsYUFBYTtNQUFBO1FBVUwsTUFBQUgsRUFBQSxHQUFBbUMsT0FBTyxHQUFHLENBQUM7UUFBQSxJQUFBaEMsRUFBQTtRQUFBLElBQUFMLENBQUEsU0FBQVQsZ0JBQUEsSUFBQVMsQ0FBQSxTQUFBdkIsT0FBQSxJQUFBdUIsQ0FBQSxTQUFBeEIsT0FBQSxJQUFBd0IsQ0FBQSxTQUFBcUIsS0FBQSxJQUFBckIsQ0FBQSxTQUFBZCwwQkFBQSxJQUFBYyxDQUFBLFNBQUFYLEtBQUEsSUFBQVcsQ0FBQSxTQUFBRSxFQUFBLElBQUFGLENBQUEsU0FBQW5CLEtBQUEsSUFBQW1CLENBQUEsU0FBQWpCLE9BQUE7VUFScEJzQixFQUFBLElBQUMscUJBQXFCLENBQ2JnQixLQUFLLENBQUxBLE1BQUksQ0FBQyxDQUNIN0MsT0FBTyxDQUFQQSxRQUFNLENBQUMsQ0FDUEMsT0FBTyxDQUFQQSxRQUFNLENBQUMsQ0FDWVMsMEJBQTBCLENBQTFCQSwyQkFBeUIsQ0FBQyxDQUMvQ0csS0FBSyxDQUFMQSxNQUFJLENBQUMsQ0FDTFIsS0FBSyxDQUFMQSxNQUFJLENBQUMsQ0FDSEUsT0FBTyxDQUFQQSxRQUFNLENBQUMsQ0FDVCxLQUFXLENBQVgsQ0FBQW1CLEVBQVUsQ0FBQyxDQUNBWCxnQkFBZ0IsQ0FBaEJBLGlCQUFlLENBQUMsR0FDbEM7VUFBQVMsQ0FBQSxPQUFBVCxnQkFBQTtVQUFBUyxDQUFBLE9BQUF2QixPQUFBO1VBQUF1QixDQUFBLE9BQUF4QixPQUFBO1VBQUF3QixDQUFBLE9BQUFxQixLQUFBO1VBQUFyQixDQUFBLE9BQUFkLDBCQUFBO1VBQUFjLENBQUEsT0FBQVgsS0FBQTtVQUFBVyxDQUFBLE9BQUFFLEVBQUE7VUFBQUYsQ0FBQSxPQUFBbkIsS0FBQTtVQUFBbUIsQ0FBQSxPQUFBakIsT0FBQTtVQUFBaUIsQ0FBQSxPQUFBSyxFQUFBO1FBQUE7VUFBQUEsRUFBQSxHQUFBTCxDQUFBO1FBQUE7UUFBQSxPQVZGSyxFQVVFO01BQUE7SUFBQTtNQUFBO1FBQUE7TUFBQTtFQUlSO0FBQUM7QUFHSCxTQUFBbUMsc0JBQUF6QyxFQUFBO0VBQUEsTUFBQUMsQ0FBQSxHQUFBQyxFQUFBO0VBQStCO0lBQUFvQixLQUFBO0lBQUF6QyxTQUFBO0lBQUFDLEtBQUE7SUFBQUMsUUFBQTtJQUFBQyxPQUFBO0lBQUFDLG9CQUFBO0lBQUFFLDBCQUFBO0lBQUFDLGFBQUE7SUFBQUMsYUFBQTtJQUFBRSxLQUFBO0lBQUFtRCx1QkFBQTtJQUFBbEQsZ0JBQUE7SUFBQWQsT0FBQTtJQUFBZ0Isc0JBQUE7SUFBQWlELGVBQUE7SUFBQTlDLG1CQUFBO0lBQUFZO0VBQUEsSUFBQVQsRUE4QzlCO0VBQ0MsSUFBSXBFLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQztJQUMzQixJQUFJYSxvQkFBb0IsQ0FBQzZFLEtBQUssQ0FBQztNQUFBLElBQUFuQixFQUFBO01BQUEsSUFBQUYsQ0FBQSxRQUFBcUIsS0FBQSxDQUFBc0IsY0FBQTtRQUdsQnpDLEVBQUE7VUFBQUUsSUFBQSxFQUFRLE1BQU07VUFBQThCLElBQUEsRUFBUWIsS0FBSyxDQUFBc0I7UUFBZ0IsQ0FBQztRQUFBM0MsQ0FBQSxNQUFBcUIsS0FBQSxDQUFBc0IsY0FBQTtRQUFBM0MsQ0FBQSxNQUFBRSxFQUFBO01BQUE7UUFBQUEsRUFBQSxHQUFBRixDQUFBO01BQUE7TUFBQSxJQUFBSyxFQUFBO01BQUEsSUFBQUwsQ0FBQSxRQUFBcEIsU0FBQSxJQUFBb0IsQ0FBQSxRQUFBUCxzQkFBQSxJQUFBTyxDQUFBLFFBQUFaLGFBQUEsSUFBQVksQ0FBQSxRQUFBRSxFQUFBLElBQUFGLENBQUEsUUFBQWpCLE9BQUEsSUFBQWlCLENBQUEsUUFBQVYsS0FBQTtRQURyRGUsRUFBQSxJQUFDLG9CQUFvQixDQUNaLEtBQTRDLENBQTVDLENBQUFILEVBQTJDLENBQUMsQ0FDeEN0QixTQUFTLENBQVRBLFVBQVEsQ0FBQyxDQUNMUSxhQUFhLENBQWJBLGNBQVksQ0FBQyxDQUNuQkwsT0FBTyxDQUFQQSxRQUFNLENBQUMsQ0FDVE8sS0FBSyxDQUFMQSxNQUFJLENBQUMsQ0FDWUcsc0JBQXNCLENBQXRCQSx1QkFBcUIsQ0FBQyxHQUM5QztRQUFBTyxDQUFBLE1BQUFwQixTQUFBO1FBQUFvQixDQUFBLE1BQUFQLHNCQUFBO1FBQUFPLENBQUEsTUFBQVosYUFBQTtRQUFBWSxDQUFBLE1BQUFFLEVBQUE7UUFBQUYsQ0FBQSxNQUFBakIsT0FBQTtRQUFBaUIsQ0FBQSxNQUFBVixLQUFBO1FBQUFVLENBQUEsTUFBQUssRUFBQTtNQUFBO1FBQUFBLEVBQUEsR0FBQUwsQ0FBQTtNQUFBO01BQUEsT0FQRkssRUFPRTtJQUFBO0VBRUw7RUFFSCxRQUFRZ0IsS0FBSyxDQUFBakIsSUFBSztJQUFBLEtBQ1gsVUFBVTtNQUFBO1FBQUEsSUFBQUYsRUFBQTtRQUFBLElBQUFGLENBQUEsUUFBQXBCLFNBQUEsSUFBQW9CLENBQUEsU0FBQWxCLFFBQUEsSUFBQWtCLENBQUEsU0FBQXlDLHVCQUFBLElBQUF6QyxDQUFBLFNBQUFoQixvQkFBQSxJQUFBZ0IsQ0FBQSxTQUFBVCxnQkFBQSxJQUFBUyxDQUFBLFNBQUF2QixPQUFBLElBQUF1QixDQUFBLFNBQUFxQixLQUFBLElBQUFyQixDQUFBLFNBQUFkLDBCQUFBLElBQUFjLENBQUEsU0FBQWIsYUFBQSxJQUFBYSxDQUFBLFNBQUFaLGFBQUEsSUFBQVksQ0FBQSxTQUFBbkIsS0FBQSxJQUFBbUIsQ0FBQSxTQUFBakIsT0FBQTtVQUVYbUIsRUFBQSxJQUFDLHVCQUF1QixDQUNmbUIsS0FBSyxDQUFMQSxNQUFJLENBQUMsQ0FDRHpDLFNBQVMsQ0FBVEEsVUFBUSxDQUFDLENBQ2JDLEtBQUssQ0FBTEEsTUFBSSxDQUFDLENBQ0ZDLFFBQVEsQ0FBUkEsU0FBTyxDQUFDLENBQ1RDLE9BQU8sQ0FBUEEsUUFBTSxDQUFDLENBQ01DLG9CQUFvQixDQUFwQkEscUJBQW1CLENBQUMsQ0FDZEUsMEJBQTBCLENBQTFCQSwyQkFBeUIsQ0FBQyxDQUN2Q0MsYUFBYSxDQUFiQSxjQUFZLENBQUMsQ0FDYkMsYUFBYSxDQUFiQSxjQUFZLENBQUMsQ0FDSHFELHVCQUF1QixDQUF2QkEsd0JBQXNCLENBQUMsQ0FDdkNoRSxPQUFPLENBQVBBLFFBQU0sQ0FBQyxDQUNFYyxnQkFBZ0IsQ0FBaEJBLGlCQUFlLENBQUMsR0FDbEM7VUFBQVMsQ0FBQSxNQUFBcEIsU0FBQTtVQUFBb0IsQ0FBQSxPQUFBbEIsUUFBQTtVQUFBa0IsQ0FBQSxPQUFBeUMsdUJBQUE7VUFBQXpDLENBQUEsT0FBQWhCLG9CQUFBO1VBQUFnQixDQUFBLE9BQUFULGdCQUFBO1VBQUFTLENBQUEsT0FBQXZCLE9BQUE7VUFBQXVCLENBQUEsT0FBQXFCLEtBQUE7VUFBQXJCLENBQUEsT0FBQWQsMEJBQUE7VUFBQWMsQ0FBQSxPQUFBYixhQUFBO1VBQUFhLENBQUEsT0FBQVosYUFBQTtVQUFBWSxDQUFBLE9BQUFuQixLQUFBO1VBQUFtQixDQUFBLE9BQUFqQixPQUFBO1VBQUFpQixDQUFBLE9BQUFFLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFGLENBQUE7UUFBQTtRQUFBLE9BYkZFLEVBYUU7TUFBQTtJQUFBLEtBRUQsTUFBTTtNQUFBO1FBQUEsSUFBQUEsRUFBQTtRQUFBLElBQUFGLENBQUEsU0FBQXBCLFNBQUEsSUFBQW9CLENBQUEsU0FBQVAsc0JBQUEsSUFBQU8sQ0FBQSxTQUFBcUIsS0FBQSxJQUFBckIsQ0FBQSxTQUFBWixhQUFBLElBQUFZLENBQUEsU0FBQWpCLE9BQUEsSUFBQWlCLENBQUEsU0FBQVYsS0FBQTtVQUVQWSxFQUFBLElBQUMsb0JBQW9CLENBQ1ptQixLQUFLLENBQUxBLE1BQUksQ0FBQyxDQUNEekMsU0FBUyxDQUFUQSxVQUFRLENBQUMsQ0FDTFEsYUFBYSxDQUFiQSxjQUFZLENBQUMsQ0FDbkJMLE9BQU8sQ0FBUEEsUUFBTSxDQUFDLENBQ1RPLEtBQUssQ0FBTEEsTUFBSSxDQUFDLENBQ1lHLHNCQUFzQixDQUF0QkEsdUJBQXFCLENBQUMsR0FDOUM7VUFBQU8sQ0FBQSxPQUFBcEIsU0FBQTtVQUFBb0IsQ0FBQSxPQUFBUCxzQkFBQTtVQUFBTyxDQUFBLE9BQUFxQixLQUFBO1VBQUFyQixDQUFBLE9BQUFaLGFBQUE7VUFBQVksQ0FBQSxPQUFBakIsT0FBQTtVQUFBaUIsQ0FBQSxPQUFBVixLQUFBO1VBQUFVLENBQUEsT0FBQUUsRUFBQTtRQUFBO1VBQUFBLEVBQUEsR0FBQUYsQ0FBQTtRQUFBO1FBQUEsT0FQRkUsRUFPRTtNQUFBO0lBQUEsS0FFRCxtQkFBbUI7TUFBQTtRQUN0QixJQUFJLENBQUNYLGdCQUE0QixJQUE3QixDQUFzQlIsT0FBTztVQUFBLE9BQ3hCLElBQUk7UUFBQTtRQUNaLElBQUFtQixFQUFBO1FBQUEsSUFBQUYsQ0FBQSxTQUFBcEIsU0FBQTtVQUNNc0IsRUFBQSxJQUFDLGdDQUFnQyxDQUFZdEIsU0FBUyxDQUFUQSxVQUFRLENBQUMsR0FBSTtVQUFBb0IsQ0FBQSxPQUFBcEIsU0FBQTtVQUFBb0IsQ0FBQSxPQUFBRSxFQUFBO1FBQUE7VUFBQUEsRUFBQSxHQUFBRixDQUFBO1FBQUE7UUFBQSxPQUExREUsRUFBMEQ7TUFBQTtJQUFBLEtBQzlELFVBQVU7TUFBQTtRQUNiLElBQUksQ0FBQ1gsZ0JBQTRCLElBQTdCLENBQXNCUixPQUFPO1VBQUEsT0FDeEIsSUFBSTtRQUFBO1FBR2IsTUFBQTZELGNBQUEsR0FDRSxDQUFDaEQsbUJBQThELElBQXZDOEMsZUFBZSxLQUFLOUMsbUJBQW1CO1FBTzNDLE1BQUFNLEVBQUEsR0FBQVgsZ0JBQW1DLElBQW5DLENBQXFCcUQsY0FBYztRQUFBLElBQUF2QyxFQUFBO1FBQUEsSUFBQUwsQ0FBQSxTQUFBcEIsU0FBQSxJQUFBb0IsQ0FBQSxTQUFBVCxnQkFBQSxJQUFBUyxDQUFBLFNBQUFxQixLQUFBLElBQUFyQixDQUFBLFNBQUFFLEVBQUEsSUFBQUYsQ0FBQSxTQUFBakIsT0FBQTtVQUx2RHNCLEVBQUEsSUFBQyx3QkFBd0IsQ0FDWnpCLFNBQVMsQ0FBVEEsVUFBUSxDQUFDLENBQ2J5QyxLQUFLLENBQUxBLE1BQUksQ0FBQyxDQUNNOUIsZ0JBQWdCLENBQWhCQSxpQkFBZSxDQUFDLENBQ3pCUixPQUFPLENBQVBBLFFBQU0sQ0FBQyxDQUNFLGdCQUFtQyxDQUFuQyxDQUFBbUIsRUFBa0MsQ0FBQyxHQUNyRDtVQUFBRixDQUFBLE9BQUFwQixTQUFBO1VBQUFvQixDQUFBLE9BQUFULGdCQUFBO1VBQUFTLENBQUEsT0FBQXFCLEtBQUE7VUFBQXJCLENBQUEsT0FBQUUsRUFBQTtVQUFBRixDQUFBLE9BQUFqQixPQUFBO1VBQUFpQixDQUFBLE9BQUFLLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFMLENBQUE7UUFBQTtRQUFBLE9BTkZLLEVBTUU7TUFBQTtJQUFBLEtBR0QsaUJBQWlCO0lBQUEsS0FDakIscUJBQXFCO01BQUE7UUFDeEIsSUFBSWpELGNBQWMsQ0FBQ2lFLEtBQUssQ0FBQztVQVFWLE1BQUFuQixFQUFBLEdBQUFuQixPQUEyQixJQUEzQlEsZ0JBQTJCO1VBQUEsSUFBQWMsRUFBQTtVQUFBLElBQUFMLENBQUEsU0FBQXBCLFNBQUEsSUFBQW9CLENBQUEsU0FBQVEsWUFBQSxJQUFBUixDQUFBLFNBQUF2QixPQUFBLENBQUFvRSxpQkFBQSxJQUFBN0MsQ0FBQSxTQUFBdkIsT0FBQSxDQUFBcUUsa0JBQUEsSUFBQTlDLENBQUEsU0FBQXFCLEtBQUEsSUFBQXJCLENBQUEsU0FBQWIsYUFBQSxJQUFBYSxDQUFBLFNBQUFFLEVBQUE7WUFOdENHLEVBQUEsSUFBQyxjQUFjLENBQ05nQixLQUFLLENBQUxBLE1BQUksQ0FBQyxDQUNEekMsU0FBUyxDQUFUQSxVQUFRLENBQUMsQ0FDQSxrQkFBMEIsQ0FBMUIsQ0FBQUgsT0FBTyxDQUFBcUUsa0JBQWtCLENBQUMsQ0FDM0IsaUJBQXlCLENBQXpCLENBQUFyRSxPQUFPLENBQUFvRSxpQkFBaUIsQ0FBQyxDQUM3QjFELGFBQWEsQ0FBYkEsY0FBWSxDQUFDLENBQ25CLE9BQTJCLENBQTNCLENBQUFlLEVBQTBCLENBQUMsQ0FDdEJNLFlBQVksQ0FBWkEsYUFBVyxDQUFDLEdBQzFCO1lBQUFSLENBQUEsT0FBQXBCLFNBQUE7WUFBQW9CLENBQUEsT0FBQVEsWUFBQTtZQUFBUixDQUFBLE9BQUF2QixPQUFBLENBQUFvRSxpQkFBQTtZQUFBN0MsQ0FBQSxPQUFBdkIsT0FBQSxDQUFBcUUsa0JBQUE7WUFBQTlDLENBQUEsT0FBQXFCLEtBQUE7WUFBQXJCLENBQUEsT0FBQWIsYUFBQTtZQUFBYSxDQUFBLE9BQUFFLEVBQUE7WUFBQUYsQ0FBQSxPQUFBSyxFQUFBO1VBQUE7WUFBQUEsRUFBQSxHQUFBTCxDQUFBO1VBQUE7VUFBQSxPQVJGSyxFQVFFO1FBQUE7UUFHTi9DLFFBQVEsQ0FBQyxJQUFJeUYsS0FBSyxDQUFDLHVDQUF1QzFCLEtBQUssQ0FBQWpCLElBQUssRUFBRSxDQUFDLENBQUM7UUFBQSxPQUNqRSxJQUFJO01BQUE7SUFBQTtNQUFBO1FBRVg5QyxRQUFRLENBQUMsSUFBSXlGLEtBQUssQ0FBQyxrQ0FBa0MxQixLQUFLLENBQUFqQixJQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQUEsT0FDNUQsSUFBSTtNQUFBO0VBQ2Y7QUFBQztBQUdILE9BQU8sU0FBUzRDLGtCQUFrQkEsQ0FBQ0MsQ0FBQyxFQUFFO0VBQ3BDN0MsSUFBSSxFQUFFLE1BQU07RUFDWjVCLE9BQU8sQ0FBQyxFQUFFO0lBQUVpQyxPQUFPLEVBQUV5QyxLQUFLLENBQUM7TUFBRTlDLElBQUksRUFBRSxNQUFNO0lBQUMsQ0FBQyxDQUFDO0VBQUMsQ0FBQztBQUNoRCxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUM7RUFDVixJQUFJNkMsQ0FBQyxDQUFDN0MsSUFBSSxLQUFLLFdBQVcsSUFBSSxDQUFDNkMsQ0FBQyxDQUFDekUsT0FBTyxFQUFFLE9BQU8sS0FBSztFQUN0RCxPQUFPeUUsQ0FBQyxDQUFDekUsT0FBTyxDQUFDaUMsT0FBTyxDQUFDMEMsSUFBSSxDQUMzQkMsQ0FBQyxJQUFJQSxDQUFDLENBQUNoRCxJQUFJLEtBQUssVUFBVSxJQUFJZ0QsQ0FBQyxDQUFDaEQsSUFBSSxLQUFLLG1CQUMzQyxDQUFDO0FBQ0g7O0FBRUE7QUFDQSxPQUFPLFNBQVNpRCxvQkFBb0JBLENBQUNDLElBQUksRUFBRS9FLEtBQUssRUFBRWdGLElBQUksRUFBRWhGLEtBQUssQ0FBQyxFQUFFLE9BQU8sQ0FBQztFQUN0RSxJQUFJK0UsSUFBSSxDQUFDOUUsT0FBTyxDQUFDa0MsSUFBSSxLQUFLNkMsSUFBSSxDQUFDL0UsT0FBTyxDQUFDa0MsSUFBSSxFQUFFLE9BQU8sS0FBSztFQUN6RDtFQUNBO0VBQ0E7RUFDQSxJQUNFNEMsSUFBSSxDQUFDMUQsbUJBQW1CLEtBQUsyRCxJQUFJLENBQUMzRCxtQkFBbUIsSUFDckRvRCxrQkFBa0IsQ0FBQ08sSUFBSSxDQUFDL0UsT0FBTyxDQUFDLEVBQ2hDO0lBQ0EsT0FBTyxLQUFLO0VBQ2Q7RUFDQTtFQUNBLElBQUk4RSxJQUFJLENBQUN2RSxPQUFPLEtBQUt3RSxJQUFJLENBQUN4RSxPQUFPLEVBQUUsT0FBTyxLQUFLO0VBQy9DO0VBQ0E7RUFDQSxNQUFNeUUsWUFBWSxHQUFHRixJQUFJLENBQUN6RCxvQkFBb0IsS0FBS3lELElBQUksQ0FBQzlFLE9BQU8sQ0FBQ2tDLElBQUk7RUFDcEUsTUFBTStDLFlBQVksR0FBR0YsSUFBSSxDQUFDMUQsb0JBQW9CLEtBQUswRCxJQUFJLENBQUMvRSxPQUFPLENBQUNrQyxJQUFJO0VBQ3BFLElBQUk4QyxZQUFZLEtBQUtDLFlBQVksRUFBRSxPQUFPLEtBQUs7RUFDL0MsSUFBSUgsSUFBSSxDQUFDL0QsZ0JBQWdCLEtBQUtnRSxJQUFJLENBQUNoRSxnQkFBZ0IsRUFBRSxPQUFPLEtBQUs7RUFDakU7RUFDQTtFQUNBLElBQUkrRCxJQUFJLENBQUMzRSxjQUFjLEtBQUs0RSxJQUFJLENBQUM1RSxjQUFjLEVBQUUsT0FBTyxLQUFLO0VBQzdELElBQUkyRSxJQUFJLENBQUM5RCxRQUFRLElBQUkrRCxJQUFJLENBQUMvRCxRQUFRLEVBQUUsT0FBTyxJQUFJO0VBQy9DLE9BQU8sS0FBSztBQUNkO0FBRUEsT0FBTyxNQUFNa0UsT0FBTyxHQUFHeEgsS0FBSyxDQUFDeUgsSUFBSSxDQUFDN0QsV0FBVyxFQUFFdUQsb0JBQW9CLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=