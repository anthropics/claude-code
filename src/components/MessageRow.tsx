import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import type { Command } from '../commands.js';
import { Box } from '../ink.js';
import type { Screen } from '../screens/REPL.js';
import type { Tools } from '../Tool.js';
import type { RenderableMessage } from '../types/message.js';
import { getDisplayMessageFromCollapsed, getToolSearchOrReadInfo, getToolUseIdsFromCollapsedGroup, hasAnyToolInProgress } from '../utils/collapseReadSearch.js';
import { type buildMessageLookups, EMPTY_STRING_SET, getProgressMessagesFromLookup, getSiblingToolUseIDsFromLookup, getToolUseID } from '../utils/messages.js';
import { hasThinkingContent, Message } from './Message.js';
import { MessageModel } from './MessageModel.js';
import { shouldRenderStatically } from './Messages.js';
import { MessageTimestamp } from './MessageTimestamp.js';
import { OffscreenFreeze } from './OffscreenFreeze.js';
export type Props = {
  message: RenderableMessage;
  /** Whether the previous message in renderableMessages is also a user message. */
  isUserContinuation: boolean;
  /**
   * Whether there is non-skippable content after this message in renderableMessages.
   * Only needs to be accurate for `collapsed_read_search` messages — used to decide
   * if the collapsed group spinner should stay active. Pass `false` otherwise.
   */
  hasContentAfter: boolean;
  tools: Tools;
  commands: Command[];
  verbose: boolean;
  inProgressToolUseIDs: Set<string>;
  streamingToolUseIDs: Set<string>;
  screen: Screen;
  canAnimate: boolean;
  onOpenRateLimitOptions?: () => void;
  lastThinkingBlockId: string | null;
  latestBashOutputUUID: string | null;
  columns: number;
  isLoading: boolean;
  lookups: ReturnType<typeof buildMessageLookups>;
};

/**
 * Scans forward from `index+1` to check if any "real" content follows. Used to
 * decide whether a collapsed read/search group should stay in its active
 * (grey dot, present-tense "Reading…") state while the query is still loading.
 *
 * Exported so Messages.tsx can compute this once per message and pass the
 * result as a boolean prop — avoids passing the full `renderableMessages` array
 * to each MessageRow (which React Compiler would pin in the fiber's memoCache,
 * accumulating every historical version of the array ≈ 1-2MB over a 7-turn session).
 */
export function hasContentAfterIndex(messages: RenderableMessage[], index: number, tools: Tools, streamingToolUseIDs: Set<string>): boolean {
  for (let i = index + 1; i < messages.length; i++) {
    const msg = messages[i];
    if (msg?.type === 'assistant') {
      const content = msg.message.content[0];
      if (content?.type === 'thinking' || content?.type === 'redacted_thinking') {
        continue;
      }
      if (content?.type === 'tool_use') {
        if (getToolSearchOrReadInfo(content.name, content.input, tools).isCollapsible) {
          continue;
        }
        // Non-collapsible tool uses appear in syntheticStreamingToolUseMessages
        // before their ID is added to inProgressToolUseIDs. Skip while streaming
        // to avoid briefly finalizing the read group.
        if (streamingToolUseIDs.has(content.id)) {
          continue;
        }
      }
      return true;
    }
    if (msg?.type === 'system' || msg?.type === 'attachment') {
      continue;
    }
    // Tool results arrive while the collapsed group is still being built
    if (msg?.type === 'user') {
      const content = msg.message.content[0];
      if (content?.type === 'tool_result') {
        continue;
      }
    }
    // Collapsible grouped_tool_use messages arrive transiently before being
    // merged into the current collapsed group on the next render cycle
    if (msg?.type === 'grouped_tool_use') {
      const firstInput = msg.messages[0]?.message.content[0]?.input;
      if (getToolSearchOrReadInfo(msg.toolName, firstInput, tools).isCollapsible) {
        continue;
      }
    }
    return true;
  }
  return false;
}
function MessageRowImpl(t0) {
  const $ = _c(64);
  const {
    message: msg,
    isUserContinuation,
    hasContentAfter,
    tools,
    commands,
    verbose,
    inProgressToolUseIDs,
    streamingToolUseIDs,
    screen,
    canAnimate,
    onOpenRateLimitOptions,
    lastThinkingBlockId,
    latestBashOutputUUID,
    columns,
    isLoading,
    lookups
  } = t0;
  const isTranscriptMode = screen === "transcript";
  const isGrouped = msg.type === "grouped_tool_use";
  const isCollapsed = msg.type === "collapsed_read_search";
  let t1;
  if ($[0] !== hasContentAfter || $[1] !== inProgressToolUseIDs || $[2] !== isCollapsed || $[3] !== isLoading || $[4] !== msg) {
    t1 = isCollapsed && (hasAnyToolInProgress(msg, inProgressToolUseIDs) || isLoading && !hasContentAfter);
    $[0] = hasContentAfter;
    $[1] = inProgressToolUseIDs;
    $[2] = isCollapsed;
    $[3] = isLoading;
    $[4] = msg;
    $[5] = t1;
  } else {
    t1 = $[5];
  }
  const isActiveCollapsedGroup = t1;
  let t2;
  if ($[6] !== isCollapsed || $[7] !== isGrouped || $[8] !== msg) {
    t2 = isGrouped ? msg.displayMessage : isCollapsed ? getDisplayMessageFromCollapsed(msg) : msg;
    $[6] = isCollapsed;
    $[7] = isGrouped;
    $[8] = msg;
    $[9] = t2;
  } else {
    t2 = $[9];
  }
  const displayMsg = t2;
  let t3;
  if ($[10] !== isCollapsed || $[11] !== isGrouped || $[12] !== lookups || $[13] !== msg) {
    t3 = isGrouped || isCollapsed ? [] : getProgressMessagesFromLookup(msg, lookups);
    $[10] = isCollapsed;
    $[11] = isGrouped;
    $[12] = lookups;
    $[13] = msg;
    $[14] = t3;
  } else {
    t3 = $[14];
  }
  const progressMessagesForMessage = t3;
  let t4;
  if ($[15] !== inProgressToolUseIDs || $[16] !== isCollapsed || $[17] !== isGrouped || $[18] !== lookups || $[19] !== msg || $[20] !== screen || $[21] !== streamingToolUseIDs) {
    const siblingToolUseIDs = isGrouped || isCollapsed ? EMPTY_STRING_SET : getSiblingToolUseIDsFromLookup(msg, lookups);
    t4 = shouldRenderStatically(msg, streamingToolUseIDs, inProgressToolUseIDs, siblingToolUseIDs, screen, lookups);
    $[15] = inProgressToolUseIDs;
    $[16] = isCollapsed;
    $[17] = isGrouped;
    $[18] = lookups;
    $[19] = msg;
    $[20] = screen;
    $[21] = streamingToolUseIDs;
    $[22] = t4;
  } else {
    t4 = $[22];
  }
  const isStatic = t4;
  let shouldAnimate = false;
  if (canAnimate) {
    if (isGrouped) {
      let t5;
      if ($[23] !== inProgressToolUseIDs || $[24] !== msg.messages) {
        let t6;
        if ($[26] !== inProgressToolUseIDs) {
          t6 = m => {
            const content = m.message.content[0];
            return content?.type === "tool_use" && inProgressToolUseIDs.has(content.id);
          };
          $[26] = inProgressToolUseIDs;
          $[27] = t6;
        } else {
          t6 = $[27];
        }
        t5 = msg.messages.some(t6);
        $[23] = inProgressToolUseIDs;
        $[24] = msg.messages;
        $[25] = t5;
      } else {
        t5 = $[25];
      }
      shouldAnimate = t5;
    } else {
      if (isCollapsed) {
        let t5;
        if ($[28] !== inProgressToolUseIDs || $[29] !== msg) {
          t5 = hasAnyToolInProgress(msg, inProgressToolUseIDs);
          $[28] = inProgressToolUseIDs;
          $[29] = msg;
          $[30] = t5;
        } else {
          t5 = $[30];
        }
        shouldAnimate = t5;
      } else {
        let t5;
        if ($[31] !== inProgressToolUseIDs || $[32] !== msg) {
          const toolUseID = getToolUseID(msg);
          t5 = !toolUseID || inProgressToolUseIDs.has(toolUseID);
          $[31] = inProgressToolUseIDs;
          $[32] = msg;
          $[33] = t5;
        } else {
          t5 = $[33];
        }
        shouldAnimate = t5;
      }
    }
  }
  let t5;
  if ($[34] !== displayMsg || $[35] !== isTranscriptMode) {
    t5 = isTranscriptMode && displayMsg.type === "assistant" && displayMsg.message.content.some(_temp) && (displayMsg.timestamp || displayMsg.message.model);
    $[34] = displayMsg;
    $[35] = isTranscriptMode;
    $[36] = t5;
  } else {
    t5 = $[36];
  }
  const hasMetadata = t5;
  const t6 = !hasMetadata;
  const t7 = hasMetadata ? undefined : columns;
  let t8;
  if ($[37] !== commands || $[38] !== inProgressToolUseIDs || $[39] !== isActiveCollapsedGroup || $[40] !== isStatic || $[41] !== isTranscriptMode || $[42] !== isUserContinuation || $[43] !== lastThinkingBlockId || $[44] !== latestBashOutputUUID || $[45] !== lookups || $[46] !== msg || $[47] !== onOpenRateLimitOptions || $[48] !== progressMessagesForMessage || $[49] !== shouldAnimate || $[50] !== t6 || $[51] !== t7 || $[52] !== tools || $[53] !== verbose) {
    t8 = <Message message={msg} lookups={lookups} addMargin={t6} containerWidth={t7} tools={tools} commands={commands} verbose={verbose} inProgressToolUseIDs={inProgressToolUseIDs} progressMessagesForMessage={progressMessagesForMessage} shouldAnimate={shouldAnimate} shouldShowDot={true} isTranscriptMode={isTranscriptMode} isStatic={isStatic} onOpenRateLimitOptions={onOpenRateLimitOptions} isActiveCollapsedGroup={isActiveCollapsedGroup} isUserContinuation={isUserContinuation} lastThinkingBlockId={lastThinkingBlockId} latestBashOutputUUID={latestBashOutputUUID} />;
    $[37] = commands;
    $[38] = inProgressToolUseIDs;
    $[39] = isActiveCollapsedGroup;
    $[40] = isStatic;
    $[41] = isTranscriptMode;
    $[42] = isUserContinuation;
    $[43] = lastThinkingBlockId;
    $[44] = latestBashOutputUUID;
    $[45] = lookups;
    $[46] = msg;
    $[47] = onOpenRateLimitOptions;
    $[48] = progressMessagesForMessage;
    $[49] = shouldAnimate;
    $[50] = t6;
    $[51] = t7;
    $[52] = tools;
    $[53] = verbose;
    $[54] = t8;
  } else {
    t8 = $[54];
  }
  const messageEl = t8;
  if (!hasMetadata) {
    let t9;
    if ($[55] !== messageEl) {
      t9 = <OffscreenFreeze>{messageEl}</OffscreenFreeze>;
      $[55] = messageEl;
      $[56] = t9;
    } else {
      t9 = $[56];
    }
    return t9;
  }
  let t9;
  if ($[57] !== displayMsg || $[58] !== isTranscriptMode) {
    t9 = <Box flexDirection="row" justifyContent="flex-end" gap={1} marginTop={1}><MessageTimestamp message={displayMsg} isTranscriptMode={isTranscriptMode} /><MessageModel message={displayMsg} isTranscriptMode={isTranscriptMode} /></Box>;
    $[57] = displayMsg;
    $[58] = isTranscriptMode;
    $[59] = t9;
  } else {
    t9 = $[59];
  }
  let t10;
  if ($[60] !== columns || $[61] !== messageEl || $[62] !== t9) {
    t10 = <OffscreenFreeze><Box width={columns} flexDirection="column">{t9}{messageEl}</Box></OffscreenFreeze>;
    $[60] = columns;
    $[61] = messageEl;
    $[62] = t9;
    $[63] = t10;
  } else {
    t10 = $[63];
  }
  return t10;
}

/**
 * Checks if a message is "streaming" - i.e., its content may still be changing.
 * Exported for testing.
 */
function _temp(c) {
  return c.type === "text";
}
export function isMessageStreaming(msg: RenderableMessage, streamingToolUseIDs: Set<string>): boolean {
  if (msg.type === 'grouped_tool_use') {
    return msg.messages.some(m => {
      const content = m.message.content[0];
      return content?.type === 'tool_use' && streamingToolUseIDs.has(content.id);
    });
  }
  if (msg.type === 'collapsed_read_search') {
    const toolIds = getToolUseIdsFromCollapsedGroup(msg);
    return toolIds.some(id => streamingToolUseIDs.has(id));
  }
  const toolUseID = getToolUseID(msg);
  return !!toolUseID && streamingToolUseIDs.has(toolUseID);
}

/**
 * Checks if all tools in a message are resolved.
 * Exported for testing.
 */
export function allToolsResolved(msg: RenderableMessage, resolvedToolUseIDs: Set<string>): boolean {
  if (msg.type === 'grouped_tool_use') {
    return msg.messages.every(m => {
      const content = m.message.content[0];
      return content?.type === 'tool_use' && resolvedToolUseIDs.has(content.id);
    });
  }
  if (msg.type === 'collapsed_read_search') {
    const toolIds = getToolUseIdsFromCollapsedGroup(msg);
    return toolIds.every(id => resolvedToolUseIDs.has(id));
  }
  if (msg.type === 'assistant') {
    const block = msg.message.content[0];
    if (block?.type === 'server_tool_use') {
      return resolvedToolUseIDs.has(block.id);
    }
  }
  const toolUseID = getToolUseID(msg);
  return !toolUseID || resolvedToolUseIDs.has(toolUseID);
}

/**
 * Conservative memo comparator that only bails out when we're CERTAIN
 * the message won't change. Fails safe by re-rendering when uncertain.
 *
 * Exported for testing.
 */
export function areMessageRowPropsEqual(prev: Props, next: Props): boolean {
  // Different message reference = content may have changed, must re-render
  if (prev.message !== next.message) return false;

  // Screen mode change = re-render
  if (prev.screen !== next.screen) return false;

  // Verbose toggle changes thinking block visibility
  if (prev.verbose !== next.verbose) return false;

  // collapsed_read_search is never static in prompt mode (matches shouldRenderStatically)
  if (prev.message.type === 'collapsed_read_search' && next.screen !== 'transcript') {
    return false;
  }

  // Width change affects Box layout
  if (prev.columns !== next.columns) return false;

  // latestBashOutputUUID affects rendering (full vs truncated output)
  const prevIsLatestBash = prev.latestBashOutputUUID === prev.message.uuid;
  const nextIsLatestBash = next.latestBashOutputUUID === next.message.uuid;
  if (prevIsLatestBash !== nextIsLatestBash) return false;

  // lastThinkingBlockId affects thinking block visibility — but only for
  // messages that HAVE thinking content. Checking unconditionally busts the
  // memo for every scrollback message whenever thinking starts/stops (CC-941).
  if (prev.lastThinkingBlockId !== next.lastThinkingBlockId && hasThinkingContent(next.message)) {
    return false;
  }

  // Check if this message is still "in flight"
  const isStreaming = isMessageStreaming(prev.message, prev.streamingToolUseIDs);
  const isResolved = allToolsResolved(prev.message, prev.lookups.resolvedToolUseIDs);

  // Only bail out for truly static messages
  if (isStreaming || !isResolved) return false;

  // Static message - safe to skip re-render
  return true;
}
export const MessageRow = React.memo(MessageRowImpl, areMessageRowPropsEqual);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsIkNvbW1hbmQiLCJCb3giLCJTY3JlZW4iLCJUb29scyIsIlJlbmRlcmFibGVNZXNzYWdlIiwiZ2V0RGlzcGxheU1lc3NhZ2VGcm9tQ29sbGFwc2VkIiwiZ2V0VG9vbFNlYXJjaE9yUmVhZEluZm8iLCJnZXRUb29sVXNlSWRzRnJvbUNvbGxhcHNlZEdyb3VwIiwiaGFzQW55VG9vbEluUHJvZ3Jlc3MiLCJidWlsZE1lc3NhZ2VMb29rdXBzIiwiRU1QVFlfU1RSSU5HX1NFVCIsImdldFByb2dyZXNzTWVzc2FnZXNGcm9tTG9va3VwIiwiZ2V0U2libGluZ1Rvb2xVc2VJRHNGcm9tTG9va3VwIiwiZ2V0VG9vbFVzZUlEIiwiaGFzVGhpbmtpbmdDb250ZW50IiwiTWVzc2FnZSIsIk1lc3NhZ2VNb2RlbCIsInNob3VsZFJlbmRlclN0YXRpY2FsbHkiLCJNZXNzYWdlVGltZXN0YW1wIiwiT2Zmc2NyZWVuRnJlZXplIiwiUHJvcHMiLCJtZXNzYWdlIiwiaXNVc2VyQ29udGludWF0aW9uIiwiaGFzQ29udGVudEFmdGVyIiwidG9vbHMiLCJjb21tYW5kcyIsInZlcmJvc2UiLCJpblByb2dyZXNzVG9vbFVzZUlEcyIsIlNldCIsInN0cmVhbWluZ1Rvb2xVc2VJRHMiLCJzY3JlZW4iLCJjYW5BbmltYXRlIiwib25PcGVuUmF0ZUxpbWl0T3B0aW9ucyIsImxhc3RUaGlua2luZ0Jsb2NrSWQiLCJsYXRlc3RCYXNoT3V0cHV0VVVJRCIsImNvbHVtbnMiLCJpc0xvYWRpbmciLCJsb29rdXBzIiwiUmV0dXJuVHlwZSIsImhhc0NvbnRlbnRBZnRlckluZGV4IiwibWVzc2FnZXMiLCJpbmRleCIsImkiLCJsZW5ndGgiLCJtc2ciLCJ0eXBlIiwiY29udGVudCIsIm5hbWUiLCJpbnB1dCIsImlzQ29sbGFwc2libGUiLCJoYXMiLCJpZCIsImZpcnN0SW5wdXQiLCJ0b29sTmFtZSIsIk1lc3NhZ2VSb3dJbXBsIiwidDAiLCIkIiwiX2MiLCJpc1RyYW5zY3JpcHRNb2RlIiwiaXNHcm91cGVkIiwiaXNDb2xsYXBzZWQiLCJ0MSIsImlzQWN0aXZlQ29sbGFwc2VkR3JvdXAiLCJ0MiIsImRpc3BsYXlNZXNzYWdlIiwiZGlzcGxheU1zZyIsInQzIiwicHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2UiLCJ0NCIsInNpYmxpbmdUb29sVXNlSURzIiwiaXNTdGF0aWMiLCJzaG91bGRBbmltYXRlIiwidDUiLCJ0NiIsIm0iLCJzb21lIiwidG9vbFVzZUlEIiwiX3RlbXAiLCJ0aW1lc3RhbXAiLCJtb2RlbCIsImhhc01ldGFkYXRhIiwidDciLCJ1bmRlZmluZWQiLCJ0OCIsIm1lc3NhZ2VFbCIsInQ5IiwidDEwIiwiYyIsImlzTWVzc2FnZVN0cmVhbWluZyIsInRvb2xJZHMiLCJhbGxUb29sc1Jlc29sdmVkIiwicmVzb2x2ZWRUb29sVXNlSURzIiwiZXZlcnkiLCJibG9jayIsImFyZU1lc3NhZ2VSb3dQcm9wc0VxdWFsIiwicHJldiIsIm5leHQiLCJwcmV2SXNMYXRlc3RCYXNoIiwidXVpZCIsIm5leHRJc0xhdGVzdEJhc2giLCJpc1N0cmVhbWluZyIsImlzUmVzb2x2ZWQiLCJNZXNzYWdlUm93IiwibWVtbyJdLCJzb3VyY2VzIjpbIk1lc3NhZ2VSb3cudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHR5cGUgeyBDb21tYW5kIH0gZnJvbSAnLi4vY29tbWFuZHMuanMnXG5pbXBvcnQgeyBCb3ggfSBmcm9tICcuLi9pbmsuanMnXG5pbXBvcnQgdHlwZSB7IFNjcmVlbiB9IGZyb20gJy4uL3NjcmVlbnMvUkVQTC5qcydcbmltcG9ydCB0eXBlIHsgVG9vbHMgfSBmcm9tICcuLi9Ub29sLmpzJ1xuaW1wb3J0IHR5cGUgeyBSZW5kZXJhYmxlTWVzc2FnZSB9IGZyb20gJy4uL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQge1xuICBnZXREaXNwbGF5TWVzc2FnZUZyb21Db2xsYXBzZWQsXG4gIGdldFRvb2xTZWFyY2hPclJlYWRJbmZvLFxuICBnZXRUb29sVXNlSWRzRnJvbUNvbGxhcHNlZEdyb3VwLFxuICBoYXNBbnlUb29sSW5Qcm9ncmVzcyxcbn0gZnJvbSAnLi4vdXRpbHMvY29sbGFwc2VSZWFkU2VhcmNoLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBidWlsZE1lc3NhZ2VMb29rdXBzLFxuICBFTVBUWV9TVFJJTkdfU0VULFxuICBnZXRQcm9ncmVzc01lc3NhZ2VzRnJvbUxvb2t1cCxcbiAgZ2V0U2libGluZ1Rvb2xVc2VJRHNGcm9tTG9va3VwLFxuICBnZXRUb29sVXNlSUQsXG59IGZyb20gJy4uL3V0aWxzL21lc3NhZ2VzLmpzJ1xuaW1wb3J0IHsgaGFzVGhpbmtpbmdDb250ZW50LCBNZXNzYWdlIH0gZnJvbSAnLi9NZXNzYWdlLmpzJ1xuaW1wb3J0IHsgTWVzc2FnZU1vZGVsIH0gZnJvbSAnLi9NZXNzYWdlTW9kZWwuanMnXG5pbXBvcnQgeyBzaG91bGRSZW5kZXJTdGF0aWNhbGx5IH0gZnJvbSAnLi9NZXNzYWdlcy5qcydcbmltcG9ydCB7IE1lc3NhZ2VUaW1lc3RhbXAgfSBmcm9tICcuL01lc3NhZ2VUaW1lc3RhbXAuanMnXG5pbXBvcnQgeyBPZmZzY3JlZW5GcmVlemUgfSBmcm9tICcuL09mZnNjcmVlbkZyZWV6ZS5qcydcblxuZXhwb3J0IHR5cGUgUHJvcHMgPSB7XG4gIG1lc3NhZ2U6IFJlbmRlcmFibGVNZXNzYWdlXG4gIC8qKiBXaGV0aGVyIHRoZSBwcmV2aW91cyBtZXNzYWdlIGluIHJlbmRlcmFibGVNZXNzYWdlcyBpcyBhbHNvIGEgdXNlciBtZXNzYWdlLiAqL1xuICBpc1VzZXJDb250aW51YXRpb246IGJvb2xlYW5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlcmUgaXMgbm9uLXNraXBwYWJsZSBjb250ZW50IGFmdGVyIHRoaXMgbWVzc2FnZSBpbiByZW5kZXJhYmxlTWVzc2FnZXMuXG4gICAqIE9ubHkgbmVlZHMgdG8gYmUgYWNjdXJhdGUgZm9yIGBjb2xsYXBzZWRfcmVhZF9zZWFyY2hgIG1lc3NhZ2VzIOKAlCB1c2VkIHRvIGRlY2lkZVxuICAgKiBpZiB0aGUgY29sbGFwc2VkIGdyb3VwIHNwaW5uZXIgc2hvdWxkIHN0YXkgYWN0aXZlLiBQYXNzIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICAgKi9cbiAgaGFzQ29udGVudEFmdGVyOiBib29sZWFuXG4gIHRvb2xzOiBUb29sc1xuICBjb21tYW5kczogQ29tbWFuZFtdXG4gIHZlcmJvc2U6IGJvb2xlYW5cbiAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM6IFNldDxzdHJpbmc+XG4gIHN0cmVhbWluZ1Rvb2xVc2VJRHM6IFNldDxzdHJpbmc+XG4gIHNjcmVlbjogU2NyZWVuXG4gIGNhbkFuaW1hdGU6IGJvb2xlYW5cbiAgb25PcGVuUmF0ZUxpbWl0T3B0aW9ucz86ICgpID0+IHZvaWRcbiAgbGFzdFRoaW5raW5nQmxvY2tJZDogc3RyaW5nIHwgbnVsbFxuICBsYXRlc3RCYXNoT3V0cHV0VVVJRDogc3RyaW5nIHwgbnVsbFxuICBjb2x1bW5zOiBudW1iZXJcbiAgaXNMb2FkaW5nOiBib29sZWFuXG4gIGxvb2t1cHM6IFJldHVyblR5cGU8dHlwZW9mIGJ1aWxkTWVzc2FnZUxvb2t1cHM+XG59XG5cbi8qKlxuICogU2NhbnMgZm9yd2FyZCBmcm9tIGBpbmRleCsxYCB0byBjaGVjayBpZiBhbnkgXCJyZWFsXCIgY29udGVudCBmb2xsb3dzLiBVc2VkIHRvXG4gKiBkZWNpZGUgd2hldGhlciBhIGNvbGxhcHNlZCByZWFkL3NlYXJjaCBncm91cCBzaG91bGQgc3RheSBpbiBpdHMgYWN0aXZlXG4gKiAoZ3JleSBkb3QsIHByZXNlbnQtdGVuc2UgXCJSZWFkaW5n4oCmXCIpIHN0YXRlIHdoaWxlIHRoZSBxdWVyeSBpcyBzdGlsbCBsb2FkaW5nLlxuICpcbiAqIEV4cG9ydGVkIHNvIE1lc3NhZ2VzLnRzeCBjYW4gY29tcHV0ZSB0aGlzIG9uY2UgcGVyIG1lc3NhZ2UgYW5kIHBhc3MgdGhlXG4gKiByZXN1bHQgYXMgYSBib29sZWFuIHByb3Ag4oCUIGF2b2lkcyBwYXNzaW5nIHRoZSBmdWxsIGByZW5kZXJhYmxlTWVzc2FnZXNgIGFycmF5XG4gKiB0byBlYWNoIE1lc3NhZ2VSb3cgKHdoaWNoIFJlYWN0IENvbXBpbGVyIHdvdWxkIHBpbiBpbiB0aGUgZmliZXIncyBtZW1vQ2FjaGUsXG4gKiBhY2N1bXVsYXRpbmcgZXZlcnkgaGlzdG9yaWNhbCB2ZXJzaW9uIG9mIHRoZSBhcnJheSDiiYggMS0yTUIgb3ZlciBhIDctdHVybiBzZXNzaW9uKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhc0NvbnRlbnRBZnRlckluZGV4KFxuICBtZXNzYWdlczogUmVuZGVyYWJsZU1lc3NhZ2VbXSxcbiAgaW5kZXg6IG51bWJlcixcbiAgdG9vbHM6IFRvb2xzLFxuICBzdHJlYW1pbmdUb29sVXNlSURzOiBTZXQ8c3RyaW5nPixcbik6IGJvb2xlYW4ge1xuICBmb3IgKGxldCBpID0gaW5kZXggKyAxOyBpIDwgbWVzc2FnZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBtc2cgPSBtZXNzYWdlc1tpXVxuICAgIGlmIChtc2c/LnR5cGUgPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gbXNnLm1lc3NhZ2UuY29udGVudFswXVxuICAgICAgaWYgKFxuICAgICAgICBjb250ZW50Py50eXBlID09PSAndGhpbmtpbmcnIHx8XG4gICAgICAgIGNvbnRlbnQ/LnR5cGUgPT09ICdyZWRhY3RlZF90aGlua2luZydcbiAgICAgICkge1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgaWYgKGNvbnRlbnQ/LnR5cGUgPT09ICd0b29sX3VzZScpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGdldFRvb2xTZWFyY2hPclJlYWRJbmZvKGNvbnRlbnQubmFtZSwgY29udGVudC5pbnB1dCwgdG9vbHMpXG4gICAgICAgICAgICAuaXNDb2xsYXBzaWJsZVxuICAgICAgICApIHtcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICAgIC8vIE5vbi1jb2xsYXBzaWJsZSB0b29sIHVzZXMgYXBwZWFyIGluIHN5bnRoZXRpY1N0cmVhbWluZ1Rvb2xVc2VNZXNzYWdlc1xuICAgICAgICAvLyBiZWZvcmUgdGhlaXIgSUQgaXMgYWRkZWQgdG8gaW5Qcm9ncmVzc1Rvb2xVc2VJRHMuIFNraXAgd2hpbGUgc3RyZWFtaW5nXG4gICAgICAgIC8vIHRvIGF2b2lkIGJyaWVmbHkgZmluYWxpemluZyB0aGUgcmVhZCBncm91cC5cbiAgICAgICAgaWYgKHN0cmVhbWluZ1Rvb2xVc2VJRHMuaGFzKGNvbnRlbnQuaWQpKSB7XG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgaWYgKG1zZz8udHlwZSA9PT0gJ3N5c3RlbScgfHwgbXNnPy50eXBlID09PSAnYXR0YWNobWVudCcpIHtcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuICAgIC8vIFRvb2wgcmVzdWx0cyBhcnJpdmUgd2hpbGUgdGhlIGNvbGxhcHNlZCBncm91cCBpcyBzdGlsbCBiZWluZyBidWlsdFxuICAgIGlmIChtc2c/LnR5cGUgPT09ICd1c2VyJykge1xuICAgICAgY29uc3QgY29udGVudCA9IG1zZy5tZXNzYWdlLmNvbnRlbnRbMF1cbiAgICAgIGlmIChjb250ZW50Py50eXBlID09PSAndG9vbF9yZXN1bHQnKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgfVxuICAgIC8vIENvbGxhcHNpYmxlIGdyb3VwZWRfdG9vbF91c2UgbWVzc2FnZXMgYXJyaXZlIHRyYW5zaWVudGx5IGJlZm9yZSBiZWluZ1xuICAgIC8vIG1lcmdlZCBpbnRvIHRoZSBjdXJyZW50IGNvbGxhcHNlZCBncm91cCBvbiB0aGUgbmV4dCByZW5kZXIgY3ljbGVcbiAgICBpZiAobXNnPy50eXBlID09PSAnZ3JvdXBlZF90b29sX3VzZScpIHtcbiAgICAgIGNvbnN0IGZpcnN0SW5wdXQgPSBtc2cubWVzc2FnZXNbMF0/Lm1lc3NhZ2UuY29udGVudFswXT8uaW5wdXRcbiAgICAgIGlmIChcbiAgICAgICAgZ2V0VG9vbFNlYXJjaE9yUmVhZEluZm8obXNnLnRvb2xOYW1lLCBmaXJzdElucHV0LCB0b29scykuaXNDb2xsYXBzaWJsZVxuICAgICAgKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgcmV0dXJuIGZhbHNlXG59XG5cbmZ1bmN0aW9uIE1lc3NhZ2VSb3dJbXBsKHtcbiAgbWVzc2FnZTogbXNnLFxuICBpc1VzZXJDb250aW51YXRpb24sXG4gIGhhc0NvbnRlbnRBZnRlcixcbiAgdG9vbHMsXG4gIGNvbW1hbmRzLFxuICB2ZXJib3NlLFxuICBpblByb2dyZXNzVG9vbFVzZUlEcyxcbiAgc3RyZWFtaW5nVG9vbFVzZUlEcyxcbiAgc2NyZWVuLFxuICBjYW5BbmltYXRlLFxuICBvbk9wZW5SYXRlTGltaXRPcHRpb25zLFxuICBsYXN0VGhpbmtpbmdCbG9ja0lkLFxuICBsYXRlc3RCYXNoT3V0cHV0VVVJRCxcbiAgY29sdW1ucyxcbiAgaXNMb2FkaW5nLFxuICBsb29rdXBzLFxufTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBpc1RyYW5zY3JpcHRNb2RlID0gc2NyZWVuID09PSAndHJhbnNjcmlwdCdcbiAgY29uc3QgaXNHcm91cGVkID0gbXNnLnR5cGUgPT09ICdncm91cGVkX3Rvb2xfdXNlJ1xuICBjb25zdCBpc0NvbGxhcHNlZCA9IG1zZy50eXBlID09PSAnY29sbGFwc2VkX3JlYWRfc2VhcmNoJ1xuXG4gIC8vIEEgY29sbGFwc2VkIGdyb3VwIGlzIFwiYWN0aXZlXCIgKGdyZXkgZG90LCBwcmVzZW50IHRlbnNlIFwiUmVhZGluZ+KAplwiKSB3aGVuIGl0cyB0b29sc1xuICAvLyBhcmUgc3RpbGwgZXhlY3V0aW5nIE9SIHdoZW4gdGhlIG92ZXJhbGwgcXVlcnkgaXMgc3RpbGwgcnVubmluZyB3aXRoIG5vdGhpbmcgYWZ0ZXIgaXQuXG4gIC8vIGhhc0FueVRvb2xJblByb2dyZXNzIHRha2VzIHByaW9yaXR5OiBpZiB0b29scyBhcmUgcnVubmluZywgYWx3YXlzIHNob3cgYWN0aXZlIHJlZ2FyZGxlc3NcbiAgLy8gb2Ygd2hhdCBlbHNlIGlzIGluIHRoZSBtZXNzYWdlIGxpc3QgKGF2b2lkcyBmYWxzZSBmaW5hbGl6YXRpb24gZHVyaW5nIHBhcmFsbGVsIGV4ZWN1dGlvbikuXG4gIGNvbnN0IGlzQWN0aXZlQ29sbGFwc2VkR3JvdXAgPVxuICAgIGlzQ29sbGFwc2VkICYmXG4gICAgKGhhc0FueVRvb2xJblByb2dyZXNzKG1zZywgaW5Qcm9ncmVzc1Rvb2xVc2VJRHMpIHx8XG4gICAgICAoaXNMb2FkaW5nICYmICFoYXNDb250ZW50QWZ0ZXIpKVxuXG4gIGNvbnN0IGRpc3BsYXlNc2cgPSBpc0dyb3VwZWRcbiAgICA/IG1zZy5kaXNwbGF5TWVzc2FnZVxuICAgIDogaXNDb2xsYXBzZWRcbiAgICAgID8gZ2V0RGlzcGxheU1lc3NhZ2VGcm9tQ29sbGFwc2VkKG1zZylcbiAgICAgIDogbXNnXG5cbiAgY29uc3QgcHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2UgPVxuICAgIGlzR3JvdXBlZCB8fCBpc0NvbGxhcHNlZCA/IFtdIDogZ2V0UHJvZ3Jlc3NNZXNzYWdlc0Zyb21Mb29rdXAobXNnLCBsb29rdXBzKVxuXG4gIGNvbnN0IHNpYmxpbmdUb29sVXNlSURzID1cbiAgICBpc0dyb3VwZWQgfHwgaXNDb2xsYXBzZWRcbiAgICAgID8gRU1QVFlfU1RSSU5HX1NFVFxuICAgICAgOiBnZXRTaWJsaW5nVG9vbFVzZUlEc0Zyb21Mb29rdXAobXNnLCBsb29rdXBzKVxuXG4gIGNvbnN0IGlzU3RhdGljID0gc2hvdWxkUmVuZGVyU3RhdGljYWxseShcbiAgICBtc2csXG4gICAgc3RyZWFtaW5nVG9vbFVzZUlEcyxcbiAgICBpblByb2dyZXNzVG9vbFVzZUlEcyxcbiAgICBzaWJsaW5nVG9vbFVzZUlEcyxcbiAgICBzY3JlZW4sXG4gICAgbG9va3VwcyxcbiAgKVxuXG4gIGxldCBzaG91bGRBbmltYXRlID0gZmFsc2VcbiAgaWYgKGNhbkFuaW1hdGUpIHtcbiAgICBpZiAoaXNHcm91cGVkKSB7XG4gICAgICBzaG91bGRBbmltYXRlID0gbXNnLm1lc3NhZ2VzLnNvbWUobSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBtLm1lc3NhZ2UuY29udGVudFswXVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIGNvbnRlbnQ/LnR5cGUgPT09ICd0b29sX3VzZScgJiYgaW5Qcm9ncmVzc1Rvb2xVc2VJRHMuaGFzKGNvbnRlbnQuaWQpXG4gICAgICAgIClcbiAgICAgIH0pXG4gICAgfSBlbHNlIGlmIChpc0NvbGxhcHNlZCkge1xuICAgICAgc2hvdWxkQW5pbWF0ZSA9IGhhc0FueVRvb2xJblByb2dyZXNzKG1zZywgaW5Qcm9ncmVzc1Rvb2xVc2VJRHMpXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRvb2xVc2VJRCA9IGdldFRvb2xVc2VJRChtc2cpXG4gICAgICBzaG91bGRBbmltYXRlID0gIXRvb2xVc2VJRCB8fCBpblByb2dyZXNzVG9vbFVzZUlEcy5oYXModG9vbFVzZUlEKVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGhhc01ldGFkYXRhID1cbiAgICBpc1RyYW5zY3JpcHRNb2RlICYmXG4gICAgZGlzcGxheU1zZy50eXBlID09PSAnYXNzaXN0YW50JyAmJlxuICAgIGRpc3BsYXlNc2cubWVzc2FnZS5jb250ZW50LnNvbWUoYyA9PiBjLnR5cGUgPT09ICd0ZXh0JykgJiZcbiAgICAoZGlzcGxheU1zZy50aW1lc3RhbXAgfHwgZGlzcGxheU1zZy5tZXNzYWdlLm1vZGVsKVxuXG4gIGNvbnN0IG1lc3NhZ2VFbCA9IChcbiAgICA8TWVzc2FnZVxuICAgICAgbWVzc2FnZT17bXNnfVxuICAgICAgbG9va3Vwcz17bG9va3Vwc31cbiAgICAgIGFkZE1hcmdpbj17IWhhc01ldGFkYXRhfVxuICAgICAgY29udGFpbmVyV2lkdGg9e2hhc01ldGFkYXRhID8gdW5kZWZpbmVkIDogY29sdW1uc31cbiAgICAgIHRvb2xzPXt0b29sc31cbiAgICAgIGNvbW1hbmRzPXtjb21tYW5kc31cbiAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICBpblByb2dyZXNzVG9vbFVzZUlEcz17aW5Qcm9ncmVzc1Rvb2xVc2VJRHN9XG4gICAgICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZT17cHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2V9XG4gICAgICBzaG91bGRBbmltYXRlPXtzaG91bGRBbmltYXRlfVxuICAgICAgc2hvdWxkU2hvd0RvdD17dHJ1ZX1cbiAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2lzVHJhbnNjcmlwdE1vZGV9XG4gICAgICBpc1N0YXRpYz17aXNTdGF0aWN9XG4gICAgICBvbk9wZW5SYXRlTGltaXRPcHRpb25zPXtvbk9wZW5SYXRlTGltaXRPcHRpb25zfVxuICAgICAgaXNBY3RpdmVDb2xsYXBzZWRHcm91cD17aXNBY3RpdmVDb2xsYXBzZWRHcm91cH1cbiAgICAgIGlzVXNlckNvbnRpbnVhdGlvbj17aXNVc2VyQ29udGludWF0aW9ufVxuICAgICAgbGFzdFRoaW5raW5nQmxvY2tJZD17bGFzdFRoaW5raW5nQmxvY2tJZH1cbiAgICAgIGxhdGVzdEJhc2hPdXRwdXRVVUlEPXtsYXRlc3RCYXNoT3V0cHV0VVVJRH1cbiAgICAvPlxuICApXG4gIC8vIE9mZnNjcmVlbkZyZWV6ZTogdGhlIG91dGVyIFJlYWN0Lm1lbW8gYWxyZWFkeSBiYWlscyBmb3Igc3RhdGljIG1lc3NhZ2VzLFxuICAvLyBzbyB0aGlzIG9ubHkgd3JhcHMgcm93cyB0aGF0IERPIHJlLXJlbmRlciDigJQgaW4tcHJvZ3Jlc3MgdG9vbHMsIGNvbGxhcHNlZFxuICAvLyByZWFkL3NlYXJjaCBzcGlubmVycywgYmFzaCBlbGFwc2VkIHRpbWVycy4gV2hlbiB0aG9zZSByb3dzIGhhdmUgc2Nyb2xsZWRcbiAgLy8gaW50byB0ZXJtaW5hbCBzY3JvbGxiYWNrIChub24tZnVsbHNjcmVlbiBleHRlcm5hbCBidWlsZHMpLCBhbnkgY29udGVudFxuICAvLyBjaGFuZ2UgZm9yY2VzIGxvZy11cGRhdGUudHMgaW50byBhIGZ1bGwgdGVybWluYWwgcmVzZXQgcGVyIHRpY2suIEZyZWV6aW5nXG4gIC8vIHJldHVybnMgdGhlIGNhY2hlZCBlbGVtZW50IHJlZiBzbyBSZWFjdCBiYWlscyBhbmQgcHJvZHVjZXMgemVybyBkaWZmLlxuICBpZiAoIWhhc01ldGFkYXRhKSB7XG4gICAgcmV0dXJuIDxPZmZzY3JlZW5GcmVlemU+e21lc3NhZ2VFbH08L09mZnNjcmVlbkZyZWV6ZT5cbiAgfVxuICAvLyBNYXJnaW4gb24gY2hpbGRyZW4sIG5vdCBoZXJlIOKAlCBlbHNlIG51bGwgaXRlbXMgKGhvb2tfc3VjY2VzcyBldGMuKSBnZXQgcGhhbnRvbSAxLXJvdyBzcGFjaW5nLlxuICByZXR1cm4gKFxuICAgIDxPZmZzY3JlZW5GcmVlemU+XG4gICAgICA8Qm94IHdpZHRoPXtjb2x1bW5zfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxCb3hcbiAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwicm93XCJcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudD1cImZsZXgtZW5kXCJcbiAgICAgICAgICBnYXA9ezF9XG4gICAgICAgICAgbWFyZ2luVG9wPXsxfVxuICAgICAgICA+XG4gICAgICAgICAgPE1lc3NhZ2VUaW1lc3RhbXBcbiAgICAgICAgICAgIG1lc3NhZ2U9e2Rpc3BsYXlNc2d9XG4gICAgICAgICAgICBpc1RyYW5zY3JpcHRNb2RlPXtpc1RyYW5zY3JpcHRNb2RlfVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPE1lc3NhZ2VNb2RlbFxuICAgICAgICAgICAgbWVzc2FnZT17ZGlzcGxheU1zZ31cbiAgICAgICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2lzVHJhbnNjcmlwdE1vZGV9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIHttZXNzYWdlRWx9XG4gICAgICA8L0JveD5cbiAgICA8L09mZnNjcmVlbkZyZWV6ZT5cbiAgKVxufVxuXG4vKipcbiAqIENoZWNrcyBpZiBhIG1lc3NhZ2UgaXMgXCJzdHJlYW1pbmdcIiAtIGkuZS4sIGl0cyBjb250ZW50IG1heSBzdGlsbCBiZSBjaGFuZ2luZy5cbiAqIEV4cG9ydGVkIGZvciB0ZXN0aW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNNZXNzYWdlU3RyZWFtaW5nKFxuICBtc2c6IFJlbmRlcmFibGVNZXNzYWdlLFxuICBzdHJlYW1pbmdUb29sVXNlSURzOiBTZXQ8c3RyaW5nPixcbik6IGJvb2xlYW4ge1xuICBpZiAobXNnLnR5cGUgPT09ICdncm91cGVkX3Rvb2xfdXNlJykge1xuICAgIHJldHVybiBtc2cubWVzc2FnZXMuc29tZShtID0+IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBtLm1lc3NhZ2UuY29udGVudFswXVxuICAgICAgcmV0dXJuIGNvbnRlbnQ/LnR5cGUgPT09ICd0b29sX3VzZScgJiYgc3RyZWFtaW5nVG9vbFVzZUlEcy5oYXMoY29udGVudC5pZClcbiAgICB9KVxuICB9XG4gIGlmIChtc2cudHlwZSA9PT0gJ2NvbGxhcHNlZF9yZWFkX3NlYXJjaCcpIHtcbiAgICBjb25zdCB0b29sSWRzID0gZ2V0VG9vbFVzZUlkc0Zyb21Db2xsYXBzZWRHcm91cChtc2cpXG4gICAgcmV0dXJuIHRvb2xJZHMuc29tZShpZCA9PiBzdHJlYW1pbmdUb29sVXNlSURzLmhhcyhpZCkpXG4gIH1cbiAgY29uc3QgdG9vbFVzZUlEID0gZ2V0VG9vbFVzZUlEKG1zZylcbiAgcmV0dXJuICEhdG9vbFVzZUlEICYmIHN0cmVhbWluZ1Rvb2xVc2VJRHMuaGFzKHRvb2xVc2VJRClcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYWxsIHRvb2xzIGluIGEgbWVzc2FnZSBhcmUgcmVzb2x2ZWQuXG4gKiBFeHBvcnRlZCBmb3IgdGVzdGluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFsbFRvb2xzUmVzb2x2ZWQoXG4gIG1zZzogUmVuZGVyYWJsZU1lc3NhZ2UsXG4gIHJlc29sdmVkVG9vbFVzZUlEczogU2V0PHN0cmluZz4sXG4pOiBib29sZWFuIHtcbiAgaWYgKG1zZy50eXBlID09PSAnZ3JvdXBlZF90b29sX3VzZScpIHtcbiAgICByZXR1cm4gbXNnLm1lc3NhZ2VzLmV2ZXJ5KG0gPT4ge1xuICAgICAgY29uc3QgY29udGVudCA9IG0ubWVzc2FnZS5jb250ZW50WzBdXG4gICAgICByZXR1cm4gY29udGVudD8udHlwZSA9PT0gJ3Rvb2xfdXNlJyAmJiByZXNvbHZlZFRvb2xVc2VJRHMuaGFzKGNvbnRlbnQuaWQpXG4gICAgfSlcbiAgfVxuICBpZiAobXNnLnR5cGUgPT09ICdjb2xsYXBzZWRfcmVhZF9zZWFyY2gnKSB7XG4gICAgY29uc3QgdG9vbElkcyA9IGdldFRvb2xVc2VJZHNGcm9tQ29sbGFwc2VkR3JvdXAobXNnKVxuICAgIHJldHVybiB0b29sSWRzLmV2ZXJ5KGlkID0+IHJlc29sdmVkVG9vbFVzZUlEcy5oYXMoaWQpKVxuICB9XG4gIGlmIChtc2cudHlwZSA9PT0gJ2Fzc2lzdGFudCcpIHtcbiAgICBjb25zdCBibG9jayA9IG1zZy5tZXNzYWdlLmNvbnRlbnRbMF1cbiAgICBpZiAoYmxvY2s/LnR5cGUgPT09ICdzZXJ2ZXJfdG9vbF91c2UnKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZWRUb29sVXNlSURzLmhhcyhibG9jay5pZClcbiAgICB9XG4gIH1cbiAgY29uc3QgdG9vbFVzZUlEID0gZ2V0VG9vbFVzZUlEKG1zZylcbiAgcmV0dXJuICF0b29sVXNlSUQgfHwgcmVzb2x2ZWRUb29sVXNlSURzLmhhcyh0b29sVXNlSUQpXG59XG5cbi8qKlxuICogQ29uc2VydmF0aXZlIG1lbW8gY29tcGFyYXRvciB0aGF0IG9ubHkgYmFpbHMgb3V0IHdoZW4gd2UncmUgQ0VSVEFJTlxuICogdGhlIG1lc3NhZ2Ugd29uJ3QgY2hhbmdlLiBGYWlscyBzYWZlIGJ5IHJlLXJlbmRlcmluZyB3aGVuIHVuY2VydGFpbi5cbiAqXG4gKiBFeHBvcnRlZCBmb3IgdGVzdGluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFyZU1lc3NhZ2VSb3dQcm9wc0VxdWFsKHByZXY6IFByb3BzLCBuZXh0OiBQcm9wcyk6IGJvb2xlYW4ge1xuICAvLyBEaWZmZXJlbnQgbWVzc2FnZSByZWZlcmVuY2UgPSBjb250ZW50IG1heSBoYXZlIGNoYW5nZWQsIG11c3QgcmUtcmVuZGVyXG4gIGlmIChwcmV2Lm1lc3NhZ2UgIT09IG5leHQubWVzc2FnZSkgcmV0dXJuIGZhbHNlXG5cbiAgLy8gU2NyZWVuIG1vZGUgY2hhbmdlID0gcmUtcmVuZGVyXG4gIGlmIChwcmV2LnNjcmVlbiAhPT0gbmV4dC5zY3JlZW4pIHJldHVybiBmYWxzZVxuXG4gIC8vIFZlcmJvc2UgdG9nZ2xlIGNoYW5nZXMgdGhpbmtpbmcgYmxvY2sgdmlzaWJpbGl0eVxuICBpZiAocHJldi52ZXJib3NlICE9PSBuZXh0LnZlcmJvc2UpIHJldHVybiBmYWxzZVxuXG4gIC8vIGNvbGxhcHNlZF9yZWFkX3NlYXJjaCBpcyBuZXZlciBzdGF0aWMgaW4gcHJvbXB0IG1vZGUgKG1hdGNoZXMgc2hvdWxkUmVuZGVyU3RhdGljYWxseSlcbiAgaWYgKFxuICAgIHByZXYubWVzc2FnZS50eXBlID09PSAnY29sbGFwc2VkX3JlYWRfc2VhcmNoJyAmJlxuICAgIG5leHQuc2NyZWVuICE9PSAndHJhbnNjcmlwdCdcbiAgKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICAvLyBXaWR0aCBjaGFuZ2UgYWZmZWN0cyBCb3ggbGF5b3V0XG4gIGlmIChwcmV2LmNvbHVtbnMgIT09IG5leHQuY29sdW1ucykgcmV0dXJuIGZhbHNlXG5cbiAgLy8gbGF0ZXN0QmFzaE91dHB1dFVVSUQgYWZmZWN0cyByZW5kZXJpbmcgKGZ1bGwgdnMgdHJ1bmNhdGVkIG91dHB1dClcbiAgY29uc3QgcHJldklzTGF0ZXN0QmFzaCA9IHByZXYubGF0ZXN0QmFzaE91dHB1dFVVSUQgPT09IHByZXYubWVzc2FnZS51dWlkXG4gIGNvbnN0IG5leHRJc0xhdGVzdEJhc2ggPSBuZXh0LmxhdGVzdEJhc2hPdXRwdXRVVUlEID09PSBuZXh0Lm1lc3NhZ2UudXVpZFxuICBpZiAocHJldklzTGF0ZXN0QmFzaCAhPT0gbmV4dElzTGF0ZXN0QmFzaCkgcmV0dXJuIGZhbHNlXG5cbiAgLy8gbGFzdFRoaW5raW5nQmxvY2tJZCBhZmZlY3RzIHRoaW5raW5nIGJsb2NrIHZpc2liaWxpdHkg4oCUIGJ1dCBvbmx5IGZvclxuICAvLyBtZXNzYWdlcyB0aGF0IEhBVkUgdGhpbmtpbmcgY29udGVudC4gQ2hlY2tpbmcgdW5jb25kaXRpb25hbGx5IGJ1c3RzIHRoZVxuICAvLyBtZW1vIGZvciBldmVyeSBzY3JvbGxiYWNrIG1lc3NhZ2Ugd2hlbmV2ZXIgdGhpbmtpbmcgc3RhcnRzL3N0b3BzIChDQy05NDEpLlxuICBpZiAoXG4gICAgcHJldi5sYXN0VGhpbmtpbmdCbG9ja0lkICE9PSBuZXh0Lmxhc3RUaGlua2luZ0Jsb2NrSWQgJiZcbiAgICBoYXNUaGlua2luZ0NvbnRlbnQobmV4dC5tZXNzYWdlKVxuICApIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIC8vIENoZWNrIGlmIHRoaXMgbWVzc2FnZSBpcyBzdGlsbCBcImluIGZsaWdodFwiXG4gIGNvbnN0IGlzU3RyZWFtaW5nID0gaXNNZXNzYWdlU3RyZWFtaW5nKHByZXYubWVzc2FnZSwgcHJldi5zdHJlYW1pbmdUb29sVXNlSURzKVxuICBjb25zdCBpc1Jlc29sdmVkID0gYWxsVG9vbHNSZXNvbHZlZChcbiAgICBwcmV2Lm1lc3NhZ2UsXG4gICAgcHJldi5sb29rdXBzLnJlc29sdmVkVG9vbFVzZUlEcyxcbiAgKVxuXG4gIC8vIE9ubHkgYmFpbCBvdXQgZm9yIHRydWx5IHN0YXRpYyBtZXNzYWdlc1xuICBpZiAoaXNTdHJlYW1pbmcgfHwgIWlzUmVzb2x2ZWQpIHJldHVybiBmYWxzZVxuXG4gIC8vIFN0YXRpYyBtZXNzYWdlIC0gc2FmZSB0byBza2lwIHJlLXJlbmRlclxuICByZXR1cm4gdHJ1ZVxufVxuXG5leHBvcnQgY29uc3QgTWVzc2FnZVJvdyA9IFJlYWN0Lm1l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