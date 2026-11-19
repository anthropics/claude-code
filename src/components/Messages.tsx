import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import chalk from 'chalk';
import type { UUID } from 'crypto';
import type { RefObject } from 'react';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { every } from 'src/utils/set.js';
import { getIsRemoteMode } from '../bootstrap/state.js';
import type { Command } from '../commands.js';
import { BLACK_CIRCLE } from '../constants/figures.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import type { ScrollBoxHandle } from '../ink/components/ScrollBox.js';
import { useTerminalNotification } from '../ink/useTerminalNotification.js';
import { Box, Text } from '../ink.js';
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay.js';
import type { Screen } from '../screens/REPL.js';
import type { Tools } from '../Tool.js';
import { findToolByName } from '../Tool.js';
import type { AgentDefinitionsResult } from '../tools/AgentTool/loadAgentsDir.js';
import type { Message as MessageType, NormalizedMessage, ProgressMessage as ProgressMessageType, RenderableMessage } from '../types/message.js';
import { type AdvisorBlock, isAdvisorBlock } from '../utils/advisor.js';
import { collapseBackgroundBashNotifications } from '../utils/collapseBackgroundBashNotifications.js';
import { collapseHookSummaries } from '../utils/collapseHookSummaries.js';
import { collapseReadSearchGroups } from '../utils/collapseReadSearch.js';
import { collapseTeammateShutdowns } from '../utils/collapseTeammateShutdowns.js';
import { getGlobalConfig } from '../utils/config.js';
import { isEnvTruthy } from '../utils/envUtils.js';
import { isFullscreenEnvEnabled } from '../utils/fullscreen.js';
import { applyGrouping } from '../utils/groupToolUses.js';
import { buildMessageLookups, createAssistantMessage, deriveUUID, getMessagesAfterCompactBoundary, getToolUseID, getToolUseIDs, hasUnresolvedHooksFromLookup, isNotEmptyMessage, normalizeMessages, reorderMessagesInUI, type StreamingThinking, type StreamingToolUse, shouldShowUserMessage } from '../utils/messages.js';
import { plural } from '../utils/stringUtils.js';
import { renderableSearchText } from '../utils/transcriptSearch.js';
import { Divider } from './design-system/Divider.js';
import type { UnseenDivider } from './FullscreenLayout.js';
import { LogoV2 } from './LogoV2/LogoV2.js';
import { StreamingMarkdown } from './Markdown.js';
import { hasContentAfterIndex, MessageRow } from './MessageRow.js';
import { InVirtualListContext, type MessageActionsNav, MessageActionsSelectedContext, type MessageActionsState } from './messageActions.js';
import { AssistantThinkingMessage } from './messages/AssistantThinkingMessage.js';
import { isNullRenderingAttachment } from './messages/nullRenderingAttachments.js';
import { OffscreenFreeze } from './OffscreenFreeze.js';
import type { ToolUseConfirm } from './permissions/PermissionRequest.js';
import { StatusNotices } from './StatusNotices.js';
import type { JumpHandle } from './VirtualMessageList.js';

// Memoed logo header: this box is the FIRST sibling before all MessageRows
// in main-screen mode. If it becomes dirty on every Messages re-render,
// renderChildren's seenDirtyChild cascade disables prevScreen (blit) for
// ALL subsequent siblings — every MessageRow re-writes from scratch instead
// of blitting. In long sessions (~2800 messages) this is 150K+ writes/frame
// and pegs CPU at 100%. Memo on agentDefinitions so a new messages array
// doesn't invalidate the logo subtree. LogoV2/StatusNotices internally
// subscribe to useAppState/useSettings for their own updates.
const LogoHeader = React.memo(function LogoHeader(t0) {
  const $ = _c(3);
  const {
    agentDefinitions
  } = t0;
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = <LogoV2 />;
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  let t2;
  if ($[1] !== agentDefinitions) {
    t2 = <OffscreenFreeze><Box flexDirection="column" gap={1}>{t1}<React.Suspense fallback={null}><StatusNotices agentDefinitions={agentDefinitions} /></React.Suspense></Box></OffscreenFreeze>;
    $[1] = agentDefinitions;
    $[2] = t2;
  } else {
    t2 = $[2];
  }
  return t2;
});

// Dead code elimination: conditional import for proactive mode
/* eslint-disable @typescript-eslint/no-require-imports */
const proactiveModule = feature('PROACTIVE') || feature('KAIROS') ? require('../proactive/index.js') : null;
const BRIEF_TOOL_NAME: string | null = feature('KAIROS') || feature('KAIROS_BRIEF') ? (require('../tools/BriefTool/prompt.js') as typeof import('../tools/BriefTool/prompt.js')).BRIEF_TOOL_NAME : null;
const SEND_USER_FILE_TOOL_NAME: string | null = feature('KAIROS') ? (require('../tools/SendUserFileTool/prompt.js') as typeof import('../tools/SendUserFileTool/prompt.js')).SEND_USER_FILE_TOOL_NAME : null;

/* eslint-enable @typescript-eslint/no-require-imports */
import { VirtualMessageList } from './VirtualMessageList.js';

/**
 * In brief-only mode, filter messages to show ONLY Brief tool_use blocks,
 * their tool_results, and real user input. All assistant text is dropped —
 * if the model forgets to call Brief, the user sees nothing for that turn.
 * That's on the model to get right; the filter does not second-guess it.
 */
export function filterForBriefTool<T extends {
  type: string;
  subtype?: string;
  isMeta?: boolean;
  isApiErrorMessage?: boolean;
  message?: {
    content: Array<{
      type: string;
      name?: string;
      tool_use_id?: string;
    }>;
  };
  attachment?: {
    type: string;
    isMeta?: boolean;
    origin?: unknown;
    commandMode?: string;
  };
}>(messages: T[], briefToolNames: string[]): T[] {
  const nameSet = new Set(briefToolNames);
  // tool_use always precedes its tool_result in the array, so we can collect
  // IDs and match against them in a single pass.
  const briefToolUseIDs = new Set<string>();
  return messages.filter(msg => {
    // System messages (attach confirmation, remote errors, compact boundaries)
    // must stay visible — dropping them leaves the viewer with no feedback.
    // Exception: api_metrics is per-turn debug noise (TTFT, config writes,
    // hook timing) that defeats the point of brief mode. Still visible in
    // transcript mode (ctrl+o) which bypasses this filter.
    if (msg.type === 'system') return msg.subtype !== 'api_metrics';
    const block = msg.message?.content[0];
    if (msg.type === 'assistant') {
      // API error messages (auth failures, rate limits, etc.) must stay visible
      if (msg.isApiErrorMessage) return true;
      // Keep Brief tool_use blocks (renders with standard tool call chrome,
      // and must be in the list so buildMessageLookups can resolve tool results)
      if (block?.type === 'tool_use' && block.name && nameSet.has(block.name)) {
        if ('id' in block) {
          briefToolUseIDs.add((block as {
            id: string;
          }).id);
        }
        return true;
      }
      return false;
    }
    if (msg.type === 'user') {
      if (block?.type === 'tool_result') {
        return block.tool_use_id !== undefined && briefToolUseIDs.has(block.tool_use_id);
      }
      // Real user input only — drop meta/tick messages.
      return !msg.isMeta;
    }
    if (msg.type === 'attachment') {
      // Human input drained mid-turn arrives as a queued_command attachment
      // (query.ts mid-chain drain → getQueuedCommandAttachments). Keep it —
      // it's what the user typed. commandMode === 'prompt' positively
      // identifies human-typed input; task-notification callers set
      // mode: 'task-notification' but not origin/isMeta, so the positive
      // commandMode check is required to exclude them.
      const att = msg.attachment;
      return att?.type === 'queued_command' && att.commandMode === 'prompt' && !att.isMeta && att.origin === undefined;
    }
    return false;
  });
}

/**
 * Full-transcript companion to filterForBriefTool. When the Brief tool is
 * in use, the model's text output is redundant with the SendUserMessage
 * content it wrote right after — drop the text so only the SendUserMessage
 * block shows. Tool calls and their results stay visible.
 *
 * Per-turn: only drops text in turns that actually called Brief. If the
 * model forgets, text still shows — otherwise the user would see nothing.
 */
export function dropTextInBriefTurns<T extends {
  type: string;
  isMeta?: boolean;
  message?: {
    content: Array<{
      type: string;
      name?: string;
    }>;
  };
}>(messages: T[], briefToolNames: string[]): T[] {
  const nameSet = new Set(briefToolNames);
  // First pass: find which turns (bounded by non-meta user messages) contain
  // a Brief tool_use. Tag each assistant text block with its turn index.
  const turnsWithBrief = new Set<number>();
  const textIndexToTurn: number[] = [];
  let turn = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const block = msg.message?.content[0];
    if (msg.type === 'user' && block?.type !== 'tool_result' && !msg.isMeta) {
      turn++;
      continue;
    }
    if (msg.type === 'assistant') {
      if (block?.type === 'text') {
        textIndexToTurn[i] = turn;
      } else if (block?.type === 'tool_use' && block.name && nameSet.has(block.name)) {
        turnsWithBrief.add(turn);
      }
    }
  }
  if (turnsWithBrief.size === 0) return messages;
  // Second pass: drop text blocks whose turn called Brief.
  return messages.filter((_, i) => {
    const t = textIndexToTurn[i];
    return t === undefined || !turnsWithBrief.has(t);
  });
}
type Props = {
  messages: MessageType[];
  tools: Tools;
  commands: Command[];
  verbose: boolean;
  toolJSX: {
    jsx: React.ReactNode | null;
    shouldHidePromptInput: boolean;
    shouldContinueAnimation?: true;
  } | null;
  toolUseConfirmQueue: ToolUseConfirm[];
  inProgressToolUseIDs: Set<string>;
  isMessageSelectorVisible: boolean;
  conversationId: string;
  screen: Screen;
  streamingToolUses: StreamingToolUse[];
  showAllInTranscript?: boolean;
  agentDefinitions?: AgentDefinitionsResult;
  onOpenRateLimitOptions?: () => void;
  /** Hide the logo/header - used for subagent zoom view */
  hideLogo?: boolean;
  isLoading: boolean;
  /** In transcript mode, hide all thinking blocks except the last one */
  hidePastThinking?: boolean;
  /** Streaming thinking content (live updates, not frozen) */
  streamingThinking?: StreamingThinking | null;
  /** Streaming text preview (rendered as last item so transition to final message is positionally seamless) */
  streamingText?: string | null;
  /** When true, only show Brief tool output (hide everything else) */
  isBriefOnly?: boolean;
  /** Fullscreen-mode "─── N new ───" divider. Renders before the first
   *  renderableMessage derived from firstUnseenUuid (matched by the 24-char
   *  prefix that deriveUUID preserves). */
  unseenDivider?: UnseenDivider;
  /** Fullscreen-mode ScrollBox handle. Enables React-level virtualization when present. */
  scrollRef?: RefObject<ScrollBoxHandle | null>;
  /** Fullscreen-mode: enable sticky-prompt tracking (writes via ScrollChromeContext). */
  trackStickyPrompt?: boolean;
  /** Transcript search: jump-to-index + setSearchQuery/nextMatch/prevMatch. */
  jumpRef?: RefObject<JumpHandle | null>;
  /** Transcript search: fires when match count/position changes. */
  onSearchMatchesChange?: (count: number, current: number) => void;
  /** Paint an existing DOM subtree to fresh Screen, scan. Element comes
   *  from the main tree (all real providers). Message-relative positions. */
  scanElement?: (el: import('../ink/dom.js').DOMElement) => import('../ink/render-to-screen.js').MatchPosition[];
  /** Position-based CURRENT highlight. positions stable (msg-relative),
   *  rowOffset tracks scroll. null clears. */
  setPositions?: (state: {
    positions: import('../ink/render-to-screen.js').MatchPosition[];
    rowOffset: number;
    currentIdx: number;
  } | null) => void;
  /** Bypass MAX_MESSAGES_WITHOUT_VIRTUALIZATION. For one-shot headless renders
   *  (e.g. /export via renderToString) where the memory concern doesn't apply
   *  and the "already in scrollback" justification doesn't hold. */
  disableRenderCap?: boolean;
  /** In-transcript cursor; expanded overrides verbose for selected message. */
  cursor?: MessageActionsState | null;
  setCursor?: (cursor: MessageActionsState | null) => void;
  /** Passed through to VirtualMessageList (heightCache owns visibility). */
  cursorNavRef?: React.Ref<MessageActionsNav>;
  /** Render only collapsed.slice(start, end). For chunked headless export
   *  (streamRenderedMessages in exportRenderer.tsx): prep runs on the FULL
   *  messages array so grouping/lookups are correct, but only this slice
   *  chunk instead of the full session. The logo renders only for chunk 0
   *  (start === 0); later chunks are mid-stream continuations.
   *  Measured Mar 2026: 538-msg session, 20 slices → −55% plateau RSS. */
  renderRange?: readonly [start: number, end: number];
};
const MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE = 30;

// Safety cap for the non-virtualized render path (fullscreen off or
// explicitly disabled). Ink mounts a full fiber tree per message (~250 KB
// RSS each); yoga layout height grows unbounded; the screen buffer is sized
// to fit every line. At ~2000 messages this is ~3000-line screens, ~500 MB
// of fibers, and per-frame write costs that push the process into a GC
// death spiral (observed: 59 GB RSS, 14k mmap/munmap/sec). Content dropped
// from this slice has already been printed to terminal scrollback — users
// can still scroll up natively. VirtualMessageList (the default ant path)
// bypasses this cap entirely. Headless one-shot renders (e.g. /export)
// pass disableRenderCap to opt out — they have no scrollback and the
// memory concern doesn't apply to renderToString.
//
// The slice boundary is tracked as a UUID anchor, not a count-derived
// index. Count-based slicing (slice(-200)) drops one message from the
// front on every append, shifting scrollback content and forcing a full
// terminal reset per turn (CC-941). Quantizing to 50-message steps
// (CC-1154) helped but still shifted on compaction and collapse regrouping
// since those change collapsed.length without adding messages. The UUID
// anchor only advances when rendered count genuinely exceeds CAP+STEP —
// immune to length churn from grouping/compaction (CC-1174).
//
// The anchor stores BOTH uuid and index. Some uuids are unstable between
// renders: collapseHookSummaries derives the merged uuid from the first
// summary in a group, but reorderMessagesInUI reshuffles hook adjacency
// as tool results stream in, changing which summary is first. When the
// uuid vanishes, falling back to the stored index (clamped) keeps the
// slice roughly where it was instead of resetting to 0 — which would
// jump from ~200 rendered messages to the full history, orphaning
// in-progress badge snapshots in scrollback.
const MAX_MESSAGES_WITHOUT_VIRTUALIZATION = 200;
const MESSAGE_CAP_STEP = 50;
export type SliceAnchor = {
  uuid: string;
  idx: number;
} | null;

/** Exported for testing. Mutates anchorRef when the window needs to advance. */
export function computeSliceStart(collapsed: ReadonlyArray<{
  uuid: string;
}>, anchorRef: {
  current: SliceAnchor;
}, cap = MAX_MESSAGES_WITHOUT_VIRTUALIZATION, step = MESSAGE_CAP_STEP): number {
  const anchor = anchorRef.current;
  const anchorIdx = anchor ? collapsed.findIndex(m => m.uuid === anchor.uuid) : -1;
  // Anchor found → use it. Anchor lost → fall back to stored index
  // (clamped) so collapse-regrouping uuid churn doesn't reset to 0.
  let start = anchorIdx >= 0 ? anchorIdx : anchor ? Math.min(anchor.idx, Math.max(0, collapsed.length - cap)) : 0;
  if (collapsed.length - start > cap + step) {
    start = collapsed.length - cap;
  }
  // Refresh anchor from whatever lives at the current start — heals a
  // stale uuid after fallback and captures a new one after advancement.
  const msgAtStart = collapsed[start];
  if (msgAtStart && (anchor?.uuid !== msgAtStart.uuid || anchor.idx !== start)) {
    anchorRef.current = {
      uuid: msgAtStart.uuid,
      idx: start
    };
  } else if (!msgAtStart && anchor) {
    anchorRef.current = null;
  }
  return start;
}
const MessagesImpl = ({
  messages,
  tools,
  commands,
  verbose,
  toolJSX,
  toolUseConfirmQueue,
  inProgressToolUseIDs,
  isMessageSelectorVisible,
  conversationId,
  screen,
  streamingToolUses,
  showAllInTranscript = false,
  agentDefinitions,
  onOpenRateLimitOptions,
  hideLogo = false,
  isLoading,
  hidePastThinking = false,
  streamingThinking,
  streamingText,
  isBriefOnly = false,
  unseenDivider,
  scrollRef,
  trackStickyPrompt,
  jumpRef,
  onSearchMatchesChange,
  scanElement,
  setPositions,
  disableRenderCap = false,
  cursor = null,
  setCursor,
  cursorNavRef,
  renderRange
}: Props): React.ReactNode => {
  const {
    columns
  } = useTerminalSize();
  const toggleShowAllShortcut = useShortcutDisplay('transcript:toggleShowAll', 'Transcript', 'Ctrl+E');
  const normalizedMessages = useMemo(() => normalizeMessages(messages).filter(isNotEmptyMessage), [messages]);

  // Check if streaming thinking should be visible (streaming or within 30s timeout)
  const isStreamingThinkingVisible = useMemo(() => {
    if (!streamingThinking) return false;
    if (streamingThinking.isStreaming) return true;
    if (streamingThinking.streamingEndedAt) {
      return Date.now() - streamingThinking.streamingEndedAt < 30000;
    }
    return false;
  }, [streamingThinking]);

  // Find the last thinking block (message UUID + content index) for hiding past thinking in transcript mode
  // When streaming thinking is visible, use a special ID that won't match any completed thinking block
  // With adaptive thinking, only consider thinking blocks from the current turn and stop searching once we
  // hit the last user message.
  const lastThinkingBlockId = useMemo(() => {
    if (!hidePastThinking) return null;
    // If streaming thinking is visible, hide all completed thinking blocks by using a non-matching ID
    if (isStreamingThinkingVisible) return 'streaming';
    // Iterate backwards to find the last message with a thinking block
    for (let i = normalizedMessages.length - 1; i >= 0; i--) {
      const msg = normalizedMessages[i];
      if (msg?.type === 'assistant') {
        const content = msg.message.content;
        // Find the last thinking block in this message
        for (let j = content.length - 1; j >= 0; j--) {
          if (content[j]?.type === 'thinking') {
            return `${msg.uuid}:${j}`;
          }
        }
      } else if (msg?.type === 'user') {
        const hasToolResult = msg.message.content.some(block => block.type === 'tool_result');
        if (!hasToolResult) {
          // Reached a previous user turn so don't show stale thinking from before
          return 'no-thinking';
        }
      }
    }
    return null;
  }, [normalizedMessages, hidePastThinking, isStreamingThinkingVisible]);

  // Find the latest user bash output message (from ! commands)
  // This allows us to show full output for the most recent bash command
  const latestBashOutputUUID = useMemo(() => {
    // Iterate backwards to find the last user message with bash output
    for (let i_0 = normalizedMessages.length - 1; i_0 >= 0; i_0--) {
      const msg_0 = normalizedMessages[i_0];
      if (msg_0?.type === 'user') {
        const content_0 = msg_0.message.content;
        // Check if any text content is bash output
        for (const block_0 of content_0) {
          if (block_0.type === 'text') {
            const text = block_0.text;
            if (text.startsWith('<bash-stdout') || text.startsWith('<bash-stderr')) {
              return msg_0.uuid;
            }
          }
        }
      }
    }
    return null;
  }, [normalizedMessages]);

  // streamingToolUses updates on every input_json_delta while normalizedMessages
  // stays stable — precompute the Set so the filter is O(k) not O(n×k) per chunk.
  const normalizedToolUseIDs = useMemo(() => getToolUseIDs(normalizedMessages), [normalizedMessages]);
  const streamingToolUsesWithoutInProgress = useMemo(() => streamingToolUses.filter(stu => !inProgressToolUseIDs.has(stu.contentBlock.id) && !normalizedToolUseIDs.has(stu.contentBlock.id)), [streamingToolUses, inProgressToolUseIDs, normalizedToolUseIDs]);
  const syntheticStreamingToolUseMessages = useMemo(() => streamingToolUsesWithoutInProgress.flatMap(streamingToolUse => {
    const msg_1 = createAssistantMessage({
      content: [streamingToolUse.contentBlock]
    });
    // Override randomUUID with deterministic value derived from content
    // block ID to prevent React key changes on every memo recomputation.
    // Same class of bug fixed in normalizeMessages (commit 383326e613):
    // fresh randomUUID → unstable React keys → component remounts →
    // Ink rendering corruption (overlapping text from stale DOM nodes).
    msg_1.uuid = deriveUUID(streamingToolUse.contentBlock.id as UUID, 0);
    return normalizeMessages([msg_1]);
  }), [streamingToolUsesWithoutInProgress]);
  const isTranscriptMode = screen === 'transcript';
  // Hoisted to mount-time — this component re-renders on every scroll.
  const disableVirtualScroll = useMemo(() => isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL), []);
  // Virtual scroll replaces the transcript cap: everything is scrollable and
  // memory is bounded by the mounted-item count, not the total. scrollRef is
  // only passed when isFullscreenEnvEnabled() is true (REPL.tsx gates it),
  // so scrollRef's presence is the signal.
  const virtualScrollRuntimeGate = scrollRef != null && !disableVirtualScroll;
  const shouldTruncate = isTranscriptMode && !showAllInTranscript && !virtualScrollRuntimeGate;

  // Anchor for the first rendered message in the non-virtualized cap slice.
  // Monotonic advance only — mutation during render is idempotent (safe
  // under StrictMode double-render). See MAX_MESSAGES_WITHOUT_VIRTUALIZATION
  // comment above for why this replaced count-based slicing.
  const sliceAnchorRef = useRef<SliceAnchor>(null);

  // Expensive message transforms — filter, reorder, group, collapse, lookups.
  // All O(n) over 27k messages. Split from the renderRange slice so scrolling
  // (which only changes renderRange) doesn't re-run these. Previously this
  // useMemo included renderRange → every scroll rebuilt 6 Maps over 27k
  // messages + 4 filter/map passes = ~50ms alloc per scroll → GC pressure →
  // 100-173ms stop-the-world pauses on the 1GB heap.
  const {
    collapsed: collapsed_0,
    lookups: lookups_0,
    hasTruncatedMessages: hasTruncatedMessages_0,
    hiddenMessageCount: hiddenMessageCount_0
  } = useMemo(() => {
    // In fullscreen mode the alt buffer has no native scrollback, so the
    // compact-boundary filter just hides history the ScrollBox could
    // otherwise scroll to. Main-screen mode keeps the filter — pre-compact
    // rows live above the viewport in native scrollback there, and
    // re-rendering them triggers full resets.
    // includeSnipped: UI rendering keeps snipped messages for scrollback
    // (this PR's core goal — full history in UI, filter only for the model).
    // Also avoids a UUID mismatch: normalizeMessages derives new UUIDs, so
    // projectSnippedView's check against original removedUuids would fail.
    const compactAwareMessages = verbose || isFullscreenEnvEnabled() ? normalizedMessages : getMessagesAfterCompactBoundary(normalizedMessages, {
      includeSnipped: true
    });
    const messagesToShowNotTruncated = reorderMessagesInUI(compactAwareMessages.filter((msg_2): msg_2 is Exclude<NormalizedMessage, ProgressMessageType> => msg_2.type !== 'progress')
    // CC-724: drop attachment messages that AttachmentMessage renders as
    // null (hook_success, hook_additional_context, hook_cancelled, etc.)
    // BEFORE counting/slicing so they don't inflate the "N messages"
    // count in ctrl-o or consume slots in the 200-message render cap.
    .filter(msg_3 => !isNullRenderingAttachment(msg_3)).filter(_ => shouldShowUserMessage(_, isTranscriptMode)), syntheticStreamingToolUseMessages);
    // Three-tier filtering. Transcript mode (ctrl+o screen) is truly unfiltered.
    // Brief-only: SendUserMessage + user input only. Default: drop redundant
    // assistant text in turns where SendUserMessage was called (the model's
    // text is working-notes that duplicate the SendUserMessage content).
    const briefToolNames = [BRIEF_TOOL_NAME, SEND_USER_FILE_TOOL_NAME].filter((n): n is string => n !== null);
    // dropTextInBriefTurns should only trigger on SendUserMessage turns —
    // SendUserFile delivers a file without replacement text, so dropping
    // assistant text for file-only turns would leave the user with no context.
    const dropTextToolNames = [BRIEF_TOOL_NAME].filter((n_0): n_0 is string => n_0 !== null);
    const briefFiltered = briefToolNames.length > 0 && !isTranscriptMode ? isBriefOnly ? filterForBriefTool(messagesToShowNotTruncated, briefToolNames) : dropTextToolNames.length > 0 ? dropTextInBriefTurns(messagesToShowNotTruncated, dropTextToolNames) : messagesToShowNotTruncated : messagesToShowNotTruncated;
    const messagesToShow = shouldTruncate ? briefFiltered.slice(-MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE) : briefFiltered;
    const hasTruncatedMessages = shouldTruncate && briefFiltered.length > MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE;
    const {
      messages: groupedMessages
    } = applyGrouping(messagesToShow, tools, verbose);
    const collapsed = collapseBackgroundBashNotifications(collapseHookSummaries(collapseTeammateShutdowns(collapseReadSearchGroups(groupedMessages, tools))), verbose);
    const lookups = buildMessageLookups(normalizedMessages, messagesToShow);
    const hiddenMessageCount = messagesToShowNotTruncated.length - MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE;
    return {
      collapsed,
      lookups,
      hasTruncatedMessages,
      hiddenMessageCount
    };
  }, [verbose, normalizedMessages, isTranscriptMode, syntheticStreamingToolUseMessages, shouldTruncate, tools, isBriefOnly]);

  // Cheap slice — only runs when scroll range or slice config changes.
  const renderableMessages = useMemo(() => {
    // Safety cap for the non-virtualized render path. Applied here (not at
    // the JSX site) so renderMessageRow's index-based lookups and
    // dividerBeforeIndex compute on the same array. VirtualMessageList
    // never sees this slice — virtualScrollRuntimeGate is constant for the
    // component's lifetime (scrollRef is either always passed or never).
    // renderRange is first: the chunked export path slices the
    // post-grouping array so each chunk gets correct tool-call grouping.
    const capApplies = !virtualScrollRuntimeGate && !disableRenderCap;
    const sliceStart = capApplies ? computeSliceStart(collapsed_0, sliceAnchorRef) : 0;
    return renderRange ? collapsed_0.slice(renderRange[0], renderRange[1]) : sliceStart > 0 ? collapsed_0.slice(sliceStart) : collapsed_0;
  }, [collapsed_0, renderRange, virtualScrollRuntimeGate, disableRenderCap]);
  const streamingToolUseIDs = useMemo(() => new Set(streamingToolUses.map(__0 => __0.contentBlock.id)), [streamingToolUses]);

  // Divider insertion point: first renderableMessage whose uuid shares the
  // 24-char prefix with firstUnseenUuid (deriveUUID keeps the first 24
  // chars of the source message uuid, so this matches any block from it).
  const dividerBeforeIndex = useMemo(() => {
    if (!unseenDivider) return -1;
    const prefix = unseenDivider.firstUnseenUuid.slice(0, 24);
    return renderableMessages.findIndex(m => m.uuid.slice(0, 24) === prefix);
  }, [unseenDivider, renderableMessages]);
  const selectedIdx = useMemo(() => {
    if (!cursor) return -1;
    return renderableMessages.findIndex(m_0 => m_0.uuid === cursor.uuid);
  }, [cursor, renderableMessages]);

  // Fullscreen: click a message to toggle verbose rendering for it. Keyed by
  // tool_use_id where available so a tool_use and its tool_result (separate
  // rows) expand together; falls back to uuid for groups/thinking. Stale keys
  // are harmless — they never match anything in renderableMessages.
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const onItemClick = useCallback((msg_4: RenderableMessage) => {
    const k = expandKey(msg_4);
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);else next.add(k);
      return next;
    });
  }, []);
  const isItemExpanded = useCallback((msg_5: RenderableMessage) => expandedKeys.size > 0 && expandedKeys.has(expandKey(msg_5)), [expandedKeys]);
  // Only hover/click messages where the verbose toggle reveals more:
  // collapsed read/search groups, or tool results that self-report truncation
  // via isResultTruncated. Callback must be stable across message updates: if
  // its identity (or return value) flips during streaming, onMouseEnter
  // attaches after the mouse is already inside → hover never fires. tools is
  // session-stable; lookups is read via ref so the callback doesn't churn on
  // every new message.
  const lookupsRef = useRef(lookups_0);
  lookupsRef.current = lookups_0;
  const isItemClickable = useCallback((msg_6: RenderableMessage): boolean => {
    if (msg_6.type === 'collapsed_read_search') return true;
    if (msg_6.type === 'assistant') {
      const b = msg_6.message.content[0] as unknown as AdvisorBlock | undefined;
      return b != null && isAdvisorBlock(b) && b.type === 'advisor_tool_result' && b.content.type === 'advisor_result';
    }
    if (msg_6.type !== 'user') return false;
    const b_0 = msg_6.message.content[0];
    if (b_0?.type !== 'tool_result' || b_0.is_error || !msg_6.toolUseResult) return false;
    const name = lookupsRef.current.toolUseByToolUseID.get(b_0.tool_use_id)?.name;
    const tool = name ? findToolByName(tools, name) : undefined;
    return tool?.isResultTruncated?.(msg_6.toolUseResult as never) ?? false;
  }, [tools]);
  const canAnimate = (!toolJSX || !!toolJSX.shouldContinueAnimation) && !toolUseConfirmQueue.length && !isMessageSelectorVisible;
  const hasToolsInProgress = inProgressToolUseIDs.size > 0;

  // Report progress to terminal (for terminals that support OSC 9;4)
  const {
    progress
  } = useTerminalNotification();
  const prevProgressState = useRef<string | null>(null);
  const progressEnabled = getGlobalConfig().terminalProgressBarEnabled && !getIsRemoteMode() && !(proactiveModule?.isProactiveActive() ?? false);
  useEffect(() => {
    const state = progressEnabled ? hasToolsInProgress ? 'indeterminate' : 'completed' : null;
    if (prevProgressState.current === state) return;
    prevProgressState.current = state;
    progress(state);
  }, [progress, progressEnabled, hasToolsInProgress]);
  useEffect(() => {
    return () => progress(null);
  }, [progress]);
  const messageKey = useCallback((msg_7: RenderableMessage) => `${msg_7.uuid}-${conversationId}`, [conversationId]);
  const renderMessageRow = (msg_8: RenderableMessage, index: number) => {
    const prevType = index > 0 ? renderableMessages[index - 1]?.type : undefined;
    const isUserContinuation = msg_8.type === 'user' && prevType === 'user';
    // hasContentAfter is only consumed for collapsed_read_search groups;
    // skip the scan for everything else. streamingText is rendered as a
    // sibling after this map, so it's never in renderableMessages — OR it
    // in explicitly so the group flips to past tense as soon as text starts
    // streaming instead of waiting for the block to finalize.
    const hasContentAfter = msg_8.type === 'collapsed_read_search' && (!!streamingText || hasContentAfterIndex(renderableMessages, index, tools, streamingToolUseIDs));
    const k_0 = messageKey(msg_8);
    const row = <MessageRow key={k_0} message={msg_8} isUserContinuation={isUserContinuation} hasContentAfter={hasContentAfter} tools={tools} commands={commands} verbose={verbose || isItemExpanded(msg_8) || cursor?.expanded === true && index === selectedIdx} inProgressToolUseIDs={inProgressToolUseIDs} streamingToolUseIDs={streamingToolUseIDs} screen={screen} canAnimate={canAnimate} onOpenRateLimitOptions={onOpenRateLimitOptions} lastThinkingBlockId={lastThinkingBlockId} latestBashOutputUUID={latestBashOutputUUID} columns={columns} isLoading={isLoading} lookups={lookups_0} />;

    // Per-row Provider — only 2 rows re-render on selection change.
    // Wrapped BEFORE divider branch so both return paths get it.
    const wrapped = <MessageActionsSelectedContext.Provider key={k_0} value={index === selectedIdx}>
        {row}
      </MessageActionsSelectedContext.Provider>;
    if (unseenDivider && index === dividerBeforeIndex) {
      return [<Box key="unseen-divider" marginTop={1}>
          <Divider title={`${unseenDivider.count} new ${plural(unseenDivider.count, 'message')}`} width={columns} color="inactive" />
        </Box>, wrapped];
    }
    return wrapped;
  };

  // Search indexing: for tool_result messages, look up the Tool and use
  // its extractSearchText — tool-owned, precise, matches what
  // renderToolResultMessage shows. Falls back to renderableSearchText
  // (duck-types toolUseResult) for tools that haven't implemented it,
  // and for all non-tool-result message types. The drift-catcher test
  // (toolSearchText.test.tsx) renders + compares to keep these in sync.
  //
  // A second-React-root reconcile approach was tried and ruled out
  // (measured 3.1ms/msg, growing — flushSyncWork processes all roots;
  // component hooks mutate shared state → main root accumulates updates).
  const searchTextCache = useRef(new WeakMap<RenderableMessage, string>());
  const extractSearchText = useCallback((msg_9: RenderableMessage): string => {
    const cached = searchTextCache.current.get(msg_9);
    if (cached !== undefined) return cached;
    let text_0 = renderableSearchText(msg_9);
    // If this is a tool_result message and the tool implements
    // extractSearchText, prefer that — it's precise (tool-owned)
    // vs renderableSearchText's field-name heuristic.
    if (msg_9.type === 'user' && msg_9.toolUseResult && Array.isArray(msg_9.message.content)) {
      const tr = msg_9.message.content.find(b_1 => b_1.type === 'tool_result');
      if (tr && 'tool_use_id' in tr) {
        const tu = lookups_0.toolUseByToolUseID.get(tr.tool_use_id);
        const tool_0 = tu && findToolByName(tools, tu.name);
        const extracted = tool_0?.extractSearchText?.(msg_9.toolUseResult as never);
        // undefined = tool didn't implement → keep heuristic. Empty
        // string = tool says "nothing to index" → respect that.
        if (extracted !== undefined) text_0 = extracted;
      }
    }
    // Cache LOWERED: setSearchQuery's hot loop indexOfs per keystroke.
    // Lowering here (once, at warm) vs there (every keystroke) trades
    // ~same steady-state memory for zero per-keystroke alloc. Cache
    // GC's with messages on transcript exit. Tool methods return raw;
    // renderableSearchText already lowercases (redundant but cheap).
    const lowered = text_0.toLowerCase();
    searchTextCache.current.set(msg_9, lowered);
    return lowered;
  }, [tools, lookups_0]);
  return <>
      {/* Logo */}
      {!hideLogo && !(renderRange && renderRange[0] > 0) && <LogoHeader agentDefinitions={agentDefinitions} />}

      {/* Truncation indicator */}
      {hasTruncatedMessages_0 && <Divider title={`${toggleShowAllShortcut} to show ${chalk.bold(hiddenMessageCount_0)} previous messages`} width={columns} />}

      {/* Show all indicator */}
      {isTranscriptMode && showAllInTranscript && hiddenMessageCount_0 > 0 &&
    // disableRenderCap (e.g. [ dump-to-scrollback) means we're uncapped
    // as a one-shot escape hatch, not a toggle — ctrl+e is dead and
    // nothing is actually "hidden" to restore.
    !disableRenderCap && <Divider title={`${toggleShowAllShortcut} to hide ${chalk.bold(hiddenMessageCount_0)} previous messages`} width={columns} />}

      {/* Messages - rendered as memoized MessageRow components.
          flatMap inserts the unseen-divider as a separate keyed sibling so
          (a) non-fullscreen renders pay no per-message Fragment wrap, and
          (b) divider toggle in fullscreen preserves all MessageRows by key.
          Pre-compute derived values instead of passing renderableMessages to
          each row - React Compiler pins props in the fiber's memoCache, so
          passing the array would accumulate every historical version
          (~1-2MB over a 7-turn session). */}
      {virtualScrollRuntimeGate ? <InVirtualListContext.Provider value={true}>
          <VirtualMessageList messages={renderableMessages} scrollRef={scrollRef} columns={columns} itemKey={messageKey} renderItem={renderMessageRow} onItemClick={onItemClick} isItemClickable={isItemClickable} isItemExpanded={isItemExpanded} trackStickyPrompt={trackStickyPrompt} selectedIndex={selectedIdx >= 0 ? selectedIdx : undefined} cursorNavRef={cursorNavRef} setCursor={setCursor} jumpRef={jumpRef} onSearchMatchesChange={onSearchMatchesChange} scanElement={scanElement} setPositions={setPositions} extractSearchText={extractSearchText} />
        </InVirtualListContext.Provider> : renderableMessages.flatMap(renderMessageRow)}

      {streamingText && !isBriefOnly && <Box alignItems="flex-start" flexDirection="row" marginTop={1} width="100%">
          <Box flexDirection="row">
            <Box minWidth={2}>
              <Text color="text">{BLACK_CIRCLE}</Text>
            </Box>
            <Box flexDirection="column">
              <StreamingMarkdown>{streamingText}</StreamingMarkdown>
            </Box>
          </Box>
        </Box>}

      {isStreamingThinkingVisible && streamingThinking && !isBriefOnly && <Box marginTop={1}>
          <AssistantThinkingMessage param={{
        type: 'thinking',
        thinking: streamingThinking.thinking
      }} addMargin={false} isTranscriptMode={true} verbose={verbose} hideInTranscript={false} />
        </Box>}
    </>;
};

/** Key for click-to-expand: tool_use_id where available (so tool_use + its
 *  tool_result expand together), else uuid for groups/thinking. */
function expandKey(msg: RenderableMessage): string {
  return (msg.type === 'assistant' || msg.type === 'user' ? getToolUseID(msg) : null) ?? msg.uuid;
}

// Custom comparator to prevent unnecessary re-renders during streaming.
// Default React.memo does shallow comparison which fails when:
// 1. onOpenRateLimitOptions callback is recreated (doesn't affect render output)
// 2. streamingToolUses array is recreated on every delta, but only contentBlock matters for rendering
// 3. streamingThinking changes on every delta - we DO want to re-render for this
function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}
export const Messages = React.memo(MessagesImpl, (prev, next) => {
  const keys = Object.keys(prev) as (keyof typeof prev)[];
  for (const key of keys) {
    if (key === 'onOpenRateLimitOptions' || key === 'scrollRef' || key === 'trackStickyPrompt' || key === 'setCursor' || key === 'cursorNavRef' || key === 'jumpRef' || key === 'onSearchMatchesChange' || key === 'scanElement' || key === 'setPositions') continue;
    if (prev[key] !== next[key]) {
      if (key === 'streamingToolUses') {
        const p = prev.streamingToolUses;
        const n = next.streamingToolUses;
        if (p.length === n.length && p.every((item, i) => item.contentBlock === n[i]?.contentBlock)) {
          continue;
        }
      }
      if (key === 'inProgressToolUseIDs') {
        if (setsEqual(prev.inProgressToolUseIDs, next.inProgressToolUseIDs)) {
          continue;
        }
      }
      if (key === 'unseenDivider') {
        const p = prev.unseenDivider;
        const n = next.unseenDivider;
        if (p?.firstUnseenUuid === n?.firstUnseenUuid && p?.count === n?.count) {
          continue;
        }
      }
      if (key === 'tools') {
        const p = prev.tools;
        const n = next.tools;
        if (p.length === n.length && p.every((tool, i) => tool.name === n[i]?.name)) {
          continue;
        }
      }
      // streamingThinking changes frequently - always re-render when it changes
      // (no special handling needed, default behavior is correct)
      return false;
    }
  }
  return true;
});
export function shouldRenderStatically(message: RenderableMessage, streamingToolUseIDs: Set<string>, inProgressToolUseIDs: Set<string>, siblingToolUseIDs: ReadonlySet<string>, screen: Screen, lookups: ReturnType<typeof buildMessageLookups>): boolean {
  if (screen === 'transcript') {
    return true;
  }
  switch (message.type) {
    case 'attachment':
    case 'user':
    case 'assistant':
      {
        if (message.type === 'assistant') {
          const block = message.message.content[0];
          if (block?.type === 'server_tool_use') {
            return lookups.resolvedToolUseIDs.has(block.id);
          }
        }
        const toolUseID = getToolUseID(message);
        if (!toolUseID) {
          return true;
        }
        if (streamingToolUseIDs.has(toolUseID)) {
          return false;
        }
        if (inProgressToolUseIDs.has(toolUseID)) {
          return false;
        }

        // Check if there are any unresolved PostToolUse hooks for this tool use
        // If so, keep the message transient so the HookProgressMessage can update
        if (hasUnresolvedHooksFromLookup(toolUseID, 'PostToolUse', lookups)) {
          return false;
        }
        return every(siblingToolUseIDs, lookups.resolvedToolUseIDs);
      }
    case 'system':
      {
        // api errors always render dynamically, since we hide
        // them as soon as we see another non-error message.
        return message.subtype !== 'api_error';
      }
    case 'grouped_tool_use':
      {
        const allResolved = message.messages.every(msg => {
          const content = msg.message.content[0];
          return content?.type === 'tool_use' && lookups.resolvedToolUseIDs.has(content.id);
        });
        return allResolved;
      }
    case 'collapsed_read_search':
      {
        // In prompt mode, never mark as static to prevent flicker between API turns
        // (In transcript mode, we already returned true at the top of this function)
        return false;
      }
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiY2hhbGsiLCJVVUlEIiwiUmVmT2JqZWN0IiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZU1lbW8iLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsImV2ZXJ5IiwiZ2V0SXNSZW1vdGVNb2RlIiwiQ29tbWFuZCIsIkJMQUNLX0NJUkNMRSIsInVzZVRlcm1pbmFsU2l6ZSIsIlNjcm9sbEJveEhhbmRsZSIsInVzZVRlcm1pbmFsTm90aWZpY2F0aW9uIiwiQm94IiwiVGV4dCIsInVzZVNob3J0Y3V0RGlzcGxheSIsIlNjcmVlbiIsIlRvb2xzIiwiZmluZFRvb2xCeU5hbWUiLCJBZ2VudERlZmluaXRpb25zUmVzdWx0IiwiTWVzc2FnZSIsIk1lc3NhZ2VUeXBlIiwiTm9ybWFsaXplZE1lc3NhZ2UiLCJQcm9ncmVzc01lc3NhZ2UiLCJQcm9ncmVzc01lc3NhZ2VUeXBlIiwiUmVuZGVyYWJsZU1lc3NhZ2UiLCJBZHZpc29yQmxvY2siLCJpc0Fkdmlzb3JCbG9jayIsImNvbGxhcHNlQmFja2dyb3VuZEJhc2hOb3RpZmljYXRpb25zIiwiY29sbGFwc2VIb29rU3VtbWFyaWVzIiwiY29sbGFwc2VSZWFkU2VhcmNoR3JvdXBzIiwiY29sbGFwc2VUZWFtbWF0ZVNodXRkb3ducyIsImdldEdsb2JhbENvbmZpZyIsImlzRW52VHJ1dGh5IiwiaXNGdWxsc2NyZWVuRW52RW5hYmxlZCIsImFwcGx5R3JvdXBpbmciLCJidWlsZE1lc3NhZ2VMb29rdXBzIiwiY3JlYXRlQXNzaXN0YW50TWVzc2FnZSIsImRlcml2ZVVVSUQiLCJnZXRNZXNzYWdlc0FmdGVyQ29tcGFjdEJvdW5kYXJ5IiwiZ2V0VG9vbFVzZUlEIiwiZ2V0VG9vbFVzZUlEcyIsImhhc1VucmVzb2x2ZWRIb29rc0Zyb21Mb29rdXAiLCJpc05vdEVtcHR5TWVzc2FnZSIsIm5vcm1hbGl6ZU1lc3NhZ2VzIiwicmVvcmRlck1lc3NhZ2VzSW5VSSIsIlN0cmVhbWluZ1RoaW5raW5nIiwiU3RyZWFtaW5nVG9vbFVzZSIsInNob3VsZFNob3dVc2VyTWVzc2FnZSIsInBsdXJhbCIsInJlbmRlcmFibGVTZWFyY2hUZXh0IiwiRGl2aWRlciIsIlVuc2VlbkRpdmlkZXIiLCJMb2dvVjIiLCJTdHJlYW1pbmdNYXJrZG93biIsImhhc0NvbnRlbnRBZnRlckluZGV4IiwiTWVzc2FnZVJvdyIsIkluVmlydHVhbExpc3RDb250ZXh0IiwiTWVzc2FnZUFjdGlvbnNOYXYiLCJNZXNzYWdlQWN0aW9uc1NlbGVjdGVkQ29udGV4dCIsIk1lc3NhZ2VBY3Rpb25zU3RhdGUiLCJBc3Npc3RhbnRUaGlua2luZ01lc3NhZ2UiLCJpc051bGxSZW5kZXJpbmdBdHRhY2htZW50IiwiT2Zmc2NyZWVuRnJlZXplIiwiVG9vbFVzZUNvbmZpcm0iLCJTdGF0dXNOb3RpY2VzIiwiSnVtcEhhbmRsZSIsIkxvZ29IZWFkZXIiLCJtZW1vIiwidDAiLCIkIiwiX2MiLCJhZ2VudERlZmluaXRpb25zIiwidDEiLCJTeW1ib2wiLCJmb3IiLCJ0MiIsInByb2FjdGl2ZU1vZHVsZSIsInJlcXVpcmUiLCJCUklFRl9UT09MX05BTUUiLCJTRU5EX1VTRVJfRklMRV9UT09MX05BTUUiLCJWaXJ0dWFsTWVzc2FnZUxpc3QiLCJmaWx0ZXJGb3JCcmllZlRvb2wiLCJ0eXBlIiwic3VidHlwZSIsImlzTWV0YSIsImlzQXBpRXJyb3JNZXNzYWdlIiwibWVzc2FnZSIsImNvbnRlbnQiLCJBcnJheSIsIm5hbWUiLCJ0b29sX3VzZV9pZCIsImF0dGFjaG1lbnQiLCJvcmlnaW4iLCJjb21tYW5kTW9kZSIsIm1lc3NhZ2VzIiwiVCIsImJyaWVmVG9vbE5hbWVzIiwibmFtZVNldCIsIlNldCIsImJyaWVmVG9vbFVzZUlEcyIsImZpbHRlciIsIm1zZyIsImJsb2NrIiwiaGFzIiwiYWRkIiwiaWQiLCJ1bmRlZmluZWQiLCJhdHQiLCJkcm9wVGV4dEluQnJpZWZUdXJucyIsInR1cm5zV2l0aEJyaWVmIiwidGV4dEluZGV4VG9UdXJuIiwidHVybiIsImkiLCJsZW5ndGgiLCJzaXplIiwiXyIsInQiLCJQcm9wcyIsInRvb2xzIiwiY29tbWFuZHMiLCJ2ZXJib3NlIiwidG9vbEpTWCIsImpzeCIsIlJlYWN0Tm9kZSIsInNob3VsZEhpZGVQcm9tcHRJbnB1dCIsInNob3VsZENvbnRpbnVlQW5pbWF0aW9uIiwidG9vbFVzZUNvbmZpcm1RdWV1ZSIsImluUHJvZ3Jlc3NUb29sVXNlSURzIiwiaXNNZXNzYWdlU2VsZWN0b3JWaXNpYmxlIiwiY29udmVyc2F0aW9uSWQiLCJzY3JlZW4iLCJzdHJlYW1pbmdUb29sVXNlcyIsInNob3dBbGxJblRyYW5zY3JpcHQiLCJvbk9wZW5SYXRlTGltaXRPcHRpb25zIiwiaGlkZUxvZ28iLCJpc0xvYWRpbmciLCJoaWRlUGFzdFRoaW5raW5nIiwic3RyZWFtaW5nVGhpbmtpbmciLCJzdHJlYW1pbmdUZXh0IiwiaXNCcmllZk9ubHkiLCJ1bnNlZW5EaXZpZGVyIiwic2Nyb2xsUmVmIiwidHJhY2tTdGlja3lQcm9tcHQiLCJqdW1wUmVmIiwib25TZWFyY2hNYXRjaGVzQ2hhbmdlIiwiY291bnQiLCJjdXJyZW50Iiwic2NhbkVsZW1lbnQiLCJlbCIsIkRPTUVsZW1lbnQiLCJNYXRjaFBvc2l0aW9uIiwic2V0UG9zaXRpb25zIiwic3RhdGUiLCJwb3NpdGlvbnMiLCJyb3dPZmZzZXQiLCJjdXJyZW50SWR4IiwiZGlzYWJsZVJlbmRlckNhcCIsImN1cnNvciIsInNldEN1cnNvciIsImN1cnNvck5hdlJlZiIsIlJlZiIsInJlbmRlclJhbmdlIiwic3RhcnQiLCJlbmQiLCJNQVhfTUVTU0FHRVNfVE9fU0hPV19JTl9UUkFOU0NSSVBUX01PREUiLCJNQVhfTUVTU0FHRVNfV0lUSE9VVF9WSVJUVUFMSVpBVElPTiIsIk1FU1NBR0VfQ0FQX1NURVAiLCJTbGljZUFuY2hvciIsInV1aWQiLCJpZHgiLCJjb21wdXRlU2xpY2VTdGFydCIsImNvbGxhcHNlZCIsIlJlYWRvbmx5QXJyYXkiLCJhbmNob3JSZWYiLCJjYXAiLCJzdGVwIiwiYW5jaG9yIiwiYW5jaG9ySWR4IiwiZmluZEluZGV4IiwibSIsIk1hdGgiLCJtaW4iLCJtYXgiLCJtc2dBdFN0YXJ0IiwiTWVzc2FnZXNJbXBsIiwiY29sdW1ucyIsInRvZ2dsZVNob3dBbGxTaG9ydGN1dCIsIm5vcm1hbGl6ZWRNZXNzYWdlcyIsImlzU3RyZWFtaW5nVGhpbmtpbmdWaXNpYmxlIiwiaXNTdHJlYW1pbmciLCJzdHJlYW1pbmdFbmRlZEF0IiwiRGF0ZSIsIm5vdyIsImxhc3RUaGlua2luZ0Jsb2NrSWQiLCJqIiwiaGFzVG9vbFJlc3VsdCIsInNvbWUiLCJsYXRlc3RCYXNoT3V0cHV0VVVJRCIsInRleHQiLCJzdGFydHNXaXRoIiwibm9ybWFsaXplZFRvb2xVc2VJRHMiLCJzdHJlYW1pbmdUb29sVXNlc1dpdGhvdXRJblByb2dyZXNzIiwic3R1IiwiY29udGVudEJsb2NrIiwic3ludGhldGljU3RyZWFtaW5nVG9vbFVzZU1lc3NhZ2VzIiwiZmxhdE1hcCIsInN0cmVhbWluZ1Rvb2xVc2UiLCJpc1RyYW5zY3JpcHRNb2RlIiwiZGlzYWJsZVZpcnR1YWxTY3JvbGwiLCJwcm9jZXNzIiwiZW52IiwiQ0xBVURFX0NPREVfRElTQUJMRV9WSVJUVUFMX1NDUk9MTCIsInZpcnR1YWxTY3JvbGxSdW50aW1lR2F0ZSIsInNob3VsZFRydW5jYXRlIiwic2xpY2VBbmNob3JSZWYiLCJsb29rdXBzIiwiaGFzVHJ1bmNhdGVkTWVzc2FnZXMiLCJoaWRkZW5NZXNzYWdlQ291bnQiLCJjb21wYWN0QXdhcmVNZXNzYWdlcyIsImluY2x1ZGVTbmlwcGVkIiwibWVzc2FnZXNUb1Nob3dOb3RUcnVuY2F0ZWQiLCJFeGNsdWRlIiwibiIsImRyb3BUZXh0VG9vbE5hbWVzIiwiYnJpZWZGaWx0ZXJlZCIsIm1lc3NhZ2VzVG9TaG93Iiwic2xpY2UiLCJncm91cGVkTWVzc2FnZXMiLCJyZW5kZXJhYmxlTWVzc2FnZXMiLCJjYXBBcHBsaWVzIiwic2xpY2VTdGFydCIsInN0cmVhbWluZ1Rvb2xVc2VJRHMiLCJtYXAiLCJkaXZpZGVyQmVmb3JlSW5kZXgiLCJwcmVmaXgiLCJmaXJzdFVuc2VlblV1aWQiLCJzZWxlY3RlZElkeCIsImV4cGFuZGVkS2V5cyIsInNldEV4cGFuZGVkS2V5cyIsIlJlYWRvbmx5U2V0Iiwib25JdGVtQ2xpY2siLCJrIiwiZXhwYW5kS2V5IiwicHJldiIsIm5leHQiLCJkZWxldGUiLCJpc0l0ZW1FeHBhbmRlZCIsImxvb2t1cHNSZWYiLCJpc0l0ZW1DbGlja2FibGUiLCJiIiwiaXNfZXJyb3IiLCJ0b29sVXNlUmVzdWx0IiwidG9vbFVzZUJ5VG9vbFVzZUlEIiwiZ2V0IiwidG9vbCIsImlzUmVzdWx0VHJ1bmNhdGVkIiwiY2FuQW5pbWF0ZSIsImhhc1Rvb2xzSW5Qcm9ncmVzcyIsInByb2dyZXNzIiwicHJldlByb2dyZXNzU3RhdGUiLCJwcm9ncmVzc0VuYWJsZWQiLCJ0ZXJtaW5hbFByb2dyZXNzQmFyRW5hYmxlZCIsImlzUHJvYWN0aXZlQWN0aXZlIiwibWVzc2FnZUtleSIsInJlbmRlck1lc3NhZ2VSb3ciLCJpbmRleCIsInByZXZUeXBlIiwiaXNVc2VyQ29udGludWF0aW9uIiwiaGFzQ29udGVudEFmdGVyIiwicm93IiwiZXhwYW5kZWQiLCJ3cmFwcGVkIiwic2VhcmNoVGV4dENhY2hlIiwiV2Vha01hcCIsImV4dHJhY3RTZWFyY2hUZXh0IiwiY2FjaGVkIiwiaXNBcnJheSIsInRyIiwiZmluZCIsInR1IiwiZXh0cmFjdGVkIiwibG93ZXJlZCIsInRvTG93ZXJDYXNlIiwic2V0IiwiYm9sZCIsInRoaW5raW5nIiwic2V0c0VxdWFsIiwiYSIsIml0ZW0iLCJNZXNzYWdlcyIsImtleXMiLCJPYmplY3QiLCJrZXkiLCJwIiwic2hvdWxkUmVuZGVyU3RhdGljYWxseSIsInNpYmxpbmdUb29sVXNlSURzIiwiUmV0dXJuVHlwZSIsInJlc29sdmVkVG9vbFVzZUlEcyIsInRvb2xVc2VJRCIsImFsbFJlc29sdmVkIl0sInNvdXJjZXMiOlsiTWVzc2FnZXMudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJ1xuaW1wb3J0IHR5cGUgeyBVVUlEIH0gZnJvbSAnY3J5cHRvJ1xuaW1wb3J0IHR5cGUgeyBSZWZPYmplY3QgfSBmcm9tICdyZWFjdCdcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgZXZlcnkgfSBmcm9tICdzcmMvdXRpbHMvc2V0LmpzJ1xuaW1wb3J0IHsgZ2V0SXNSZW1vdGVNb2RlIH0gZnJvbSAnLi4vYm9vdHN0cmFwL3N0YXRlLmpzJ1xuaW1wb3J0IHR5cGUgeyBDb21tYW5kIH0gZnJvbSAnLi4vY29tbWFuZHMuanMnXG5pbXBvcnQgeyBCTEFDS19DSVJDTEUgfSBmcm9tICcuLi9jb25zdGFudHMvZmlndXJlcy5qcydcbmltcG9ydCB7IHVzZVRlcm1pbmFsU2l6ZSB9IGZyb20gJy4uL2hvb2tzL3VzZVRlcm1pbmFsU2l6ZS5qcydcbmltcG9ydCB0eXBlIHsgU2Nyb2xsQm94SGFuZGxlIH0gZnJvbSAnLi4vaW5rL2NvbXBvbmVudHMvU2Nyb2xsQm94LmpzJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxOb3RpZmljYXRpb24gfSBmcm9tICcuLi9pbmsvdXNlVGVybWluYWxOb3RpZmljYXRpb24uanMnXG5pbXBvcnQgeyBCb3gsIFRleHQgfSBmcm9tICcuLi9pbmsuanMnXG5pbXBvcnQgeyB1c2VTaG9ydGN1dERpc3BsYXkgfSBmcm9tICcuLi9rZXliaW5kaW5ncy91c2VTaG9ydGN1dERpc3BsYXkuanMnXG5pbXBvcnQgdHlwZSB7IFNjcmVlbiB9IGZyb20gJy4uL3NjcmVlbnMvUkVQTC5qcydcbmltcG9ydCB0eXBlIHsgVG9vbHMgfSBmcm9tICcuLi9Ub29sLmpzJ1xuaW1wb3J0IHsgZmluZFRvb2xCeU5hbWUgfSBmcm9tICcuLi9Ub29sLmpzJ1xuaW1wb3J0IHR5cGUgeyBBZ2VudERlZmluaXRpb25zUmVzdWx0IH0gZnJvbSAnLi4vdG9vbHMvQWdlbnRUb29sL2xvYWRBZ2VudHNEaXIuanMnXG5pbXBvcnQgdHlwZSB7XG4gIE1lc3NhZ2UgYXMgTWVzc2FnZVR5cGUsXG4gIE5vcm1hbGl6ZWRNZXNzYWdlLFxuICBQcm9ncmVzc01lc3NhZ2UgYXMgUHJvZ3Jlc3NNZXNzYWdlVHlwZSxcbiAgUmVuZGVyYWJsZU1lc3NhZ2UsXG59IGZyb20gJy4uL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQgeyB0eXBlIEFkdmlzb3JCbG9jaywgaXNBZHZpc29yQmxvY2sgfSBmcm9tICcuLi91dGlscy9hZHZpc29yLmpzJ1xuaW1wb3J0IHsgY29sbGFwc2VCYWNrZ3JvdW5kQmFzaE5vdGlmaWNhdGlvbnMgfSBmcm9tICcuLi91dGlscy9jb2xsYXBzZUJhY2tncm91bmRCYXNoTm90aWZpY2F0aW9ucy5qcydcbmltcG9ydCB7IGNvbGxhcHNlSG9va1N1bW1hcmllcyB9IGZyb20gJy4uL3V0aWxzL2NvbGxhcHNlSG9va1N1bW1hcmllcy5qcydcbmltcG9ydCB7IGNvbGxhcHNlUmVhZFNlYXJjaEdyb3VwcyB9IGZyb20gJy4uL3V0aWxzL2NvbGxhcHNlUmVhZFNlYXJjaC5qcydcbmltcG9ydCB7IGNvbGxhcHNlVGVhbW1hdGVTaHV0ZG93bnMgfSBmcm9tICcuLi91dGlscy9jb2xsYXBzZVRlYW1tYXRlU2h1dGRvd25zLmpzJ1xuaW1wb3J0IHsgZ2V0R2xvYmFsQ29uZmlnIH0gZnJvbSAnLi4vdXRpbHMvY29uZmlnLmpzJ1xuaW1wb3J0IHsgaXNFbnZUcnV0aHkgfSBmcm9tICcuLi91dGlscy9lbnZVdGlscy5qcydcbmltcG9ydCB7IGlzRnVsbHNjcmVlbkVudkVuYWJsZWQgfSBmcm9tICcuLi91dGlscy9mdWxsc2NyZWVuLmpzJ1xuaW1wb3J0IHsgYXBwbHlHcm91cGluZyB9IGZyb20gJy4uL3V0aWxzL2dyb3VwVG9vbFVzZXMuanMnXG5pbXBvcnQge1xuICBidWlsZE1lc3NhZ2VMb29rdXBzLFxuICBjcmVhdGVBc3Npc3RhbnRNZXNzYWdlLFxuICBkZXJpdmVVVUlELFxuICBnZXRNZXNzYWdlc0FmdGVyQ29tcGFjdEJvdW5kYXJ5LFxuICBnZXRUb29sVXNlSUQsXG4gIGdldFRvb2xVc2VJRHMsXG4gIGhhc1VucmVzb2x2ZWRIb29rc0Zyb21Mb29rdXAsXG4gIGlzTm90RW1wdHlNZXNzYWdlLFxuICBub3JtYWxpemVNZXNzYWdlcyxcbiAgcmVvcmRlck1lc3NhZ2VzSW5VSSxcbiAgdHlwZSBTdHJlYW1pbmdUaGlua2luZyxcbiAgdHlwZSBTdHJlYW1pbmdUb29sVXNlLFxuICBzaG91bGRTaG93VXNlck1lc3NhZ2UsXG59IGZyb20gJy4uL3V0aWxzL21lc3NhZ2VzLmpzJ1xuaW1wb3J0IHsgcGx1cmFsIH0gZnJvbSAnLi4vdXRpbHMvc3RyaW5nVXRpbHMuanMnXG5pbXBvcnQgeyByZW5kZXJhYmxlU2VhcmNoVGV4dCB9IGZyb20gJy4uL3V0aWxzL3RyYW5zY3JpcHRTZWFyY2guanMnXG5pbXBvcnQgeyBEaXZpZGVyIH0gZnJvbSAnLi9kZXNpZ24tc3lzdGVtL0RpdmlkZXIuanMnXG5pbXBvcnQgdHlwZSB7IFVuc2VlbkRpdmlkZXIgfSBmcm9tICcuL0Z1bGxzY3JlZW5MYXlvdXQuanMnXG5pbXBvcnQgeyBMb2dvVjIgfSBmcm9tICcuL0xvZ29WMi9Mb2dvVjIuanMnXG5pbXBvcnQgeyBTdHJlYW1pbmdNYXJrZG93biB9IGZyb20gJy4vTWFya2Rvd24uanMnXG5pbXBvcnQgeyBoYXNDb250ZW50QWZ0ZXJJbmRleCwgTWVzc2FnZVJvdyB9IGZyb20gJy4vTWVzc2FnZVJvdy5qcydcbmltcG9ydCB7XG4gIEluVmlydHVhbExpc3RDb250ZXh0LFxuICB0eXBlIE1lc3NhZ2VBY3Rpb25zTmF2LFxuICBNZXNzYWdlQWN0aW9uc1NlbGVjdGVkQ29udGV4dCxcbiAgdHlwZSBNZXNzYWdlQWN0aW9uc1N0YXRlLFxufSBmcm9tICcuL21lc3NhZ2VBY3Rpb25zLmpzJ1xuaW1wb3J0IHsgQXNzaXN0YW50VGhpbmtpbmdNZXNzYWdlIH0gZnJvbSAnLi9tZXNzYWdlcy9Bc3Npc3RhbnRUaGlua2luZ01lc3NhZ2UuanMnXG5pbXBvcnQgeyBpc051bGxSZW5kZXJpbmdBdHRhY2htZW50IH0gZnJvbSAnLi9tZXNzYWdlcy9udWxsUmVuZGVyaW5nQXR0YWNobWVudHMuanMnXG5pbXBvcnQgeyBPZmZzY3JlZW5GcmVlemUgfSBmcm9tICcuL09mZnNjcmVlbkZyZWV6ZS5qcydcbmltcG9ydCB0eXBlIHsgVG9vbFVzZUNvbmZpcm0gfSBmcm9tICcuL3Blcm1pc3Npb25zL1Blcm1pc3Npb25SZXF1ZXN0LmpzJ1xuaW1wb3J0IHsgU3RhdHVzTm90aWNlcyB9IGZyb20gJy4vU3RhdHVzTm90aWNlcy5qcydcbmltcG9ydCB0eXBlIHsgSnVtcEhhbmRsZSB9IGZyb20gJy4vVmlydHVhbE1lc3NhZ2VMaXN0LmpzJ1xuXG4vLyBNZW1vZWQgbG9nbyBoZWFkZXI6IHRoaXMgYm94IGlzIHRoZSBGSVJTVCBzaWJsaW5nIGJlZm9yZSBhbGwgTWVzc2FnZVJvd3Ncbi8vIGluIG1haW4tc2NyZWVuIG1vZGUuIElmIGl0IGJlY29tZXMgZGlydHkgb24gZXZlcnkgTWVzc2FnZXMgcmUtcmVuZGVyLFxuLy8gcmVuZGVyQ2hpbGRyZW4ncyBzZWVuRGlydHlDaGlsZCBjYXNjYWRlIGRpc2FibGVzIHByZXZTY3JlZW4gKGJsaXQpIGZvclxuLy8gQUxMIHN1YnNlcXVlbnQgc2libGluZ3Mg4oCUIGV2ZXJ5IE1lc3NhZ2VSb3cgcmUtd3JpdGVzIGZyb20gc2NyYXRjaCBpbnN0ZWFkXG4vLyBvZiBibGl0dGluZy4gSW4gbG9uZyBzZXNzaW9ucyAofjI4MDAgbWVzc2FnZXMpIHRoaXMgaXMgMTUwSysgd3JpdGVzL2ZyYW1lXG4vLyBhbmQgcGVncyBDUFUgYXQgMTAwJS4gTWVtbyBvbiBhZ2VudERlZmluaXRpb25zIHNvIGEgbmV3IG1lc3NhZ2VzIGFycmF5XG4vLyBkb2Vzbid0IGludmFsaWRhdGUgdGhlIGxvZ28gc3VidHJlZS4gTG9nb1YyL1N0YXR1c05vdGljZXMgaW50ZXJuYWxseVxuLy8gc3Vic2NyaWJlIHRvIHVzZUFwcFN0YXRlL3VzZVNldHRpbmdzIGZvciB0aGVpciBvd24gdXBkYXRlcy5cbmNvbnN0IExvZ29IZWFkZXIgPSBSZWFjdC5tZW1vKGZ1bmN0aW9uIExvZ29IZWFkZXIoe1xuICBhZ2VudERlZmluaXRpb25zLFxufToge1xuICBhZ2VudERlZmluaXRpb25zOiBBZ2VudERlZmluaXRpb25zUmVzdWx0IHwgdW5kZWZpbmVkXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgLy8gTG9nb1YyIGhhcyBpdHMgb3duIGludGVybmFsIE9mZnNjcmVlbkZyZWV6ZSAoY2F0Y2hlcyBpdHMgdXNlQXBwU3RhdGVcbiAgLy8gcmUtcmVuZGVycykuIFRoaXMgb3V0ZXIgZnJlZXplIGNhdGNoZXMgYWdlbnREZWZpbml0aW9ucyBjaGFuZ2VzIGFuZCBhbnlcbiAgLy8gZnV0dXJlIFN0YXR1c05vdGljZXMgc3Vic2NyaXB0aW9ucyB3aGlsZSB0aGUgaGVhZGVyIGlzIGluIHNjcm9sbGJhY2suXG4gIHJldHVybiAoXG4gICAgPE9mZnNjcmVlbkZyZWV6ZT5cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGdhcD17MX0+XG4gICAgICAgIDxMb2dvVjIgLz5cbiAgICAgICAgPFJlYWN0LlN1c3BlbnNlIGZhbGxiYWNrPXtudWxsfT5cbiAgICAgICAgICA8U3RhdHVzTm90aWNlcyBhZ2VudERlZmluaXRpb25zPXthZ2VudERlZmluaXRpb25zfSAvPlxuICAgICAgICA8L1JlYWN0LlN1c3BlbnNlPlxuICAgICAgPC9Cb3g+XG4gICAgPC9PZmZzY3JlZW5GcmVlemU+XG4gIClcbn0pXG5cbi8vIERlYWQgY29kZSBlbGltaW5hdGlvbjogY29uZGl0aW9uYWwgaW1wb3J0IGZvciBwcm9hY3RpdmUgbW9kZVxuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuY29uc3QgcHJvYWN0aXZlTW9kdWxlID1cbiAgZmVhdHVyZSgnUFJPQUNUSVZFJykgfHwgZmVhdHVyZSgnS0FJUk9TJylcbiAgICA/IHJlcXVpcmUoJy4uL3Byb2FjdGl2ZS9pbmRleC5qcycpXG4gICAgOiBudWxsXG5jb25zdCBCUklFRl9UT09MX05BTUU6IHN0cmluZyB8IG51bGwgPVxuICBmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQlJJRUYnKVxuICAgID8gKFxuICAgICAgICByZXF1aXJlKCcuLi90b29scy9CcmllZlRvb2wvcHJvbXB0LmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi4vdG9vbHMvQnJpZWZUb29sL3Byb21wdC5qcycpXG4gICAgICApLkJSSUVGX1RPT0xfTkFNRVxuICAgIDogbnVsbFxuY29uc3QgU0VORF9VU0VSX0ZJTEVfVE9PTF9OQU1FOiBzdHJpbmcgfCBudWxsID0gZmVhdHVyZSgnS0FJUk9TJylcbiAgPyAoXG4gICAgICByZXF1aXJlKCcuLi90b29scy9TZW5kVXNlckZpbGVUb29sL3Byb21wdC5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4uL3Rvb2xzL1NlbmRVc2VyRmlsZVRvb2wvcHJvbXB0LmpzJylcbiAgICApLlNFTkRfVVNFUl9GSUxFX1RPT0xfTkFNRVxuICA6IG51bGxcblxuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5pbXBvcnQgeyBWaXJ0dWFsTWVzc2FnZUxpc3QgfSBmcm9tICcuL1ZpcnR1YWxNZXNzYWdlTGlzdC5qcydcblxuLyoqXG4gKiBJbiBicmllZi1vbmx5IG1vZGUsIGZpbHRlciBtZXNzYWdlcyB0byBzaG93IE9OTFkgQnJpZWYgdG9vbF91c2UgYmxvY2tzLFxuICogdGhlaXIgdG9vbF9yZXN1bHRzLCBhbmQgcmVhbCB1c2VyIGlucHV0LiBBbGwgYXNzaXN0YW50IHRleHQgaXMgZHJvcHBlZCDigJRcbiAqIGlmIHRoZSBtb2RlbCBmb3JnZXRzIHRvIGNhbGwgQnJpZWYsIHRoZSB1c2VyIHNlZXMgbm90aGluZyBmb3IgdGhhdCB0dXJuLlxuICogVGhhdCdzIG9uIHRoZSBtb2RlbCB0byBnZXQgcmlnaHQ7IHRoZSBmaWx0ZXIgZG9lcyBub3Qgc2Vjb25kLWd1ZXNzIGl0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZmlsdGVyRm9yQnJpZWZUb29sPFxuICBUIGV4dGVuZHMge1xuICAgIHR5cGU6IHN0cmluZ1xuICAgIHN1YnR5cGU/OiBzdHJpbmdcbiAgICBpc01ldGE/OiBib29sZWFuXG4gICAgaXNBcGlFcnJvck1lc3NhZ2U/OiBib29sZWFuXG4gICAgbWVzc2FnZT86IHtcbiAgICAgIGNvbnRlbnQ6IEFycmF5PHtcbiAgICAgICAgdHlwZTogc3RyaW5nXG4gICAgICAgIG5hbWU/OiBzdHJpbmdcbiAgICAgICAgdG9vbF91c2VfaWQ/OiBzdHJpbmdcbiAgICAgIH0+XG4gICAgfVxuICAgIGF0dGFjaG1lbnQ/OiB7XG4gICAgICB0eXBlOiBzdHJpbmdcbiAgICAgIGlzTWV0YT86IGJvb2xlYW5cbiAgICAgIG9yaWdpbj86IHVua25vd25cbiAgICAgIGNvbW1hbmRNb2RlPzogc3RyaW5nXG4gICAgfVxuICB9LFxuPihtZXNzYWdlczogVFtdLCBicmllZlRvb2xOYW1lczogc3RyaW5nW10pOiBUW10ge1xuICBjb25zdCBuYW1lU2V0ID0gbmV3IFNldChicmllZlRvb2xOYW1lcylcbiAgLy8gdG9vbF91c2UgYWx3YXlzIHByZWNlZGVzIGl0cyB0b29sX3Jlc3VsdCBpbiB0aGUgYXJyYXksIHNvIHdlIGNhbiBjb2xsZWN0XG4gIC8vIElEcyBhbmQgbWF0Y2ggYWdhaW5zdCB0aGVtIGluIGEgc2luZ2xlIHBhc3MuXG4gIGNvbnN0IGJyaWVmVG9vbFVzZUlEcyA9IG5ldyBTZXQ8c3RyaW5nPigpXG4gIHJldHVybiBtZXNzYWdlcy5maWx0ZXIobXNnID0+IHtcbiAgICAvLyBTeXN0ZW0gbWVzc2FnZXMgKGF0dGFjaCBjb25maXJtYXRpb24sIHJlbW90ZSBlcnJvcnMsIGNvbXBhY3QgYm91bmRhcmllcylcbiAgICAvLyBtdXN0IHN0YXkgdmlzaWJsZSDigJQgZHJvcHBpbmcgdGhlbSBsZWF2ZXMgdGhlIHZpZXdlciB3aXRoIG5vIGZlZWRiYWNrLlxuICAgIC8vIEV4Y2VwdGlvbjogYXBpX21ldHJpY3MgaXMgcGVyLXR1cm4gZGVidWcgbm9pc2UgKFRURlQsIGNvbmZpZyB3cml0ZXMsXG4gICAgLy8gaG9vayB0aW1pbmcpIHRoYXQgZGVmZWF0cyB0aGUgcG9pbnQgb2YgYnJpZWYgbW9kZS4gU3RpbGwgdmlzaWJsZSBpblxuICAgIC8vIHRyYW5zY3JpcHQgbW9kZSAoY3RybCtvKSB3aGljaCBieXBhc3NlcyB0aGlzIGZpbHRlci5cbiAgICBpZiAobXNnLnR5cGUgPT09ICdzeXN0ZW0nKSByZXR1cm4gbXNnLnN1YnR5cGUgIT09ICdhcGlfbWV0cmljcydcbiAgICBjb25zdCBibG9jayA9IG1zZy5tZXNzYWdlPy5jb250ZW50WzBdXG4gICAgaWYgKG1zZy50eXBlID09PSAnYXNzaXN0YW50Jykge1xuICAgICAgLy8gQVBJIGVycm9yIG1lc3NhZ2VzIChhdXRoIGZhaWx1cmVzLCByYXRlIGxpbWl0cywgZXRjLikgbXVzdCBzdGF5IHZpc2libGVcbiAgICAgIGlmIChtc2cuaXNBcGlFcnJvck1lc3NhZ2UpIHJldHVybiB0cnVlXG4gICAgICAvLyBLZWVwIEJyaWVmIHRvb2xfdXNlIGJsb2NrcyAocmVuZGVycyB3aXRoIHN0YW5kYXJkIHRvb2wgY2FsbCBjaHJvbWUsXG4gICAgICAvLyBhbmQgbXVzdCBiZSBpbiB0aGUgbGlzdCBzbyBidWlsZE1lc3NhZ2VMb29rdXBzIGNhbiByZXNvbHZlIHRvb2wgcmVzdWx0cylcbiAgICAgIGlmIChibG9jaz8udHlwZSA9PT0gJ3Rvb2xfdXNlJyAmJiBibG9jay5uYW1lICYmIG5hbWVTZXQuaGFzKGJsb2NrLm5hbWUpKSB7XG4gICAgICAgIGlmICgnaWQnIGluIGJsb2NrKSB7XG4gICAgICAgICAgYnJpZWZUb29sVXNlSURzLmFkZCgoYmxvY2sgYXMgeyBpZDogc3RyaW5nIH0pLmlkKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgaWYgKG1zZy50eXBlID09PSAndXNlcicpIHtcbiAgICAgIGlmIChibG9jaz8udHlwZSA9PT0gJ3Rvb2xfcmVzdWx0Jykge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIGJsb2NrLnRvb2xfdXNlX2lkICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICBicmllZlRvb2xVc2VJRHMuaGFzKGJsb2NrLnRvb2xfdXNlX2lkKVxuICAgICAgICApXG4gICAgICB9XG4gICAgICAvLyBSZWFsIHVzZXIgaW5wdXQgb25seSDigJQgZHJvcCBtZXRhL3RpY2sgbWVzc2FnZXMuXG4gICAgICByZXR1cm4gIW1zZy5pc01ldGFcbiAgICB9XG4gICAgaWYgKG1zZy50eXBlID09PSAnYXR0YWNobWVudCcpIHtcbiAgICAgIC8vIEh1bWFuIGlucHV0IGRyYWluZWQgbWlkLXR1cm4gYXJyaXZlcyBhcyBhIHF1ZXVlZF9jb21tYW5kIGF0dGFjaG1lbnRcbiAgICAgIC8vIChxdWVyeS50cyBtaWQtY2hhaW4gZHJhaW4g4oaSIGdldFF1ZXVlZENvbW1hbmRBdHRhY2htZW50cykuIEtlZXAgaXQg4oCUXG4gICAgICAvLyBpdCdzIHdoYXQgdGhlIHVzZXIgdHlwZWQuIGNvbW1hbmRNb2RlID09PSAncHJvbXB0JyBwb3NpdGl2ZWx5XG4gICAgICAvLyBpZGVudGlmaWVzIGh1bWFuLXR5cGVkIGlucHV0OyB0YXNrLW5vdGlmaWNhdGlvbiBjYWxsZXJzIHNldFxuICAgICAgLy8gbW9kZTogJ3Rhc2stbm90aWZpY2F0aW9uJyBidXQgbm90IG9yaWdpbi9pc01ldGEsIHNvIHRoZSBwb3NpdGl2ZVxuICAgICAgLy8gY29tbWFuZE1vZGUgY2hlY2sgaXMgcmVxdWlyZWQgdG8gZXhjbHVkZSB0aGVtLlxuICAgICAgY29uc3QgYXR0ID0gbXNnLmF0dGFjaG1lbnRcbiAgICAgIHJldHVybiAoXG4gICAgICAgIGF0dD8udHlwZSA9PT0gJ3F1ZXVlZF9jb21tYW5kJyAmJlxuICAgICAgICBhdHQuY29tbWFuZE1vZGUgPT09ICdwcm9tcHQnICYmXG4gICAgICAgICFhdHQuaXNNZXRhICYmXG4gICAgICAgIGF0dC5vcmlnaW4gPT09IHVuZGVmaW5lZFxuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfSlcbn1cblxuLyoqXG4gKiBGdWxsLXRyYW5zY3JpcHQgY29tcGFuaW9uIHRvIGZpbHRlckZvckJyaWVmVG9vbC4gV2hlbiB0aGUgQnJpZWYgdG9vbCBpc1xuICogaW4gdXNlLCB0aGUgbW9kZWwncyB0ZXh0IG91dHB1dCBpcyByZWR1bmRhbnQgd2l0aCB0aGUgU2VuZFVzZXJNZXNzYWdlXG4gKiBjb250ZW50IGl0IHdyb3RlIHJpZ2h0IGFmdGVyIOKAlCBkcm9wIHRoZSB0ZXh0IHNvIG9ubHkgdGhlIFNlbmRVc2VyTWVzc2FnZVxuICogYmxvY2sgc2hvd3MuIFRvb2wgY2FsbHMgYW5kIHRoZWlyIHJlc3VsdHMgc3RheSB2aXNpYmxlLlxuICpcbiAqIFBlci10dXJuOiBvbmx5IGRyb3BzIHRleHQgaW4gdHVybnMgdGhhdCBhY3R1YWxseSBjYWxsZWQgQnJpZWYuIElmIHRoZVxuICogbW9kZWwgZm9yZ2V0cywgdGV4dCBzdGlsbCBzaG93cyDigJQgb3RoZXJ3aXNlIHRoZSB1c2VyIHdvdWxkIHNlZSBub3RoaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZHJvcFRleHRJbkJyaWVmVHVybnM8XG4gIFQgZXh0ZW5kcyB7XG4gICAgdHlwZTogc3RyaW5nXG4gICAgaXNNZXRhPzogYm9vbGVhblxuICAgIG1lc3NhZ2U/OiB7IGNvbnRlbnQ6IEFycmF5PHsgdHlwZTogc3RyaW5nOyBuYW1lPzogc3RyaW5nIH0+IH1cbiAgfSxcbj4obWVzc2FnZXM6IFRbXSwgYnJpZWZUb29sTmFtZXM6IHN0cmluZ1tdKTogVFtdIHtcbiAgY29uc3QgbmFtZVNldCA9IG5ldyBTZXQoYnJpZWZUb29sTmFtZXMpXG4gIC8vIEZpcnN0IHBhc3M6IGZpbmQgd2hpY2ggdHVybnMgKGJvdW5kZWQgYnkgbm9uLW1ldGEgdXNlciBtZXNzYWdlcykgY29udGFpblxuICAvLyBhIEJyaWVmIHRvb2xfdXNlLiBUYWcgZWFjaCBhc3Npc3RhbnQgdGV4dCBibG9jayB3aXRoIGl0cyB0dXJuIGluZGV4LlxuICBjb25zdCB0dXJuc1dpdGhCcmllZiA9IG5ldyBTZXQ8bnVtYmVyPigpXG4gIGNvbnN0IHRleHRJbmRleFRvVHVybjogbnVtYmVyW10gPSBbXVxuICBsZXQgdHVybiA9IDBcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNzYWdlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IG1zZyA9IG1lc3NhZ2VzW2ldIVxuICAgIGNvbnN0IGJsb2NrID0gbXNnLm1lc3NhZ2U/LmNvbnRlbnRbMF1cbiAgICBpZiAobXNnLnR5cGUgPT09ICd1c2VyJyAmJiBibG9jaz8udHlwZSAhPT0gJ3Rvb2xfcmVzdWx0JyAmJiAhbXNnLmlzTWV0YSkge1xuICAgICAgdHVybisrXG4gICAgICBjb250aW51ZVxuICAgIH1cbiAgICBpZiAobXNnLnR5cGUgPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgICBpZiAoYmxvY2s/LnR5cGUgPT09ICd0ZXh0Jykge1xuICAgICAgICB0ZXh0SW5kZXhUb1R1cm5baV0gPSB0dXJuXG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBibG9jaz8udHlwZSA9PT0gJ3Rvb2xfdXNlJyAmJlxuICAgICAgICBibG9jay5uYW1lICYmXG4gICAgICAgIG5hbWVTZXQuaGFzKGJsb2NrLm5hbWUpXG4gICAgICApIHtcbiAgICAgICAgdHVybnNXaXRoQnJpZWYuYWRkKHR1cm4pXG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmICh0dXJuc1dpdGhCcmllZi5zaXplID09PSAwKSByZXR1cm4gbWVzc2FnZXNcbiAgLy8gU2Vjb25kIHBhc3M6IGRyb3AgdGV4dCBibG9ja3Mgd2hvc2UgdHVybiBjYWxsZWQgQnJpZWYuXG4gIHJldHVybiBtZXNzYWdlcy5maWx0ZXIoKF8sIGkpID0+IHtcbiAgICBjb25zdCB0ID0gdGV4dEluZGV4VG9UdXJuW2ldXG4gICAgcmV0dXJuIHQgPT09IHVuZGVmaW5lZCB8fCAhdHVybnNXaXRoQnJpZWYuaGFzKHQpXG4gIH0pXG59XG5cbnR5cGUgUHJvcHMgPSB7XG4gIG1lc3NhZ2VzOiBNZXNzYWdlVHlwZVtdXG4gIHRvb2xzOiBUb29sc1xuICBjb21tYW5kczogQ29tbWFuZFtdXG4gIHZlcmJvc2U6IGJvb2xlYW5cbiAgdG9vbEpTWDoge1xuICAgIGpzeDogUmVhY3QuUmVhY3ROb2RlIHwgbnVsbFxuICAgIHNob3VsZEhpZGVQcm9tcHRJbnB1dDogYm9vbGVhblxuICAgIHNob3VsZENvbnRpbnVlQW5pbWF0aW9uPzogdHJ1ZVxuICB9IHwgbnVsbFxuICB0b29sVXNlQ29uZmlybVF1ZXVlOiBUb29sVXNlQ29uZmlybVtdXG4gIGluUHJvZ3Jlc3NUb29sVXNlSURzOiBTZXQ8c3RyaW5nPlxuICBpc01lc3NhZ2VTZWxlY3RvclZpc2libGU6IGJvb2xlYW5cbiAgY29udmVyc2F0aW9uSWQ6IHN0cmluZ1xuICBzY3JlZW46IFNjcmVlblxuICBzdHJlYW1pbmdUb29sVXNlczogU3RyZWFtaW5nVG9vbFVzZVtdXG4gIHNob3dBbGxJblRyYW5zY3JpcHQ/OiBib29sZWFuXG4gIGFnZW50RGVmaW5pdGlvbnM/OiBBZ2VudERlZmluaXRpb25zUmVzdWx0XG4gIG9uT3BlblJhdGVMaW1pdE9wdGlvbnM/OiAoKSA9PiB2b2lkXG4gIC8qKiBIaWRlIHRoZSBsb2dvL2hlYWRlciAtIHVzZWQgZm9yIHN1YmFnZW50IHpvb20gdmlldyAqL1xuICBoaWRlTG9nbz86IGJvb2xlYW5cbiAgaXNMb2FkaW5nOiBib29sZWFuXG4gIC8qKiBJbiB0cmFuc2NyaXB0IG1vZGUsIGhpZGUgYWxsIHRoaW5raW5nIGJsb2NrcyBleGNlcHQgdGhlIGxhc3Qgb25lICovXG4gIGhpZGVQYXN0VGhpbmtpbmc/OiBib29sZWFuXG4gIC8qKiBTdHJlYW1pbmcgdGhpbmtpbmcgY29udGVudCAobGl2ZSB1cGRhdGVzLCBub3QgZnJvemVuKSAqL1xuICBzdHJlYW1pbmdUaGlua2luZz86IFN0cmVhbWluZ1RoaW5raW5nIHwgbnVsbFxuICAvKiogU3RyZWFtaW5nIHRleHQgcHJldmlldyAocmVuZGVyZWQgYXMgbGFzdCBpdGVtIHNvIHRyYW5zaXRpb24gdG8gZmluYWwgbWVzc2FnZSBpcyBwb3NpdGlvbmFsbHkgc2VhbWxlc3MpICovXG4gIHN0cmVhbWluZ1RleHQ/OiBzdHJpbmcgfCBudWxsXG4gIC8qKiBXaGVuIHRydWUsIG9ubHkgc2hvdyBCcmllZiB0b29sIG91dHB1dCAoaGlkZSBldmVyeXRoaW5nIGVsc2UpICovXG4gIGlzQnJpZWZPbmx5PzogYm9vbGVhblxuICAvKiogRnVsbHNjcmVlbi1tb2RlIFwi4pSA4pSA4pSAIE4gbmV3IOKUgOKUgOKUgFwiIGRpdmlkZXIuIFJlbmRlcnMgYmVmb3JlIHRoZSBmaXJzdFxuICAgKiAgcmVuZGVyYWJsZU1lc3NhZ2UgZGVyaXZlZCBmcm9tIGZpcnN0VW5zZWVuVXVpZCAobWF0Y2hlZCBieSB0aGUgMjQtY2hhclxuICAgKiAgcHJlZml4IHRoYXQgZGVyaXZlVVVJRCBwcmVzZXJ2ZXMpLiAqL1xuICB1bnNlZW5EaXZpZGVyPzogVW5zZWVuRGl2aWRlclxuICAvKiogRnVsbHNjcmVlbi1tb2RlIFNjcm9sbEJveCBoYW5kbGUuIEVuYWJsZXMgUmVhY3QtbGV2ZWwgdmlydHVhbGl6YXRpb24gd2hlbiBwcmVzZW50LiAqL1xuICBzY3JvbGxSZWY/OiBSZWZPYmplY3Q8U2Nyb2xsQm94SGFuZGxlIHwgbnVsbD5cbiAgLyoqIEZ1bGxzY3JlZW4tbW9kZTogZW5hYmxlIHN0aWNreS1wcm9tcHQgdHJhY2tpbmcgKHdyaXRlcyB2aWEgU2Nyb2xsQ2hyb21lQ29udGV4dCkuICovXG4gIHRyYWNrU3RpY2t5UHJvbXB0PzogYm9vbGVhblxuICAvKiogVHJhbnNjcmlwdCBzZWFyY2g6IGp1bXAtdG8taW5kZXggKyBzZXRTZWFyY2hRdWVyeS9uZXh0TWF0Y2gvcHJldk1hdGNoLiAqL1xuICBqdW1wUmVmPzogUmVmT2JqZWN0PEp1bXBIYW5kbGUgfCBudWxsPlxuICAvKiogVHJhbnNjcmlwdCBzZWFyY2g6IGZpcmVzIHdoZW4gbWF0Y2ggY291bnQvcG9zaXRpb24gY2hhbmdlcy4gKi9cbiAgb25TZWFyY2hNYXRjaGVzQ2hhbmdlPzogKGNvdW50OiBudW1iZXIsIGN1cnJlbnQ6IG51bWJlcikgPT4gdm9pZFxuICAvKiogUGFpbnQgYW4gZXhpc3RpbmcgRE9NIHN1YnRyZWUgdG8gZnJlc2ggU2NyZWVuLCBzY2FuLiBFbGVtZW50IGNvbWVzXG4gICAqICBmcm9tIHRoZSBtYWluIHRyZWUgKGFsbCByZWFsIHByb3ZpZGVycykuIE1lc3NhZ2UtcmVsYXRpdmUgcG9zaXRpb25zLiAqL1xuICBzY2FuRWxlbWVudD86IChcbiAgICBlbDogaW1wb3J0KCcuLi9pbmsvZG9tLmpzJykuRE9NRWxlbWVudCxcbiAgKSA9PiBpbXBvcnQoJy4uL2luay9yZW5kZXItdG8tc2NyZWVuLmpzJykuTWF0Y2hQb3NpdGlvbltdXG4gIC8qKiBQb3NpdGlvbi1iYXNlZCBDVVJSRU5UIGhpZ2hsaWdodC4gcG9zaXRpb25zIHN0YWJsZSAobXNnLXJlbGF0aXZlKSxcbiAgICogIHJvd09mZnNldCB0cmFja3Mgc2Nyb2xsLiBudWxsIGNsZWFycy4gKi9cbiAgc2V0UG9zaXRpb25zPzogKFxuICAgIHN0YXRlOiB7XG4gICAgICBwb3NpdGlvbnM6IGltcG9ydCgnLi4vaW5rL3JlbmRlci10by1zY3JlZW4uanMnKS5NYXRjaFBvc2l0aW9uW11cbiAgICAgIHJvd09mZnNldDogbnVtYmVyXG4gICAgICBjdXJyZW50SWR4OiBudW1iZXJcbiAgICB9IHwgbnVsbCxcbiAgKSA9PiB2b2lkXG4gIC8qKiBCeXBhc3MgTUFYX01FU1NBR0VTX1dJVEhPVVRfVklSVFVBTElaQVRJT04uIEZvciBvbmUtc2hvdCBoZWFkbGVzcyByZW5kZXJzXG4gICAqICAoZS5nLiAvZXhwb3J0IHZpYSByZW5kZXJUb1N0cmluZykgd2hlcmUgdGhlIG1lbW9yeSBjb25jZXJuIGRvZXNuJ3QgYXBwbHlcbiAgICogIGFuZCB0aGUgXCJhbHJlYWR5IGluIHNjcm9sbGJhY2tcIiBqdXN0aWZpY2F0aW9uIGRvZXNuJ3QgaG9sZC4gKi9cbiAgZGlzYWJsZVJlbmRlckNhcD86IGJvb2xlYW5cbiAgLyoqIEluLXRyYW5zY3JpcHQgY3Vyc29yOyBleHBhbmRlZCBvdmVycmlkZXMgdmVyYm9zZSBmb3Igc2VsZWN0ZWQgbWVzc2FnZS4gKi9cbiAgY3Vyc29yPzogTWVzc2FnZUFjdGlvbnNTdGF0ZSB8IG51bGxcbiAgc2V0Q3Vyc29yPzogKGN1cnNvcjogTWVzc2FnZUFjdGlvbnNTdGF0ZSB8IG51bGwpID0+IHZvaWRcbiAgLyoqIFBhc3NlZCB0aHJvdWdoIHRvIFZpcnR1YWxNZXNzYWdlTGlzdCAoaGVpZ2h0Q2FjaGUgb3ducyB2aXNpYmlsaXR5KS4gKi9cbiAgY3Vyc29yTmF2UmVmPzogUmVhY3QuUmVmPE1lc3NhZ2VBY3Rpb25zTmF2PlxuICAvKiogUmVuZGVyIG9ubHkgY29sbGFwc2VkLnNsaWNlKHN0YXJ0LCBlbmQpLiBGb3IgY2h1bmtlZCBoZWFkbGVzcyBleHBvcnRcbiAgICogIChzdHJlYW1SZW5kZXJlZE1lc3NhZ2VzIGluIGV4cG9ydFJlbmRlcmVyLnRzeCk6IHByZXAgcnVucyBvbiB0aGUgRlVMTFxuICAgKiAgbWVzc2FnZXMgYXJyYXkgc28gZ3JvdXBpbmcvbG9va3VwcyBhcmUgY29ycmVjdCwgYnV0IG9ubHkgdGhpcyBzbGljZVxuICAgKiAgY2h1bmsgaW5zdGVhZCBvZiB0aGUgZnVsbCBzZXNzaW9uLiBUaGUgbG9nbyByZW5kZXJzIG9ubHkgZm9yIGNodW5rIDBcbiAgICogIChzdGFydCA9PT0gMCk7IGxhdGVyIGNodW5rcyBhcmUgbWlkLXN0cmVhbSBjb250aW51YXRpb25zLlxuICAgKiAgTWVhc3VyZWQgTWFyIDIwMjY6IDUzOC1tc2cgc2Vzc2lvbiwgMjAgc2xpY2VzIOKGkiDiiJI1NSUgcGxhdGVhdSBSU1MuICovXG4gIHJlbmRlclJhbmdlPzogcmVhZG9ubHkgW3N0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyXVxufVxuXG5jb25zdCBNQVhfTUVTU0FHRVNfVE9fU0hPV19JTl9UUkFOU0NSSVBUX01PREUgPSAzMFxuXG4vLyBTYWZldHkgY2FwIGZvciB0aGUgbm9uLXZpcnR1YWxpemVkIHJlbmRlciBwYXRoIChmdWxsc2NyZWVuIG9mZiBvclxuLy8gZXhwbGljaXRseSBkaXNhYmxlZCkuIEluayBtb3VudHMgYSBmdWxsIGZpYmVyIHRyZWUgcGVyIG1lc3NhZ2UgKH4yNTAgS0Jcbi8vIFJTUyBlYWNoKTsgeW9nYSBsYXlvdXQgaGVpZ2h0IGdyb3dzIHVuYm91bmRlZDsgdGhlIHNjcmVlbiBidWZmZXIgaXMgc2l6ZWRcbi8vIHRvIGZpdCBldmVyeSBsaW5lLiBBdCB+MjAwMCBtZXNzYWdlcyB0aGlzIGlzIH4zMDAwLWxpbmUgc2NyZWVucywgfjUwMCBNQlxuLy8gb2YgZmliZXJzLCBhbmQgcGVyLWZyYW1lIHdyaXRlIGNvc3RzIHRoYXQgcHVzaCB0aGUgcHJvY2VzcyBpbnRvIGEgR0Ncbi8vIGRlYXRoIHNwaXJhbCAob2JzZXJ2ZWQ6IDU5IEdCIFJTUywgMTRrIG1tYXAvbXVubWFwL3NlYykuIENvbnRlbnQgZHJvcHBlZFxuLy8gZnJvbSB0aGlzIHNsaWNlIGhhcyBhbHJlYWR5IGJlZW4gcHJpbnRlZCB0byB0ZXJtaW5hbCBzY3JvbGxiYWNrIOKAlCB1c2Vyc1xuLy8gY2FuIHN0aWxsIHNjcm9sbCB1cCBuYXRpdmVseS4gVmlydHVhbE1lc3NhZ2VMaXN0ICh0aGUgZGVmYXVsdCBhbnQgcGF0aClcbi8vIGJ5cGFzc2VzIHRoaXMgY2FwIGVudGlyZWx5LiBIZWFkbGVzcyBvbmUtc2hvdCByZW5kZXJzIChlLmcuIC9leHBvcnQpXG4vLyBwYXNzIGRpc2FibGVSZW5kZXJDYXAgdG8gb3B0IG91dCDigJQgdGhleSBoYXZlIG5vIHNjcm9sbGJhY2sgYW5kIHRoZVxuLy8gbWVtb3J5IGNvbmNlcm4gZG9lc24ndCBhcHBseSB0byByZW5kZXJUb1N0cmluZy5cbi8vXG4vLyBUaGUgc2xpY2UgYm91bmRhcnkgaXMgdHJhY2tlZCBhcyBhIFVVSUQgYW5jaG9yLCBub3QgYSBjb3VudC1kZXJpdmVkXG4vLyBpbmRleC4gQ291bnQtYmFzZWQgc2xpY2luZyAoc2xpY2UoLTIwMCkpIGRyb3BzIG9uZSBtZXNzYWdlIGZyb20gdGhlXG4vLyBmcm9udCBvbiBldmVyeSBhcHBlbmQsIHNoaWZ0aW5nIHNjcm9sbGJhY2sgY29udGVudCBhbmQgZm9yY2luZyBhIGZ1bGxcbi8vIHRlcm1pbmFsIHJlc2V0IHBlciB0dXJuIChDQy05NDEpLiBRdWFudGl6aW5nIHRvIDUwLW1lc3NhZ2Ugc3RlcHNcbi8vIChDQy0xMTU0KSBoZWxwZWQgYnV0IHN0aWxsIHNoaWZ0ZWQgb24gY29tcGFjdGlvbiBhbmQgY29sbGFwc2UgcmVncm91cGluZ1xuLy8gc2luY2UgdGhvc2UgY2hhbmdlIGNvbGxhcHNlZC5sZW5ndGggd2l0aG91dCBhZGRpbmcgbWVzc2FnZXMuIFRoZSBVVUlEXG4vLyBhbmNob3Igb25seSBhZHZhbmNlcyB3aGVuIHJlbmRlcmVkIGNvdW50IGdlbnVpbmVseSBleGNlZWRzIENBUCtTVEVQIOKAlFxuLy8gaW1tdW5lIHRvIGxlbmd0aCBjaHVybiBmcm9tIGdyb3VwaW5nL2NvbXBhY3Rpb24gKENDLTExNzQpLlxuLy9cbi8vIFRoZSBhbmNob3Igc3RvcmVzIEJPVEggdXVpZCBhbmQgaW5kZXguIFNvbWUgdXVpZHMgYXJlIHVuc3RhYmxlIGJldHdlZW5cbi8vIHJlbmRlcnM6IGNvbGxhcHNlSG9va1N1bW1hcmllcyBkZXJpdmVzIHRoZSBtZXJnZWQgdXVpZCBmcm9tIHRoZSBmaXJzdFxuLy8gc3VtbWFyeSBpbiBhIGdyb3VwLCBidXQgcmVvcmRlck1lc3NhZ2VzSW5VSSByZXNodWZmbGVzIGhvb2sgYWRqYWNlbmN5XG4vLyBhcyB0b29sIHJlc3VsdHMgc3RyZWFtIGluLCBjaGFuZ2luZyB3aGljaCBzdW1tYXJ5IGlzIGZpcnN0LiBXaGVuIHRoZVxuLy8gdXVpZCB2YW5pc2hlcywgZmFsbGluZyBiYWNrIHRvIHRoZSBzdG9yZWQgaW5kZXggKGNsYW1wZWQpIGtlZXBzIHRoZVxuLy8gc2xpY2Ugcm91Z2hseSB3aGVyZSBpdCB3YXMgaW5zdGVhZCBvZiByZXNldHRpbmcgdG8gMCDigJQgd2hpY2ggd291bGRcbi8vIGp1bXAgZnJvbSB+MjAwIHJlbmRlcmVkIG1lc3NhZ2VzIHRvIHRoZSBmdWxsIGhpc3RvcnksIG9ycGhhbmluZ1xuLy8gaW4tcHJvZ3Jlc3MgYmFkZ2Ugc25hcHNob3RzIGluIHNjcm9sbGJhY2suXG5jb25zdCBNQVhfTUVTU0FHRVNfV0lUSE9VVF9WSVJUVUFMSVpBVElPTiA9IDIwMFxuY29uc3QgTUVTU0FHRV9DQVBfU1RFUCA9IDUwXG5cbmV4cG9ydCB0eXBlIFNsaWNlQW5jaG9yID0geyB1dWlkOiBzdHJpbmc7IGlkeDogbnVtYmVyIH0gfCBudWxsXG5cbi8qKiBFeHBvcnRlZCBmb3IgdGVzdGluZy4gTXV0YXRlcyBhbmNob3JSZWYgd2hlbiB0aGUgd2luZG93IG5lZWRzIHRvIGFkdmFuY2UuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcHV0ZVNsaWNlU3RhcnQoXG4gIGNvbGxhcHNlZDogUmVhZG9ubHlBcnJheTx7IHV1aWQ6IHN0cmluZyB9PixcbiAgYW5jaG9yUmVmOiB7IGN1cnJlbnQ6IFNsaWNlQW5jaG9yIH0sXG4gIGNhcCA9IE1BWF9NRVNTQUdFU19XSVRIT1VUX1ZJUlRVQUxJWkFUSU9OLFxuICBzdGVwID0gTUVTU0FHRV9DQVBfU1RFUCxcbik6IG51bWJlciB7XG4gIGNvbnN0IGFuY2hvciA9IGFuY2hvclJlZi5jdXJyZW50XG4gIGNvbnN0IGFuY2hvcklkeCA9IGFuY2hvclxuICAgID8gY29sbGFwc2VkLmZpbmRJbmRleChtID0+IG0udXVpZCA9PT0gYW5jaG9yLnV1aWQpXG4gICAgOiAtMVxuICAvLyBBbmNob3IgZm91bmQg4oaSIHVzZSBpdC4gQW5jaG9yIGxvc3Qg4oaSIGZhbGwgYmFjayB0byBzdG9yZWQgaW5kZXhcbiAgLy8gKGNsYW1wZWQpIHNvIGNvbGxhcHNlLXJlZ3JvdXBpbmcgdXVpZCBjaHVybiBkb2Vzbid0IHJlc2V0IHRvIDAuXG4gIGxldCBzdGFydCA9XG4gICAgYW5jaG9ySWR4ID49IDBcbiAgICAgID8gYW5jaG9ySWR4XG4gICAgICA6IGFuY2hvclxuICAgICAgICA/IE1hdGgubWluKGFuY2hvci5pZHgsIE1hdGgubWF4KDAsIGNvbGxhcHNlZC5sZW5ndGggLSBjYXApKVxuICAgICAgICA6IDBcbiAgaWYgKGNvbGxhcHNlZC5sZW5ndGggLSBzdGFydCA+IGNhcCArIHN0ZXApIHtcbiAgICBzdGFydCA9IGNvbGxhcHNlZC5sZW5ndGggLSBjYXBcbiAgfVxuICAvLyBSZWZyZXNoIGFuY2hvciBmcm9tIHdoYXRldmVyIGxpdmVzIGF0IHRoZSBjdXJyZW50IHN0YXJ0IOKAlCBoZWFscyBhXG4gIC8vIHN0YWxlIHV1aWQgYWZ0ZXIgZmFsbGJhY2sgYW5kIGNhcHR1cmVzIGEgbmV3IG9uZSBhZnRlciBhZHZhbmNlbWVudC5cbiAgY29uc3QgbXNnQXRTdGFydCA9IGNvbGxhcHNlZFtzdGFydF1cbiAgaWYgKFxuICAgIG1zZ0F0U3RhcnQgJiZcbiAgICAoYW5jaG9yPy51dWlkICE9PSBtc2dBdFN0YXJ0LnV1aWQgfHwgYW5jaG9yLmlkeCAhPT0gc3RhcnQpXG4gICkge1xuICAgIGFuY2hvclJlZi5jdXJyZW50ID0geyB1dWlkOiBtc2dBdFN0YXJ0LnV1aWQsIGlkeDogc3RhcnQgfVxuICB9IGVsc2UgaWYgKCFtc2dBdFN0YXJ0ICYmIGFuY2hvcikge1xuICAgIGFuY2hvclJlZi5jdXJyZW50ID0gbnVsbFxuICB9XG4gIHJldHVybiBzdGFydFxufVxuXG5jb25zdCBNZXNzYWdlc0ltcGwgPSAoe1xuICBtZXNzYWdlcyxcbiAgdG9vbHMsXG4gIGNvbW1hbmRzLFxuICB2ZXJib3NlLFxuICB0b29sSlNYLFxuICB0b29sVXNlQ29uZmlybVF1ZXVlLFxuICBpblByb2dyZXNzVG9vbFVzZUlEcyxcbiAgaXNNZXNzYWdlU2VsZWN0b3JWaXNpYmxlLFxuICBjb252ZXJzYXRpb25JZCxcbiAgc2NyZWVuLFxuICBzdHJlYW1pbmdUb29sVXNlcyxcbiAgc2hvd0FsbEluVHJhbnNjcmlwdCA9IGZhbHNlLFxuICBhZ2VudERlZmluaXRpb25zLFxuICBvbk9wZW5SYXRlTGltaXRPcHRpb25zLFxuICBoaWRlTG9nbyA9IGZhbHNlLFxuICBpc0xvYWRpbmcsXG4gIGhpZGVQYXN0VGhpbmtpbmcgPSBmYWxzZSxcbiAgc3RyZWFtaW5nVGhpbmtpbmcsXG4gIHN0cmVhbWluZ1RleHQsXG4gIGlzQnJpZWZPbmx5ID0gZmFsc2UsXG4gIHVuc2VlbkRpdmlkZXIsXG4gIHNjcm9sbFJlZixcbiAgdHJhY2tTdGlja3lQcm9tcHQsXG4gIGp1bXBSZWYsXG4gIG9uU2VhcmNoTWF0Y2hlc0NoYW5nZSxcbiAgc2NhbkVsZW1lbnQsXG4gIHNldFBvc2l0aW9ucyxcbiAgZGlzYWJsZVJlbmRlckNhcCA9IGZhbHNlLFxuICBjdXJzb3IgPSBudWxsLFxuICBzZXRDdXJzb3IsXG4gIGN1cnNvck5hdlJlZixcbiAgcmVuZGVyUmFuZ2UsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSA9PiB7XG4gIGNvbnN0IHsgY29sdW1ucyB9ID0gdXNlVGVybWluYWxTaXplKClcbiAgY29uc3QgdG9nZ2xlU2hvd0FsbFNob3J0Y3V0ID0gdXNlU2hvcnRjdXREaXNwbGF5KFxuICAgICd0cmFuc2NyaXB0OnRvZ2dsZVNob3dBbGwnLFxuICAgICdUcmFuc2NyaXB0JyxcbiAgICAnQ3RybCtFJyxcbiAgKVxuXG4gIGNvbnN0IG5vcm1hbGl6ZWRNZXNzYWdlcyA9IHVzZU1lbW8oXG4gICAgKCkgPT4gbm9ybWFsaXplTWVzc2FnZXMobWVzc2FnZXMpLmZpbHRlcihpc05vdEVtcHR5TWVzc2FnZSksXG4gICAgW21lc3NhZ2VzXSxcbiAgKVxuXG4gIC8vIENoZWNrIGlmIHN0cmVhbWluZyB0aGlua2luZyBzaG91bGQgYmUgdmlzaWJsZSAoc3RyZWFtaW5nIG9yIHdpdGhpbiAzMHMgdGltZW91dClcbiAgY29uc3QgaXNTdHJlYW1pbmdUaGlua2luZ1Zpc2libGUgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoIXN0cmVhbWluZ1RoaW5raW5nKSByZXR1cm4gZmFsc2VcbiAgICBpZiAoc3RyZWFtaW5nVGhpbmtpbmcuaXNTdHJlYW1pbmcpIHJldHVybiB0cnVlXG4gICAgaWYgKHN0cmVhbWluZ1RoaW5raW5nLnN0cmVhbWluZ0VuZGVkQXQpIHtcbiAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gc3RyZWFtaW5nVGhpbmtpbmcuc3RyZWFtaW5nRW5kZWRBdCA8IDMwMDAwXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9LCBbc3RyZWFtaW5nVGhpbmtpbmddKVxuXG4gIC8vIEZpbmQgdGhlIGxhc3QgdGhpbmtpbmcgYmxvY2sgKG1lc3NhZ2UgVVVJRCArIGNvbnRlbnQgaW5kZXgpIGZvciBoaWRpbmcgcGFzdCB0aGlua2luZyBpbiB0cmFuc2NyaXB0IG1vZGVcbiAgLy8gV2hlbiBzdHJlYW1pbmcgdGhpbmtpbmcgaXMgdmlzaWJsZSwgdXNlIGEgc3BlY2lhbCBJRCB0aGF0IHdvbid0IG1hdGNoIGFueSBjb21wbGV0ZWQgdGhpbmtpbmcgYmxvY2tcbiAgLy8gV2l0aCBhZGFwdGl2ZSB0aGlua2luZywgb25seSBjb25zaWRlciB0aGlua2luZyBibG9ja3MgZnJvbSB0aGUgY3VycmVudCB0dXJuIGFuZCBzdG9wIHNlYXJjaGluZyBvbmNlIHdlXG4gIC8vIGhpdCB0aGUgbGFzdCB1c2VyIG1lc3NhZ2UuXG4gIGNvbnN0IGxhc3RUaGlua2luZ0Jsb2NrSWQgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoIWhpZGVQYXN0VGhpbmtpbmcpIHJldHVybiBudWxsXG4gICAgLy8gSWYgc3RyZWFtaW5nIHRoaW5raW5nIGlzIHZpc2libGUsIGhpZGUgYWxsIGNvbXBsZXRlZCB0aGlua2luZyBibG9ja3MgYnkgdXNpbmcgYSBub24tbWF0Y2hpbmcgSURcbiAgICBpZiAoaXNTdHJlYW1pbmdUaGlua2luZ1Zpc2libGUpIHJldHVybiAnc3RyZWFtaW5nJ1xuICAgIC8vIEl0ZXJhdGUgYmFja3dhcmRzIHRvIGZpbmQgdGhlIGxhc3QgbWVzc2FnZSB3aXRoIGEgdGhpbmtpbmcgYmxvY2tcbiAgICBmb3IgKGxldCBpID0gbm9ybWFsaXplZE1lc3NhZ2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBtc2cgPSBub3JtYWxpemVkTWVzc2FnZXNbaV1cbiAgICAgIGlmIChtc2c/LnR5cGUgPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBtc2cubWVzc2FnZS5jb250ZW50XG4gICAgICAgIC8vIEZpbmQgdGhlIGxhc3QgdGhpbmtpbmcgYmxvY2sgaW4gdGhpcyBtZXNzYWdlXG4gICAgICAgIGZvciAobGV0IGogPSBjb250ZW50Lmxlbmd0aCAtIDE7IGogPj0gMDsgai0tKSB7XG4gICAgICAgICAgaWYgKGNvbnRlbnRbal0/LnR5cGUgPT09ICd0aGlua2luZycpIHtcbiAgICAgICAgICAgIHJldHVybiBgJHttc2cudXVpZH06JHtqfWBcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAobXNnPy50eXBlID09PSAndXNlcicpIHtcbiAgICAgICAgY29uc3QgaGFzVG9vbFJlc3VsdCA9IG1zZy5tZXNzYWdlLmNvbnRlbnQuc29tZShcbiAgICAgICAgICBibG9jayA9PiBibG9jay50eXBlID09PSAndG9vbF9yZXN1bHQnLFxuICAgICAgICApXG4gICAgICAgIGlmICghaGFzVG9vbFJlc3VsdCkge1xuICAgICAgICAgIC8vIFJlYWNoZWQgYSBwcmV2aW91cyB1c2VyIHR1cm4gc28gZG9uJ3Qgc2hvdyBzdGFsZSB0aGlua2luZyBmcm9tIGJlZm9yZVxuICAgICAgICAgIHJldHVybiAnbm8tdGhpbmtpbmcnXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGxcbiAgfSwgW25vcm1hbGl6ZWRNZXNzYWdlcywgaGlkZVBhc3RUaGlua2luZywgaXNTdHJlYW1pbmdUaGlua2luZ1Zpc2libGVdKVxuXG4gIC8vIEZpbmQgdGhlIGxhdGVzdCB1c2VyIGJhc2ggb3V0cHV0IG1lc3NhZ2UgKGZyb20gISBjb21tYW5kcylcbiAgLy8gVGhpcyBhbGxvd3MgdXMgdG8gc2hvdyBmdWxsIG91dHB1dCBmb3IgdGhlIG1vc3QgcmVjZW50IGJhc2ggY29tbWFuZFxuICBjb25zdCBsYXRlc3RCYXNoT3V0cHV0VVVJRCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIC8vIEl0ZXJhdGUgYmFja3dhcmRzIHRvIGZpbmQgdGhlIGxhc3QgdXNlciBtZXNzYWdlIHdpdGggYmFzaCBvdXRwdXRcbiAgICBmb3IgKGxldCBpID0gbm9ybWFsaXplZE1lc3NhZ2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBtc2cgPSBub3JtYWxpemVkTWVzc2FnZXNbaV1cbiAgICAgIGlmIChtc2c/LnR5cGUgPT09ICd1c2VyJykge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gbXNnLm1lc3NhZ2UuY29udGVudFxuICAgICAgICAvLyBDaGVjayBpZiBhbnkgdGV4dCBjb250ZW50IGlzIGJhc2ggb3V0cHV0XG4gICAgICAgIGZvciAoY29uc3QgYmxvY2sgb2YgY29udGVudCkge1xuICAgICAgICAgIGlmIChibG9jay50eXBlID09PSAndGV4dCcpIHtcbiAgICAgICAgICAgIGNvbnN0IHRleHQgPSBibG9jay50ZXh0XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIHRleHQuc3RhcnRzV2l0aCgnPGJhc2gtc3Rkb3V0JykgfHxcbiAgICAgICAgICAgICAgdGV4dC5zdGFydHNXaXRoKCc8YmFzaC1zdGRlcnInKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIHJldHVybiBtc2cudXVpZFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbFxuICB9LCBbbm9ybWFsaXplZE1lc3NhZ2VzXSlcblxuICAvLyBzdHJlYW1pbmdUb29sVXNlcyB1cGRhdGVzIG9uIGV2ZXJ5IGlucHV0X2pzb25fZGVsdGEgd2hpbGUgbm9ybWFsaXplZE1lc3NhZ2VzXG4gIC8vIHN0YXlzIHN0YWJsZSDigJQgcHJlY29tcHV0ZSB0aGUgU2V0IHNvIHRoZSBmaWx0ZXIgaXMgTyhrKSBub3QgTyhuw5drKSBwZXIgY2h1bmsuXG4gIGNvbnN0IG5vcm1hbGl6ZWRUb29sVXNlSURzID0gdXNlTWVtbyhcbiAgICAoKSA9PiBnZXRUb29sVXNlSURzKG5vcm1hbGl6ZWRNZXNzYWdlcyksXG4gICAgW25vcm1hbGl6ZWRNZXNzYWdlc10sXG4gIClcblxuICBjb25zdCBzdHJlYW1pbmdUb29sVXNlc1dpdGhvdXRJblByb2dyZXNzID0gdXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgc3RyZWFtaW5nVG9vbFVzZXMuZmlsdGVyKFxuICAgICAgICBzdHUgPT5cbiAgICAgICAgICAhaW5Qcm9ncmVzc1Rvb2xVc2VJRHMuaGFzKHN0dS5jb250ZW50QmxvY2suaWQpICYmXG4gICAgICAgICAgIW5vcm1hbGl6ZWRUb29sVXNlSURzLmhhcyhzdHUuY29udGVudEJsb2NrLmlkKSxcbiAgICAgICksXG4gICAgW3N0cmVhbWluZ1Rvb2xVc2VzLCBpblByb2dyZXNzVG9vbFVzZUlEcywgbm9ybWFsaXplZFRvb2xVc2VJRHNdLFxuICApXG5cbiAgY29uc3Qgc3ludGhldGljU3RyZWFtaW5nVG9vbFVzZU1lc3NhZ2VzID0gdXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgc3RyZWFtaW5nVG9vbFVzZXNXaXRob3V0SW5Qcm9ncmVzcy5mbGF0TWFwKHN0cmVhbWluZ1Rvb2xVc2UgPT4ge1xuICAgICAgICBjb25zdCBtc2cgPSBjcmVhdGVBc3Npc3RhbnRNZXNzYWdlKHtcbiAgICAgICAgICBjb250ZW50OiBbc3RyZWFtaW5nVG9vbFVzZS5jb250ZW50QmxvY2tdLFxuICAgICAgICB9KVxuICAgICAgICAvLyBPdmVycmlkZSByYW5kb21VVUlEIHdpdGggZGV0ZXJtaW5pc3RpYyB2YWx1ZSBkZXJpdmVkIGZyb20gY29udGVudFxuICAgICAgICAvLyBibG9jayBJRCB0byBwcmV2ZW50IFJlYWN0IGtleSBjaGFuZ2VzIG9uIGV2ZXJ5IG1lbW8gcmVjb21wdXRhdGlvbi5cbiAgICAgICAgLy8gU2FtZSBjbGFzcyBvZiBidWcgZml4ZWQgaW4gbm9ybWFsaXplTWVzc2FnZXMgKGNvbW1pdCAzODMzMjZlNjEzKTpcbiAgICAgICAgLy8gZnJlc2ggcmFuZG9tVVVJRCDihpIgdW5zdGFibGUgUmVhY3Qga2V5cyDihpIgY29tcG9uZW50IHJlbW91bnRzIOKGklxuICAgICAgICAvLyBJbmsgcmVuZGVyaW5nIGNvcnJ1cHRpb24gKG92ZXJsYXBwaW5nIHRleHQgZnJvbSBzdGFsZSBET00gbm9kZXMpLlxuICAgICAgICBtc2cudXVpZCA9IGRlcml2ZVVVSUQoc3RyZWFtaW5nVG9vbFVzZS5jb250ZW50QmxvY2suaWQgYXMgVVVJRCwgMClcbiAgICAgICAgcmV0dXJuIG5vcm1hbGl6ZU1lc3NhZ2VzKFttc2ddKVxuICAgICAgfSksXG4gICAgW3N0cmVhbWluZ1Rvb2xVc2VzV2l0aG91dEluUHJvZ3Jlc3NdLFxuICApXG5cbiAgY29uc3QgaXNUcmFuc2NyaXB0TW9kZSA9IHNjcmVlbiA9PT0gJ3RyYW5zY3JpcHQnXG4gIC8vIEhvaXN0ZWQgdG8gbW91bnQtdGltZSDigJQgdGhpcyBjb21wb25lbnQgcmUtcmVuZGVycyBvbiBldmVyeSBzY3JvbGwuXG4gIGNvbnN0IGRpc2FibGVWaXJ0dWFsU2Nyb2xsID0gdXNlTWVtbyhcbiAgICAoKSA9PiBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9ESVNBQkxFX1ZJUlRVQUxfU0NST0xMKSxcbiAgICBbXSxcbiAgKVxuICAvLyBWaXJ0dWFsIHNjcm9sbCByZXBsYWNlcyB0aGUgdHJhbnNjcmlwdCBjYXA6IGV2ZXJ5dGhpbmcgaXMgc2Nyb2xsYWJsZSBhbmRcbiAgLy8gbWVtb3J5IGlzIGJvdW5kZWQgYnkgdGhlIG1vdW50ZWQtaXRlbSBjb3VudCwgbm90IHRoZSB0b3RhbC4gc2Nyb2xsUmVmIGlzXG4gIC8vIG9ubHkgcGFzc2VkIHdoZW4gaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpIGlzIHRydWUgKFJFUEwudHN4IGdhdGVzIGl0KSxcbiAgLy8gc28gc2Nyb2xsUmVmJ3MgcHJlc2VuY2UgaXMgdGhlIHNpZ25hbC5cbiAgY29uc3QgdmlydHVhbFNjcm9sbFJ1bnRpbWVHYXRlID0gc2Nyb2xsUmVmICE9IG51bGwgJiYgIWRpc2FibGVWaXJ0dWFsU2Nyb2xsXG4gIGNvbnN0IHNob3VsZFRydW5jYXRlID1cbiAgICBpc1RyYW5zY3JpcHRNb2RlICYmICFzaG93QWxsSW5UcmFuc2NyaXB0ICYmICF2aXJ0dWFsU2Nyb2xsUnVudGltZUdhdGVcblxuICAvLyBBbmNob3IgZm9yIHRoZSBmaXJzdCByZW5kZXJlZCBtZXNzYWdlIGluIHRoZSBub24tdmlydHVhbGl6ZWQgY2FwIHNsaWNlLlxuICAvLyBNb25vdG9uaWMgYWR2YW5jZSBvbmx5IOKAlCBtdXRhdGlvbiBkdXJpbmcgcmVuZGVyIGlzIGlkZW1wb3RlbnQgKHNhZmVcbiAgLy8gdW5kZXIgU3RyaWN0TW9kZSBkb3VibGUtcmVuZGVyKS4gU2VlIE1BWF9NRVNTQUdFU19XSVRIT1VUX1ZJUlRVQUxJWkFUSU9OXG4gIC8vIGNvbW1lbnQgYWJvdmUgZm9yIHdoeSB0aGlzIHJlcGxhY2VkIGNvdW50LWJhc2VkIHNsaWNpbmcuXG4gIGNvbnN0IHNsaWNlQW5jaG9yUmVmID0gdXNlUmVmPFNsaWNlQW5jaG9yPihudWxsKVxuXG4gIC8vIEV4cGVuc2l2ZSBtZXNzYWdlIHRyYW5zZm9ybXMg4oCUIGZpbHRlciwgcmVvcmRlciwgZ3JvdXAsIGNvbGxhcHNlLCBsb29rdXBzLlxuICAvLyBBbGwgTyhuKSBvdmVyIDI3ayBtZXNzYWdlcy4gU3BsaXQgZnJvbSB0aGUgcmVuZGVyUmFuZ2Ugc2xpY2Ugc28gc2Nyb2xsaW5nXG4gIC8vICh3aGljaCBvbmx5IGNoYW5nZXMgcmVuZGVyUmFuZ2UpIGRvZXNuJ3QgcmUtcnVuIHRoZXNlLiBQcmV2aW91c2x5IHRoaXNcbiAgLy8gdXNlTWVtbyBpbmNsdWRlZCByZW5kZXJSYW5nZSDihpIgZXZlcnkgc2Nyb2xsIHJlYnVpbHQgNiBNYXBzIG92ZXIgMjdrXG4gIC8vIG1lc3NhZ2VzICsgNCBmaWx0ZXIvbWFwIHBhc3NlcyA9IH41MG1zIGFsbG9jIHBlciBzY3JvbGwg4oaSIEdDIHByZXNzdXJlIOKGklxuICAvLyAxMDAtMTczbXMgc3RvcC10aGUtd29ybGQgcGF1c2VzIG9uIHRoZSAxR0IgaGVhcC5cbiAgY29uc3QgeyBjb2xsYXBzZWQsIGxvb2t1cHMsIGhhc1RydW5jYXRlZE1lc3NhZ2VzLCBoaWRkZW5NZXNzYWdlQ291bnQgfSA9XG4gICAgdXNlTWVtbygoKSA9PiB7XG4gICAgICAvLyBJbiBmdWxsc2NyZWVuIG1vZGUgdGhlIGFsdCBidWZmZXIgaGFzIG5vIG5hdGl2ZSBzY3JvbGxiYWNrLCBzbyB0aGVcbiAgICAgIC8vIGNvbXBhY3QtYm91bmRhcnkgZmlsdGVyIGp1c3QgaGlkZXMgaGlzdG9yeSB0aGUgU2Nyb2xsQm94IGNvdWxkXG4gICAgICAvLyBvdGhlcndpc2Ugc2Nyb2xsIHRvLiBNYWluLXNjcmVlbiBtb2RlIGtlZXBzIHRoZSBmaWx0ZXIg4oCUIHByZS1jb21wYWN0XG4gICAgICAvLyByb3dzIGxpdmUgYWJvdmUgdGhlIHZpZXdwb3J0IGluIG5hdGl2ZSBzY3JvbGxiYWNrIHRoZXJlLCBhbmRcbiAgICAgIC8vIHJlLXJlbmRlcmluZyB0aGVtIHRyaWdnZXJzIGZ1bGwgcmVzZXRzLlxuICAgICAgLy8gaW5jbHVkZVNuaXBwZWQ6IFVJIHJlbmRlcmluZyBrZWVwcyBzbmlwcGVkIG1lc3NhZ2VzIGZvciBzY3JvbGxiYWNrXG4gICAgICAvLyAodGhpcyBQUidzIGNvcmUgZ29hbCDigJQgZnVsbCBoaXN0b3J5IGluIFVJLCBmaWx0ZXIgb25seSBmb3IgdGhlIG1vZGVsKS5cbiAgICAgIC8vIEFsc28gYXZvaWRzIGEgVVVJRCBtaXNtYXRjaDogbm9ybWFsaXplTWVzc2FnZXMgZGVyaXZlcyBuZXcgVVVJRHMsIHNvXG4gICAgICAvLyBwcm9qZWN0U25pcHBlZFZpZXcncyBjaGVjayBhZ2FpbnN0IG9yaWdpbmFsIHJlbW92ZWRVdWlkcyB3b3VsZCBmYWlsLlxuICAgICAgY29uc3QgY29tcGFjdEF3YXJlTWVzc2FnZXMgPVxuICAgICAgICB2ZXJib3NlIHx8IGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKVxuICAgICAgICAgID8gbm9ybWFsaXplZE1lc3NhZ2VzXG4gICAgICAgICAgOiBnZXRNZXNzYWdlc0FmdGVyQ29tcGFjdEJvdW5kYXJ5KG5vcm1hbGl6ZWRNZXNzYWdlcywge1xuICAgICAgICAgICAgICBpbmNsdWRlU25pcHBlZDogdHJ1ZSxcbiAgICAgICAgICAgIH0pXG5cbiAgICAgIGNvbnN0IG1lc3NhZ2VzVG9TaG93Tm90VHJ1bmNhdGVkID0gcmVvcmRlck1lc3NhZ2VzSW5VSShcbiAgICAgICAgY29tcGFjdEF3YXJlTWVzc2FnZXNcbiAgICAgICAgICAuZmlsdGVyKFxuICAgICAgICAgICAgKG1zZyk6IG1zZyBpcyBFeGNsdWRlPE5vcm1hbGl6ZWRNZXNzYWdlLCBQcm9ncmVzc01lc3NhZ2VUeXBlPiA9PlxuICAgICAgICAgICAgICBtc2cudHlwZSAhPT0gJ3Byb2dyZXNzJyxcbiAgICAgICAgICApXG4gICAgICAgICAgLy8gQ0MtNzI0OiBkcm9wIGF0dGFjaG1lbnQgbWVzc2FnZXMgdGhhdCBBdHRhY2htZW50TWVzc2FnZSByZW5kZXJzIGFzXG4gICAgICAgICAgLy8gbnVsbCAoaG9va19zdWNjZXNzLCBob29rX2FkZGl0aW9uYWxfY29udGV4dCwgaG9va19jYW5jZWxsZWQsIGV0Yy4pXG4gICAgICAgICAgLy8gQkVGT1JFIGNvdW50aW5nL3NsaWNpbmcgc28gdGhleSBkb24ndCBpbmZsYXRlIHRoZSBcIk4gbWVzc2FnZXNcIlxuICAgICAgICAgIC8vIGNvdW50IGluIGN0cmwtbyBvciBjb25zdW1lIHNsb3RzIGluIHRoZSAyMDAtbWVzc2FnZSByZW5kZXIgY2FwLlxuICAgICAgICAgIC5maWx0ZXIobXNnID0+ICFpc051bGxSZW5kZXJpbmdBdHRhY2htZW50KG1zZykpXG4gICAgICAgICAgLmZpbHRlcihfID0+IHNob3VsZFNob3dVc2VyTWVzc2FnZShfLCBpc1RyYW5zY3JpcHRNb2RlKSksXG4gICAgICAgIHN5bnRoZXRpY1N0cmVhbWluZ1Rvb2xVc2VNZXNzYWdlcyxcbiAgICAgIClcbiAgICAgIC8vIFRocmVlLXRpZXIgZmlsdGVyaW5nLiBUcmFuc2NyaXB0IG1vZGUgKGN0cmwrbyBzY3JlZW4pIGlzIHRydWx5IHVuZmlsdGVyZWQuXG4gICAgICAvLyBCcmllZi1vbmx5OiBTZW5kVXNlck1lc3NhZ2UgKyB1c2VyIGlucHV0IG9ubHkuIERlZmF1bHQ6IGRyb3AgcmVkdW5kYW50XG4gICAgICAvLyBhc3Npc3RhbnQgdGV4dCBpbiB0dXJucyB3aGVyZSBTZW5kVXNlck1lc3NhZ2Ugd2FzIGNhbGxlZCAodGhlIG1vZGVsJ3NcbiAgICAgIC8vIHRleHQgaXMgd29ya2luZy1ub3RlcyB0aGF0IGR1cGxpY2F0ZSB0aGUgU2VuZFVzZXJNZXNzYWdlIGNvbnRlbnQpLlxuICAgICAgY29uc3QgYnJpZWZUb29sTmFtZXMgPSBbQlJJRUZfVE9PTF9OQU1FLCBTRU5EX1VTRVJfRklMRV9UT09MX05BTUVdLmZpbHRlcihcbiAgICAgICAgKG4pOiBuIGlzIHN0cmluZyA9PiBuICE9PSBudWxsLFxuICAgICAgKVxuICAgICAgLy8gZHJvcFRleHRJbkJyaWVmVHVybnMgc2hvdWxkIG9ubHkgdHJpZ2dlciBvbiBTZW5kVXNlck1lc3NhZ2UgdHVybnMg4oCUXG4gICAgICAvLyBTZW5kVXNlckZpbGUgZGVsaXZlcnMgYSBmaWxlIHdpdGhvdXQgcmVwbGFjZW1lbnQgdGV4dCwgc28gZHJvcHBpbmdcbiAgICAgIC8vIGFzc2lzdGFudCB0ZXh0IGZvciBmaWxlLW9ubHkgdHVybnMgd291bGQgbGVhdmUgdGhlIHVzZXIgd2l0aCBubyBjb250ZXh0LlxuICAgICAgY29uc3QgZHJvcFRleHRUb29sTmFtZXMgPSBbQlJJRUZfVE9PTF9OQU1FXS5maWx0ZXIoXG4gICAgICAgIChuKTogbiBpcyBzdHJpbmcgPT4gbiAhPT0gbnVsbCxcbiAgICAgIClcbiAgICAgIGNvbnN0IGJyaWVmRmlsdGVyZWQgPVxuICAgICAgICBicmllZlRvb2xOYW1lcy5sZW5ndGggPiAwICYmICFpc1RyYW5zY3JpcHRNb2RlXG4gICAgICAgICAgPyBpc0JyaWVmT25seVxuICAgICAgICAgICAgPyBmaWx0ZXJGb3JCcmllZlRvb2wobWVzc2FnZXNUb1Nob3dOb3RUcnVuY2F0ZWQsIGJyaWVmVG9vbE5hbWVzKVxuICAgICAgICAgICAgOiBkcm9wVGV4dFRvb2xOYW1lcy5sZW5ndGggPiAwXG4gICAgICAgICAgICAgID8gZHJvcFRleHRJbkJyaWVmVHVybnMoXG4gICAgICAgICAgICAgICAgICBtZXNzYWdlc1RvU2hvd05vdFRydW5jYXRlZCxcbiAgICAgICAgICAgICAgICAgIGRyb3BUZXh0VG9vbE5hbWVzLFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgOiBtZXNzYWdlc1RvU2hvd05vdFRydW5jYXRlZFxuICAgICAgICAgIDogbWVzc2FnZXNUb1Nob3dOb3RUcnVuY2F0ZWRcblxuICAgICAgY29uc3QgbWVzc2FnZXNUb1Nob3cgPSBzaG91bGRUcnVuY2F0ZVxuICAgICAgICA/IGJyaWVmRmlsdGVyZWQuc2xpY2UoLU1BWF9NRVNTQUdFU19UT19TSE9XX0lOX1RSQU5TQ1JJUFRfTU9ERSlcbiAgICAgICAgOiBicmllZkZpbHRlcmVkXG5cbiAgICAgIGNvbnN0IGhhc1RydW5jYXRlZE1lc3NhZ2VzID1cbiAgICAgICAgc2hvdWxkVHJ1bmNhdGUgJiZcbiAgICAgICAgYnJpZWZGaWx0ZXJlZC5sZW5ndGggPiBNQVhfTUVTU0FHRVNfVE9fU0hPV19JTl9UUkFOU0NSSVBUX01PREVcblxuICAgICAgY29uc3QgeyBtZXNzYWdlczogZ3JvdXBlZE1lc3NhZ2VzIH0gPSBhcHBseUdyb3VwaW5nKFxuICAgICAgICBtZXNzYWdlc1RvU2hvdyxcbiAgICAgICAgdG9vbHMsXG4gICAgICAgIHZlcmJvc2UsXG4gICAgICApXG5cbiAgICAgIGNvbnN0IGNvbGxhcHNlZCA9IGNvbGxhcHNlQmFja2dyb3VuZEJhc2hOb3RpZmljYXRpb25zKFxuICAgICAgICBjb2xsYXBzZUhvb2tTdW1tYXJpZXMoXG4gICAgICAgICAgY29sbGFwc2VUZWFtbWF0ZVNodXRkb3ducyhcbiAgICAgICAgICAgIGNvbGxhcHNlUmVhZFNlYXJjaEdyb3Vwcyhncm91cGVkTWVzc2FnZXMsIHRvb2xzKSxcbiAgICAgICAgICApLFxuICAgICAgICApLFxuICAgICAgICB2ZXJib3NlLFxuICAgICAgKVxuXG4gICAgICBjb25zdCBsb29rdXBzID0gYnVpbGRNZXNzYWdlTG9va3Vwcyhub3JtYWxpemVkTWVzc2FnZXMsIG1lc3NhZ2VzVG9TaG93KVxuXG4gICAgICBjb25zdCBoaWRkZW5NZXNzYWdlQ291bnQgPVxuICAgICAgICBtZXNzYWdlc1RvU2hvd05vdFRydW5jYXRlZC5sZW5ndGggLVxuICAgICAgICBNQVhfTUVTU0FHRVNfVE9fU0hPV19JTl9UUkFOU0NSSVBUX01PREVcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29sbGFwc2VkLFxuICAgICAgICBsb29rdXBzLFxuICAgICAgICBoYXNUcnVuY2F0ZWRNZXNzYWdlcyxcbiAgICAgICAgaGlkZGVuTWVzc2FnZUNvdW50LFxuICAgICAgfVxuICAgIH0sIFtcbiAgICAgIHZlcmJvc2UsXG4gICAgICBub3JtYWxpemVkTWVzc2FnZXMsXG4gICAgICBpc1RyYW5zY3JpcHRNb2RlLFxuICAgICAgc3ludGhldGljU3RyZWFtaW5nVG9vbFVzZU1lc3NhZ2VzLFxuICAgICAgc2hvdWxkVHJ1bmNhdGUsXG4gICAgICB0b29scyxcbiAgICAgIGlzQnJpZWZPbmx5LFxuICAgIF0pXG5cbiAgLy8gQ2hlYXAgc2xpY2Ug4oCUIG9ubHkgcnVucyB3aGVuIHNjcm9sbCByYW5nZSBvciBzbGljZSBjb25maWcgY2hhbmdlcy5cbiAgY29uc3QgcmVuZGVyYWJsZU1lc3NhZ2VzID0gdXNlTWVtbygoKSA9PiB7XG4gICAgLy8gU2FmZXR5IGNhcCBmb3IgdGhlIG5vbi12aXJ0dWFsaXplZCByZW5kZXIgcGF0aC4gQXBwbGllZCBoZXJlIChub3QgYXRcbiAgICAvLyB0aGUgSlNYIHNpdGUpIHNvIHJlbmRlck1lc3NhZ2VSb3cncyBpbmRleC1iYXNlZCBsb29rdXBzIGFuZFxuICAgIC8vIGRpdmlkZXJCZWZvcmVJbmRleCBjb21wdXRlIG9uIHRoZSBzYW1lIGFycmF5LiBWaXJ0dWFsTWVzc2FnZUxpc3RcbiAgICAvLyBuZXZlciBzZWVzIHRoaXMgc2xpY2Ug4oCUIHZpcnR1YWxTY3JvbGxSdW50aW1lR2F0ZSBpcyBjb25zdGFudCBmb3IgdGhlXG4gICAgLy8gY29tcG9uZW50J3MgbGlmZXRpbWUgKHNjcm9sbFJlZiBpcyBlaXRoZXIgYWx3YXlzIHBhc3NlZCBvciBuZXZlcikuXG4gICAgLy8gcmVuZGVyUmFuZ2UgaXMgZmlyc3Q6IHRoZSBjaHVua2VkIGV4cG9ydCBwYXRoIHNsaWNlcyB0aGVcbiAgICAvLyBwb3N0LWdyb3VwaW5nIGFycmF5IHNvIGVhY2ggY2h1bmsgZ2V0cyBjb3JyZWN0IHRvb2wtY2FsbCBncm91cGluZy5cbiAgICBjb25zdCBjYXBBcHBsaWVzID0gIXZpcnR1YWxTY3JvbGxSdW50aW1lR2F0ZSAmJiAhZGlzYWJsZVJlbmRlckNhcFxuICAgIGNvbnN0IHNsaWNlU3RhcnQgPSBjYXBBcHBsaWVzXG4gICAgICA/IGNvbXB1dGVTbGljZVN0YXJ0KGNvbGxhcHNlZCwgc2xpY2VBbmNob3JSZWYpXG4gICAgICA6IDBcbiAgICByZXR1cm4gcmVuZGVyUmFuZ2VcbiAgICAgID8gY29sbGFwc2VkLnNsaWNlKHJlbmRlclJhbmdlWzBdLCByZW5kZXJSYW5nZVsxXSlcbiAgICAgIDogc2xpY2VTdGFydCA+IDBcbiAgICAgICAgPyBjb2xsYXBzZWQuc2xpY2Uoc2xpY2VTdGFydClcbiAgICAgICAgOiBjb2xsYXBzZWRcbiAgfSwgW2NvbGxhcHNlZCwgcmVuZGVyUmFuZ2UsIHZpcnR1YWxTY3JvbGxSdW50aW1lR2F0ZSwgZGlzYWJsZVJlbmRlckNhcF0pXG5cbiAgY29uc3Qgc3RyZWFtaW5nVG9vbFVzZUlEcyA9IHVzZU1lbW8oXG4gICAgKCkgPT4gbmV3IFNldChzdHJlYW1pbmdUb29sVXNlcy5tYXAoXyA9PiBfLmNvbnRlbnRCbG9jay5pZCkpLFxuICAgIFtzdHJlYW1pbmdUb29sVXNlc10sXG4gIClcblxuICAvLyBEaXZpZGVyIGluc2VydGlvbiBwb2ludDogZmlyc3QgcmVuZGVyYWJsZU1lc3NhZ2Ugd2hvc2UgdXVpZCBzaGFyZXMgdGhlXG4gIC8vIDI0LWNoYXIgcHJlZml4IHdpdGggZmlyc3RVbnNlZW5VdWlkIChkZXJpdmVVVUlEIGtlZXBzIHRoZSBmaXJzdCAyNFxuICAvLyBjaGFycyBvZiB0aGUgc291cmNlIG1lc3NhZ2UgdXVpZCwgc28gdGhpcyBtYXRjaGVzIGFueSBibG9jayBmcm9tIGl0KS5cbiAgY29uc3QgZGl2aWRlckJlZm9yZUluZGV4ID0gdXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCF1bnNlZW5EaXZpZGVyKSByZXR1cm4gLTFcbiAgICBjb25zdCBwcmVmaXggPSB1bnNlZW5EaXZpZGVyLmZpcnN0VW5zZWVuVXVpZC5zbGljZSgwLCAyNClcbiAgICByZXR1cm4gcmVuZGVyYWJsZU1lc3NhZ2VzLmZpbmRJbmRleChtID0+IG0udXVpZC5zbGljZSgwLCAyNCkgPT09IHByZWZpeClcbiAgfSwgW3Vuc2VlbkRpdmlkZXIsIHJlbmRlcmFibGVNZXNzYWdlc10pXG5cbiAgY29uc3Qgc2VsZWN0ZWRJZHggPSB1c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoIWN1cnNvcikgcmV0dXJuIC0xXG4gICAgcmV0dXJuIHJlbmRlcmFibGVNZXNzYWdlcy5maW5kSW5kZXgobSA9PiBtLnV1aWQgPT09IGN1cnNvci51dWlkKVxuICB9LCBbY3Vyc29yLCByZW5kZXJhYmxlTWVzc2FnZXNdKVxuXG4gIC8vIEZ1bGxzY3JlZW46IGNsaWNrIGEgbWVzc2FnZSB0byB0b2dnbGUgdmVyYm9zZSByZW5kZXJpbmcgZm9yIGl0LiBLZXllZCBieVxuICAvLyB0b29sX3VzZV9pZCB3aGVyZSBhdmFpbGFibGUgc28gYSB0b29sX3VzZSBhbmQgaXRzIHRvb2xfcmVzdWx0IChzZXBhcmF0ZVxuICAvLyByb3dzKSBleHBhbmQgdG9nZXRoZXI7IGZhbGxzIGJhY2sgdG8gdXVpZCBmb3IgZ3JvdXBzL3RoaW5raW5nLiBTdGFsZSBrZXlzXG4gIC8vIGFyZSBoYXJtbGVzcyDigJQgdGhleSBuZXZlciBtYXRjaCBhbnl0aGluZyBpbiByZW5kZXJhYmxlTWVzc2FnZXMuXG4gIGNvbnN0IFtleHBhbmRlZEtleXMsIHNldEV4cGFuZGVkS2V5c10gPSB1c2VTdGF0ZTxSZWFkb25seVNldDxzdHJpbmc+PihcbiAgICAoKSA9PiBuZXcgU2V0KCksXG4gIClcbiAgY29uc3Qgb25JdGVtQ2xpY2sgPSB1c2VDYWxsYmFjaygobXNnOiBSZW5kZXJhYmxlTWVzc2FnZSkgPT4ge1xuICAgIGNvbnN0IGsgPSBleHBhbmRLZXkobXNnKVxuICAgIHNldEV4cGFuZGVkS2V5cyhwcmV2ID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHByZXYpXG4gICAgICBpZiAobmV4dC5oYXMoaykpIG5leHQuZGVsZXRlKGspXG4gICAgICBlbHNlIG5leHQuYWRkKGspXG4gICAgICByZXR1cm4gbmV4dFxuICAgIH0pXG4gIH0sIFtdKVxuICBjb25zdCBpc0l0ZW1FeHBhbmRlZCA9IHVzZUNhbGxiYWNrKFxuICAgIChtc2c6IFJlbmRlcmFibGVNZXNzYWdlKSA9PlxuICAgICAgZXhwYW5kZWRLZXlzLnNpemUgPiAwICYmIGV4cGFuZGVkS2V5cy5oYXMoZXhwYW5kS2V5KG1zZykpLFxuICAgIFtleHBhbmRlZEtleXNdLFxuICApXG4gIC8vIE9ubHkgaG92ZXIvY2xpY2sgbWVzc2FnZXMgd2hlcmUgdGhlIHZlcmJvc2UgdG9nZ2xlIHJldmVhbHMgbW9yZTpcbiAgLy8gY29sbGFwc2VkIHJlYWQvc2VhcmNoIGdyb3Vwcywgb3IgdG9vbCByZXN1bHRzIHRoYXQgc2VsZi1yZXBvcnQgdHJ1bmNhdGlvblxuICAvLyB2aWEgaXNSZXN1bHRUcnVuY2F0ZWQuIENhbGxiYWNrIG11c3QgYmUgc3RhYmxlIGFjcm9zcyBtZXNzYWdlIHVwZGF0ZXM6IGlmXG4gIC8vIGl0cyBpZGVudGl0eSAob3IgcmV0dXJuIHZhbHVlKSBmbGlwcyBkdXJpbmcgc3RyZWFtaW5nLCBvbk1vdXNlRW50ZXJcbiAgLy8gYXR0YWNoZXMgYWZ0ZXIgdGhlIG1vdXNlIGlzIGFscmVhZHkgaW5zaWRlIOKGkiBob3ZlciBuZXZlciBmaXJlcy4gdG9vbHMgaXNcbiAgLy8gc2Vzc2lvbi1zdGFibGU7IGxvb2t1cHMgaXMgcmVhZCB2aWEgcmVmIHNvIHRoZSBjYWxsYmFjayBkb2Vzbid0IGNodXJuIG9uXG4gIC8vIGV2ZXJ5IG5ldyBtZXNzYWdlLlxuICBjb25zdCBsb29rdXBzUmVmID0gdXNlUmVmKGxvb2t1cHMpXG4gIGxvb2t1cHNSZWYuY3VycmVudCA9IGxvb2t1cHNcbiAgY29uc3QgaXNJdGVtQ2xpY2thYmxlID0gdXNlQ2FsbGJhY2soXG4gICAgKG1zZzogUmVuZGVyYWJsZU1lc3NhZ2UpOiBib29sZWFuID0+IHtcbiAgICAgIGlmIChtc2cudHlwZSA9PT0gJ2NvbGxhcHNlZF9yZWFkX3NlYXJjaCcpIHJldHVybiB0cnVlXG4gICAgICBpZiAobXNnLnR5cGUgPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgICAgIGNvbnN0IGIgPSBtc2cubWVzc2FnZS5jb250ZW50WzBdIGFzIHVua25vd24gYXMgQWR2aXNvckJsb2NrIHwgdW5kZWZpbmVkXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgYiAhPSBudWxsICYmXG4gICAgICAgICAgaXNBZHZpc29yQmxvY2soYikgJiZcbiAgICAgICAgICBiLnR5cGUgPT09ICdhZHZpc29yX3Rvb2xfcmVzdWx0JyAmJlxuICAgICAgICAgIGIuY29udGVudC50eXBlID09PSAnYWR2aXNvcl9yZXN1bHQnXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGlmIChtc2cudHlwZSAhPT0gJ3VzZXInKSByZXR1cm4gZmFsc2VcbiAgICAgIGNvbnN0IGIgPSBtc2cubWVzc2FnZS5jb250ZW50WzBdXG4gICAgICBpZiAoYj8udHlwZSAhPT0gJ3Rvb2xfcmVzdWx0JyB8fCBiLmlzX2Vycm9yIHx8ICFtc2cudG9vbFVzZVJlc3VsdClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBjb25zdCBuYW1lID0gbG9va3Vwc1JlZi5jdXJyZW50LnRvb2xVc2VCeVRvb2xVc2VJRC5nZXQoXG4gICAgICAgIGIudG9vbF91c2VfaWQsXG4gICAgICApPy5uYW1lXG4gICAgICBjb25zdCB0b29sID0gbmFtZSA/IGZpbmRUb29sQnlOYW1lKHRvb2xzLCBuYW1lKSA6IHVuZGVmaW5lZFxuICAgICAgcmV0dXJuIHRvb2w/LmlzUmVzdWx0VHJ1bmNhdGVkPy4obXNnLnRvb2xVc2VSZXN1bHQgYXMgbmV2ZXIpID8/IGZhbHNlXG4gICAgfSxcbiAgICBbdG9vbHNdLFxuICApXG5cbiAgY29uc3QgY2FuQW5pbWF0ZSA9XG4gICAgKCF0b29sSlNYIHx8ICEhdG9vbEpTWC5zaG91bGRDb250aW51ZUFuaW1hdGlvbikgJiZcbiAgICAhdG9vbFVzZUNvbmZpcm1RdWV1ZS5sZW5ndGggJiZcbiAgICAhaXNNZXNzYWdlU2VsZWN0b3JWaXNpYmxlXG5cbiAgY29uc3QgaGFzVG9vbHNJblByb2dyZXNzID0gaW5Qcm9ncmVzc1Rvb2xVc2VJRHMuc2l6ZSA+IDBcblxuICAvLyBSZXBvcnQgcHJvZ3Jlc3MgdG8gdGVybWluYWwgKGZvciB0ZXJtaW5hbHMgdGhhdCBzdXBwb3J0IE9TQyA5OzQpXG4gIGNvbnN0IHsgcHJvZ3Jlc3MgfSA9IHVzZVRlcm1pbmFsTm90aWZpY2F0aW9uKClcbiAgY29uc3QgcHJldlByb2dyZXNzU3RhdGUgPSB1c2VSZWY8c3RyaW5nIHwgbnVsbD4obnVsbClcbiAgY29uc3QgcHJvZ3Jlc3NFbmFibGVkID1cbiAgICBnZXRHbG9iYWxDb25maWcoKS50ZXJtaW5hbFByb2dyZXNzQmFyRW5hYmxlZCAmJlxuICAgICFnZXRJc1JlbW90ZU1vZGUoKSAmJlxuICAgICEocHJvYWN0aXZlTW9kdWxlPy5pc1Byb2FjdGl2ZUFjdGl2ZSgpID8/IGZhbHNlKVxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IHN0YXRlID0gcHJvZ3Jlc3NFbmFibGVkXG4gICAgICA/IGhhc1Rvb2xzSW5Qcm9ncmVzc1xuICAgICAgICA/ICdpbmRldGVybWluYXRlJ1xuICAgICAgICA6ICdjb21wbGV0ZWQnXG4gICAgICA6IG51bGxcbiAgICBpZiAocHJldlByb2dyZXNzU3RhdGUuY3VycmVudCA9PT0gc3RhdGUpIHJldHVyblxuICAgIHByZXZQcm9ncmVzc1N0YXRlLmN1cnJlbnQgPSBzdGF0ZVxuICAgIHByb2dyZXNzKHN0YXRlKVxuICB9LCBbcHJvZ3Jlc3MsIHByb2dyZXNzRW5hYmxlZCwgaGFzVG9vbHNJblByb2dyZXNzXSlcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICByZXR1cm4gKCkgPT4gcHJvZ3Jlc3MobnVsbClcbiAgfSwgW3Byb2dyZXNzXSlcblxuICBjb25zdCBtZXNzYWdlS2V5ID0gdXNlQ2FsbGJhY2soXG4gICAgKG1zZzogUmVuZGVyYWJsZU1lc3NhZ2UpID0+IGAke21zZy51dWlkfS0ke2NvbnZlcnNhdGlvbklkfWAsXG4gICAgW2NvbnZlcnNhdGlvbklkXSxcbiAgKVxuXG4gIGNvbnN0IHJlbmRlck1lc3NhZ2VSb3cgPSAobXNnOiBSZW5kZXJhYmxlTWVzc2FnZSwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHByZXZUeXBlID0gaW5kZXggPiAwID8gcmVuZGVyYWJsZU1lc3NhZ2VzW2luZGV4IC0gMV0/LnR5cGUgOiB1bmRlZmluZWRcbiAgICBjb25zdCBpc1VzZXJDb250aW51YXRpb24gPSBtc2cudHlwZSA9PT0gJ3VzZXInICYmIHByZXZUeXBlID09PSAndXNlcidcbiAgICAvLyBoYXNDb250ZW50QWZ0ZXIgaXMgb25seSBjb25zdW1lZCBmb3IgY29sbGFwc2VkX3JlYWRfc2VhcmNoIGdyb3VwcztcbiAgICAvLyBza2lwIHRoZSBzY2FuIGZvciBldmVyeXRoaW5nIGVsc2UuIHN0cmVhbWluZ1RleHQgaXMgcmVuZGVyZWQgYXMgYVxuICAgIC8vIHNpYmxpbmcgYWZ0ZXIgdGhpcyBtYXAsIHNvIGl0J3MgbmV2ZXIgaW4gcmVuZGVyYWJsZU1lc3NhZ2VzIOKAlCBPUiBpdFxuICAgIC8vIGluIGV4cGxpY2l0bHkgc28gdGhlIGdyb3VwIGZsaXBzIHRvIHBhc3QgdGVuc2UgYXMgc29vbiBhcyB0ZXh0IHN0YXJ0c1xuICAgIC8vIHN0cmVhbWluZyBpbnN0ZWFkIG9mIHdhaXRpbmcgZm9yIHRoZSBibG9jayB0byBmaW5hbGl6ZS5cbiAgICBjb25zdCBoYXNDb250ZW50QWZ0ZXIgPVxuICAgICAgbXNnLnR5cGUgPT09ICdjb2xsYXBzZWRfcmVhZF9zZWFyY2gnICYmXG4gICAgICAoISFzdHJlYW1pbmdUZXh0IHx8XG4gICAgICAgIGhhc0NvbnRlbnRBZnRlckluZGV4KFxuICAgICAgICAgIHJlbmRlcmFibGVNZXNzYWdlcyxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICB0b29scyxcbiAgICAgICAgICBzdHJlYW1pbmdUb29sVXNlSURzLFxuICAgICAgICApKVxuXG4gICAgY29uc3QgayA9IG1lc3NhZ2VLZXkobXNnKVxuICAgIGNvbnN0IHJvdyA9IChcbiAgICAgIDxNZXNzYWdlUm93XG4gICAgICAgIGtleT17a31cbiAgICAgICAgbWVzc2FnZT17bXNnfVxuICAgICAgICBpc1VzZXJDb250aW51YXRpb249e2lzVXNlckNvbnRpbnVhdGlvbn1cbiAgICAgICAgaGFzQ29udGVudEFmdGVyPXtoYXNDb250ZW50QWZ0ZXJ9XG4gICAgICAgIHRvb2xzPXt0b29sc31cbiAgICAgICAgY29tbWFuZHM9e2NvbW1hbmRzfVxuICAgICAgICB2ZXJib3NlPXtcbiAgICAgICAgICB2ZXJib3NlIHx8XG4gICAgICAgICAgaXNJdGVtRXhwYW5kZWQobXNnKSB8fFxuICAgICAgICAgIChjdXJzb3I/LmV4cGFuZGVkID09PSB0cnVlICYmIGluZGV4ID09PSBzZWxlY3RlZElkeClcbiAgICAgICAgfVxuICAgICAgICBpblByb2dyZXNzVG9vbFVzZUlEcz17aW5Qcm9ncmVzc1Rvb2xVc2VJRHN9XG4gICAgICAgIHN0cmVhbWluZ1Rvb2xVc2VJRHM9e3N0cmVhbWluZ1Rvb2xVc2VJRHN9XG4gICAgICAgIHNjcmVlbj17c2NyZWVufVxuICAgICAgICBjYW5BbmltYXRlPXtjYW5BbmltYXRlfVxuICAgICAgICBvbk9wZW5SYXRlTGltaXRPcHRpb25zPXtvbk9wZW5SYXRlTGltaXRPcHRpb25zfVxuICAgICAgICBsYXN0VGhpbmtpbmdCbG9ja0lkPXtsYXN0VGhpbmtpbmdCbG9ja0lkfVxuICAgICAgICBsYXRlc3RCYXNoT3V0cHV0VVVJRD17bGF0ZXN0QmFzaE91dHB1dFVVSUR9XG4gICAgICAgIGNvbHVtbnM9e2NvbHVtbnN9XG4gICAgICAgIGlzTG9hZGluZz17aXNMb2FkaW5nfVxuICAgICAgICBsb29rdXBzPXtsb29rdXBzfVxuICAgICAgLz5cbiAgICApXG5cbiAgICAvLyBQZXItcm93IFByb3ZpZGVyIOKAlCBvbmx5IDIgcm93cyByZS1yZW5kZXIgb24gc2VsZWN0aW9uIGNoYW5nZS5cbiAgICAvLyBXcmFwcGVkIEJFRk9SRSBkaXZpZGVyIGJyYW5jaCBzbyBib3RoIHJldHVybiBwYXRocyBnZXQgaXQuXG4gICAgY29uc3Qgd3JhcHBlZCA9IChcbiAgICAgIDxNZXNzYWdlQWN0aW9uc1NlbGVjdGVkQ29udGV4dC5Qcm92aWRlclxuICAgICAgICBrZXk9e2t9XG4gICAgICAgIHZhbHVlPXtpbmRleCA9PT0gc2VsZWN0ZWRJZHh9XG4gICAgICA+XG4gICAgICAgIHtyb3d9XG4gICAgICA8L01lc3NhZ2VBY3Rpb25zU2VsZWN0ZWRDb250ZXh0LlByb3ZpZGVyPlxuICAgIClcblxuICAgIGlmICh1bnNlZW5EaXZpZGVyICYmIGluZGV4ID09PSBkaXZpZGVyQmVmb3JlSW5kZXgpIHtcbiAgICAgIHJldHVybiBbXG4gICAgICAgIDxCb3gga2V5PVwidW5zZWVuLWRpdmlkZXJcIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgIDxEaXZpZGVyXG4gICAgICAgICAgICB0aXRsZT17YCR7dW5zZWVuRGl2aWRlci5jb3VudH0gbmV3ICR7cGx1cmFsKHVuc2VlbkRpdmlkZXIuY291bnQsICdtZXNzYWdlJyl9YH1cbiAgICAgICAgICAgIHdpZHRoPXtjb2x1bW5zfVxuICAgICAgICAgICAgY29sb3I9XCJpbmFjdGl2ZVwiXG4gICAgICAgICAgLz5cbiAgICAgICAgPC9Cb3g+LFxuICAgICAgICB3cmFwcGVkLFxuICAgICAgXVxuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZFxuICB9XG5cbiAgLy8gU2VhcmNoIGluZGV4aW5nOiBmb3IgdG9vbF9yZXN1bHQgbWVzc2FnZXMsIGxvb2sgdXAgdGhlIFRvb2wgYW5kIHVzZVxuICAvLyBpdHMgZXh0cmFjdFNlYXJjaFRleHQg4oCUIHRvb2wtb3duZWQsIHByZWNpc2UsIG1hdGNoZXMgd2hhdFxuICAvLyByZW5kZXJUb29sUmVzdWx0TWVzc2FnZSBzaG93cy4gRmFsbHMgYmFjayB0byByZW5kZXJhYmxlU2VhcmNoVGV4dFxuICAvLyAoZHVjay10eXBlcyB0b29sVXNlUmVzdWx0KSBmb3IgdG9vbHMgdGhhdCBoYXZlbid0IGltcGxlbWVudGVkIGl0LFxuICAvLyBhbmQgZm9yIGFsbCBub24tdG9vbC1yZXN1bHQgbWVzc2FnZSB0eXBlcy4gVGhlIGRyaWZ0LWNhdGNoZXIgdGVzdFxuICAvLyAodG9vbFNlYXJjaFRleHQudGVzdC50c3gpIHJlbmRlcnMgKyBjb21wYXJlcyB0byBrZWVwIHRoZXNlIGluIHN5bmMuXG4gIC8vXG4gIC8vIEEgc2Vjb25kLVJlYWN0LXJvb3QgcmVjb25jaWxlIGFwcHJvYWNoIHdhcyB0cmllZCBhbmQgcnVsZWQgb3V0XG4gIC8vIChtZWFzdXJlZCAzLjFtcy9tc2csIGdyb3dpbmcg4oCUIGZsdXNoU3luY1dvcmsgcHJvY2Vzc2VzIGFsbCByb290cztcbiAgLy8gY29tcG9uZW50IGhvb2tzIG11dGF0ZSBzaGFyZWQgc3RhdGUg4oaSIG1haW4gcm9vdCBhY2N1bXVsYXRlcyB1cGRhdGVzKS5cbiAgY29uc3Qgc2VhcmNoVGV4dENhY2hlID0gdXNlUmVmKG5ldyBXZWFrTWFwPFJlbmRlcmFibGVNZXNzYWdlLCBzdHJpbmc+KCkpXG4gIGNvbnN0IGV4dHJhY3RTZWFyY2hUZXh0ID0gdXNlQ2FsbGJhY2soXG4gICAgKG1zZzogUmVuZGVyYWJsZU1lc3NhZ2UpOiBzdHJpbmcgPT4ge1xuICAgICAgY29uc3QgY2FjaGVkID0gc2VhcmNoVGV4dENhY2hlLmN1cnJlbnQuZ2V0KG1zZylcbiAgICAgIGlmIChjYWNoZWQgIT09IHVuZGVmaW5lZCkgcmV0dXJuIGNhY2hlZFxuICAgICAgbGV0IHRleHQgPSByZW5kZXJhYmxlU2VhcmNoVGV4dChtc2cpXG4gICAgICAvLyBJZiB0aGlzIGlzIGEgdG9vbF9yZXN1bHQgbWVzc2FnZSBhbmQgdGhlIHRvb2wgaW1wbGVtZW50c1xuICAgICAgLy8gZXh0cmFjdFNlYXJjaFRleHQsIHByZWZlciB0aGF0IOKAlCBpdCdzIHByZWNpc2UgKHRvb2wtb3duZWQpXG4gICAgICAvLyB2cyByZW5kZXJhYmxlU2VhcmNoVGV4dCdzIGZpZWxkLW5hbWUgaGV1cmlzdGljLlxuICAgICAgaWYgKFxuICAgICAgICBtc2cudHlwZSA9PT0gJ3VzZXInICYmXG4gICAgICAgIG1zZy50b29sVXNlUmVzdWx0ICYmXG4gICAgICAgIEFycmF5LmlzQXJyYXkobXNnLm1lc3NhZ2UuY29udGVudClcbiAgICAgICkge1xuICAgICAgICBjb25zdCB0ciA9IG1zZy5tZXNzYWdlLmNvbnRlbnQuZmluZChiID0+IGIudHlwZSA9PT0gJ3Rvb2xfcmVzdWx0JylcbiAgICAgICAgaWYgKHRyICYmICd0b29sX3VzZV9pZCcgaW4gdHIpIHtcbiAgICAgICAgICBjb25zdCB0dSA9IGxvb2t1cHMudG9vbFVzZUJ5VG9vbFVzZUlELmdldCh0ci50b29sX3VzZV9pZClcbiAgICAgICAgICBjb25zdCB0b29sID0gdHUgJiYgZmluZFRvb2xCeU5hbWUodG9vbHMsIHR1Lm5hbWUpXG4gICAgICAgICAgY29uc3QgZXh0cmFjdGVkID0gdG9vbD8uZXh0cmFjdFNlYXJjaFRleHQ/LihcbiAgICAgICAgICAgIG1zZy50b29sVXNlUmVzdWx0IGFzIG5ldmVyLFxuICAgICAgICAgIClcbiAgICAgICAgICAvLyB1bmRlZmluZWQgPSB0b29sIGRpZG4ndCBpbXBsZW1lbnQg4oaSIGtlZXAgaGV1cmlzdGljLiBFbXB0eVxuICAgICAgICAgIC8vIHN0cmluZyA9IHRvb2wgc2F5cyBcIm5vdGhpbmcgdG8gaW5kZXhcIiDihpIgcmVzcGVjdCB0aGF0LlxuICAgICAgICAgIGlmIChleHRyYWN0ZWQgIT09IHVuZGVmaW5lZCkgdGV4dCA9IGV4dHJhY3RlZFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBDYWNoZSBMT1dFUkVEOiBzZXRTZWFyY2hRdWVyeSdzIGhvdCBsb29wIGluZGV4T2ZzIHBlciBrZXlzdHJva2UuXG4gICAgICAvLyBMb3dlcmluZyBoZXJlIChvbmNlLCBhdCB3YXJtKSB2cyB0aGVyZSAoZXZlcnkga2V5c3Ryb2tlKSB0cmFkZXNcbiAgICAgIC8vIH5zYW1lIHN0ZWFkeS1zdGF0ZSBtZW1vcnkgZm9yIHplcm8gcGVyLWtleXN0cm9rZSBhbGxvYy4gQ2FjaGVcbiAgICAgIC8vIEdDJ3Mgd2l0aCBtZXNzYWdlcyBvbiB0cmFuc2NyaXB0IGV4aXQuIFRvb2wgbWV0aG9kcyByZXR1cm4gcmF3O1xuICAgICAgLy8gcmVuZGVyYWJsZVNlYXJjaFRleHQgYWxyZWFkeSBsb3dlcmNhc2VzIChyZWR1bmRhbnQgYnV0IGNoZWFwKS5cbiAgICAgIGNvbnN0IGxvd2VyZWQgPSB0ZXh0LnRvTG93ZXJDYXNlKClcbiAgICAgIHNlYXJjaFRleHRDYWNoZS5jdXJyZW50LnNldChtc2csIGxvd2VyZWQpXG4gICAgICByZXR1cm4gbG93ZXJlZFxuICAgIH0sXG4gICAgW3Rvb2xzLCBsb29rdXBzXSxcbiAgKVxuXG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIHsvKiBMb2dvICovfVxuICAgICAgeyFoaWRlTG9nbyAmJiAhKHJlbmRlclJhbmdlICYmIHJlbmRlclJhbmdlWzBdID4gMCkgJiYgKFxuICAgICAgICA8TG9nb0hlYWRlciBhZ2VudERlZmluaXRpb25zPXthZ2VudERlZmluaXRpb25zfSAvPlxuICAgICAgKX1cblxuICAgICAgey8qIFRydW5jYXRpb24gaW5kaWNhdG9yICovfVxuICAgICAge2hhc1RydW5jYXRlZE1lc3NhZ2VzICYmIChcbiAgICAgICAgPERpdmlkZXJcbiAgICAgICAgICB0aXRsZT17YCR7dG9nZ2xlU2hvd0FsbFNob3J0Y3V0fSB0byBzaG93ICR7Y2hhbGsuYm9sZChoaWRkZW5NZXNzYWdlQ291bnQpfSBwcmV2aW91cyBtZXNzYWdlc2B9XG4gICAgICAgICAgd2lkdGg9e2NvbHVtbnN9XG4gICAgICAgIC8+XG4gICAgICApfVxuXG4gICAgICB7LyogU2hvdyBhbGwgaW5kaWNhdG9yICovfVxuICAgICAge2lzVHJhbnNjcmlwdE1vZGUgJiZcbiAgICAgICAgc2hvd0FsbEluVHJhbnNjcmlwdCAmJlxuICAgICAgICBoaWRkZW5NZXNzYWdlQ291bnQgPiAwICYmXG4gICAgICAgIC8vIGRpc2FibGVSZW5kZXJDYXAgKGUuZy4gWyBkdW1wLXRvLXNjcm9sbGJhY2spIG1lYW5zIHdlJ3JlIHVuY2FwcGVkXG4gICAgICAgIC8vIGFzIGEgb25lLXNob3QgZXNjYXBlIGhhdGNoLCBub3QgYSB0b2dnbGUg4oCUIGN0cmwrZSBpcyBkZWFkIGFuZFxuICAgICAgICAvLyBub3RoaW5nIGlzIGFjdHVhbGx5IFwiaGlkZGVuXCIgdG8gcmVzdG9yZS5cbiAgICAgICAgIWRpc2FibGVSZW5kZXJDYXAgJiYgKFxuICAgICAgICAgIDxEaXZpZGVyXG4gICAgICAgICAgICB0aXRsZT17YCR7dG9nZ2xlU2hvd0FsbFNob3J0Y3V0fSB0byBoaWRlICR7Y2hhbGsuYm9sZChoaWRkZW5NZXNzYWdlQ291bnQpfSBwcmV2aW91cyBtZXNzYWdlc2B9XG4gICAgICAgICAgICB3aWR0aD17Y29sdW1uc31cbiAgICAgICAgICAvPlxuICAgICAgICApfVxuXG4gICAgICB7LyogTWVzc2FnZXMgLSByZW5kZXJlZCBhcyBtZW1vaXplZCBNZXNzYWdlUm93IGNvbXBvbmVudHMuXG4gICAgICAgICAgZmxhdE1hcCBpbnNlcnRzIHRoZSB1bnNlZW4tZGl2aWRlciBhcyBhIHNlcGFyYXRlIGtleWVkIHNpYmxpbmcgc29cbiAgICAgICAgICAoYSkgbm9uLWZ1bGxzY3JlZW4gcmVuZGVycyBwYXkgbm8gcGVyLW1lc3NhZ2UgRnJhZ21lbnQgd3JhcCwgYW5kXG4gICAgICAgICAgKGIpIGRpdmlkZXIgdG9nZ2xlIGluIGZ1bGxzY3JlZW4gcHJlc2VydmVzIGFsbCBNZXNzYWdlUm93cyBieSBrZXkuXG4gICAgICAgICAgUHJlLWNvbXB1dGUgZGVyaXZlZCB2YWx1ZXMgaW5zdGVhZCBvZiBwYXNzaW5nIHJlbmRlcmFibGVNZXNzYWdlcyB0b1xuICAgICAgICAgIGVhY2ggcm93IC0gUmVhY3QgQ29tcGlsZXIgcGlucyBwcm9wcyBpbiB0aGUgZmliZXIncyBtZW1vQ2FjaGUsIHNvXG4gICAgICAgICAgcGFzc2luZyB0aGUgYXJyYXkgd291bGQgYWNjdW11bGF0ZSBldmVyeSBoaXN0b3JpY2FsIHZlcnNpb25cbiAgICAgICAgICAofjEtMk1CIG92ZXIgYSA3LXR1cm4gc2Vzc2lvbikuICovfVxuICAgICAge3ZpcnR1YWxTY3JvbGxSdW50aW1lR2F0ZSA/IChcbiAgICAgICAgPEluVmlydHVhbExpc3RDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXt0cnVlfT5cbiAgICAgICAgICA8VmlydHVhbE1lc3NhZ2VMaXN0XG4gICAgICAgICAgICBtZXNzYWdlcz17cmVuZGVyYWJsZU1lc3NhZ2VzfVxuICAgICAgICAgICAgc2Nyb2xsUmVmPXtzY3JvbGxSZWZ9XG4gICAgICAgICAgICBjb2x1bW5zPXtjb2x1bW5zfVxuICAgICAgICAgICAgaXRlbUtleT17bWVzc2FnZUtleX1cbiAgICAgICAgICAgIHJlbmRlckl0ZW09e3JlbmRlck1lc3NhZ2VSb3d9XG4gICAgICAgICAgICBvbkl0ZW1DbGljaz17b25JdGVtQ2xpY2t9XG4gICAgICAgICAgICBpc0l0ZW1DbGlja2FibGU9e2lzSXRlbUNsaWNrYWJsZX1cbiAgICAgICAgICAgIGlzSXRlbUV4cGFuZGVkPXtpc0l0ZW1FeHBhbmRlZH1cbiAgICAgICAgICAgIHRyYWNrU3RpY2t5UHJvbXB0PXt0cmFja1N0aWNreVByb21wdH1cbiAgICAgICAgICAgIHNlbGVjdGVkSW5kZXg9e3NlbGVjdGVkSWR4ID49IDAgPyBzZWxlY3RlZElkeCA6IHVuZGVmaW5lZH1cbiAgICAgICAgICAgIGN1cnNvck5hdlJlZj17Y3Vyc29yTmF2UmVmfVxuICAgICAgICAgICAgc2V0Q3Vyc29yPXtzZXRDdXJzb3J9XG4gICAgICAgICAgICBqdW1wUmVmPXtqdW1wUmVmfVxuICAgICAgICAgICAgb25TZWFyY2hNYXRjaGVzQ2hhbmdlPXtvblNlYXJjaE1hdGNoZXNDaGFuZ2V9XG4gICAgICAgICAgICBzY2FuRWxlbWVudD17c2NhbkVsZW1lbnR9XG4gICAgICAgICAgICBzZXRQb3NpdGlvbnM9e3NldFBvc2l0aW9uc31cbiAgICAgICAgICAgIGV4dHJhY3RTZWFyY2hUZXh0PXtleHRyYWN0U2VhcmNoVGV4dH1cbiAgICAgICAgICAvPlxuICAgICAgICA8L0luVmlydHVhbExpc3RDb250ZXh0LlByb3ZpZGVyPlxuICAgICAgKSA6IChcbiAgICAgICAgcmVuZGVyYWJsZU1lc3NhZ2VzLmZsYXRNYXAocmVuZGVyTWVzc2FnZVJvdylcbiAgICAgICl9XG5cbiAgICAgIHtzdHJlYW1pbmdUZXh0ICYmICFpc0JyaWVmT25seSAmJiAoXG4gICAgICAgIDxCb3hcbiAgICAgICAgICBhbGlnbkl0ZW1zPVwiZmxleC1zdGFydFwiXG4gICAgICAgICAgZmxleERpcmVjdGlvbj1cInJvd1wiXG4gICAgICAgICAgbWFyZ2luVG9wPXsxfVxuICAgICAgICAgIHdpZHRoPVwiMTAwJVwiXG4gICAgICAgID5cbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIj5cbiAgICAgICAgICAgIDxCb3ggbWluV2lkdGg9ezJ9PlxuICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cInRleHRcIj57QkxBQ0tfQ0lSQ0xFfTwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICAgIDxTdHJlYW1pbmdNYXJrZG93bj57c3RyZWFtaW5nVGV4dH08L1N0cmVhbWluZ01hcmtkb3duPlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cblxuICAgICAge2lzU3RyZWFtaW5nVGhpbmtpbmdWaXNpYmxlICYmIHN0cmVhbWluZ1RoaW5raW5nICYmICFpc0JyaWVmT25seSAmJiAoXG4gICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICA8QXNzaXN0YW50VGhpbmtpbmdNZXNzYWdlXG4gICAgICAgICAgICBwYXJhbT17e1xuICAgICAgICAgICAgICB0eXBlOiAndGhpbmtpbmcnLFxuICAgICAgICAgICAgICB0aGlua2luZzogc3RyZWFtaW5nVGhpbmtpbmcudGhpbmtpbmcsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgICAgYWRkTWFyZ2luPXtmYWxzZX1cbiAgICAgICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e3RydWV9XG4gICAgICAgICAgICB2ZXJib3NlPXt2ZXJib3NlfVxuICAgICAgICAgICAgaGlkZUluVHJhbnNjcmlwdD17ZmFsc2V9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuICAgIDwvPlxuICApXG59XG5cbi8qKiBLZXkgZm9yIGNsaWNrLXRvLWV4cGFuZDogdG9vbF91c2VfaWQgd2hlcmUgYXZhaWxhYmxlIChzbyB0b29sX3VzZSArIGl0c1xuICogIHRvb2xfcmVzdWx0IGV4cGFuZCB0b2dldGhlciksIGVsc2UgdXVpZCBmb3IgZ3JvdXBzL3RoaW5raW5nLiAqL1xuZnVuY3Rpb24gZXhwYW5kS2V5KG1zZzogUmVuZGVyYWJsZU1lc3NhZ2UpOiBzdHJpbmcge1xuICByZXR1cm4gKFxuICAgIChtc2cudHlwZSA9PT0gJ2Fzc2lzdGFudCcgfHwgbXNnLnR5cGUgPT09ICd1c2VyJ1xuICAgICAgPyBnZXRUb29sVXNlSUQobXNnKVxuICAgICAgOiBudWxsKSA/PyBtc2cudXVpZFxuICApXG59XG5cbi8vIEN1c3RvbSBjb21wYXJhdG9yIHRvIHByZXZlbnQgdW5uZWNlc3NhcnkgcmUtcmVuZGVycyBkdXJpbmcgc3RyZWFtaW5nLlxuLy8gRGVmYXVsdCBSZWFjdC5tZW1vIGRvZXMgc2hhbGxvdyBjb21wYXJpc29uIHdoaWNoIGZhaWxzIHdoZW46XG4vLyAxLiBvbk9wZW5SYXRlTGltaXRPcHRpb25zIGNhbGxiYWNrIGlzIHJlY3JlYXRlZCAoZG9lc24ndCBhZmZlY3QgcmVuZGVyIG91dHB1dClcbi8vIDIuIHN0cmVhbWluZ1Rvb2xVc2VzIGFycmF5IGlzIHJlY3JlYXRlZCBvbiBldmVyeSBkZWx0YSwgYnV0IG9ubHkgY29udGVudEJsb2NrIG1hdHRlcnMgZm9yIHJlbmRlcmluZ1xuLy8gMy4gc3RyZWFtaW5nVGhpbmtpbmcgY2hhbmdlcyBvbiBldmVyeSBkZWx0YSAtIHdlIERPIHdhbnQgdG8gcmUtcmVuZGVyIGZvciB0aGlzXG5mdW5jdGlvbiBzZXRzRXF1YWw8VD4oYTogU2V0PFQ+LCBiOiBTZXQ8VD4pOiBib29sZWFuIHtcbiAgaWYgKGEuc2l6ZSAhPT0gYi5zaXplKSByZXR1cm4gZmFsc2VcbiAgZm9yIChjb25zdCBpdGVtIG9mIGEpIHtcbiAgICBpZiAoIWIuaGFzKGl0ZW0pKSByZXR1cm4gZmFsc2VcbiAgfVxuICByZXR1cm4gdHJ1ZVxufVxuXG5leHBvcnQgY29uc3QgTWVzc2FnZXMgPSBSZWFjdC5tZW1vKE1lc3NhZ2VzSW1wbCwgKHByZXYsIG5leHQpID0+IHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHByZXYpIGFzIChrZXlvZiB0eXBlb2YgcHJldilbXVxuICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgaWYgKFxuICAgICAga2V5ID09PSAnb25PcGVuUmF0ZUxpbWl0T3B0aW9ucycgfHxcbiAgICAgIGtleSA9PT0gJ3Njcm9sbFJlZicgfHxcbiAgICAgIGtleSA9PT0gJ3RyYWNrU3RpY2t5UHJvbXB0JyB8fFxuICAgICAga2V5ID09PSAnc2V0Q3Vyc29yJyB8fFxuICAgICAga2V5ID09PSAnY3Vyc29yTmF2UmVmJyB8fFxuICAgICAga2V5ID09PSAnanVtcFJlZicgfHxcbiAgICAgIGtleSA9PT0gJ29uU2VhcmNoTWF0Y2hlc0NoYW5nZScgfHxcbiAgICAgIGtleSA9PT0gJ3NjYW5FbGVtZW50JyB8fFxuICAgICAga2V5ID09PSAnc2V0UG9zaXRpb25zJ1xuICAgIClcbiAgICAgIGNvbnRpbnVlXG4gICAgaWYgKHByZXZba2V5XSAhPT0gbmV4dFtrZXldKSB7XG4gICAgICBpZiAoa2V5ID09PSAnc3RyZWFtaW5nVG9vbFVzZXMnKSB7XG4gICAgICAgIGNvbnN0IHAgPSBwcmV2LnN0cmVhbWluZ1Rvb2xVc2VzXG4gICAgICAgIGNvbnN0IG4gPSBuZXh0LnN0cmVhbWluZ1Rvb2xVc2VzXG4gICAgICAgIGlmIChcbiAgICAgICAgICBwLmxlbmd0aCA9PT0gbi5sZW5ndGggJiZcbiAgICAgICAgICBwLmV2ZXJ5KChpdGVtLCBpKSA9PiBpdGVtLmNvbnRlbnRCbG9jayA9PT0gbltpXT8uY29udGVudEJsb2NrKVxuICAgICAgICApIHtcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoa2V5ID09PSAnaW5Qcm9ncmVzc1Rvb2xVc2VJRHMnKSB7XG4gICAgICAgIGlmIChzZXRzRXF1YWwocHJldi5pblByb2dyZXNzVG9vbFVzZUlEcywgbmV4dC5pblByb2dyZXNzVG9vbFVzZUlEcykpIHtcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoa2V5ID09PSAndW5zZWVuRGl2aWRlcicpIHtcbiAgICAgICAgY29uc3QgcCA9IHByZXYudW5zZWVuRGl2aWRlclxuICAgICAgICBjb25zdCBuID0gbmV4dC51bnNlZW5EaXZpZGVyXG4gICAgICAgIGlmIChcbiAgICAgICAgICBwPy5maXJzdFVuc2VlblV1aWQgPT09IG4/LmZpcnN0VW5zZWVuVXVpZCAmJlxuICAgICAgICAgIHA/LmNvdW50ID09PSBuPy5jb3VudFxuICAgICAgICApIHtcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoa2V5ID09PSAndG9vbHMnKSB7XG4gICAgICAgIGNvbnN0IHAgPSBwcmV2LnRvb2xzXG4gICAgICAgIGNvbnN0IG4gPSBuZXh0LnRvb2xzXG4gICAgICAgIGlmIChcbiAgICAgICAgICBwLmxlbmd0aCA9PT0gbi5sZW5ndGggJiZcbiAgICAgICAgICBwLmV2ZXJ5KCh0b29sLCBpKSA9PiB0b29sLm5hbWUgPT09IG5baV0/Lm5hbWUpXG4gICAgICAgICkge1xuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIHN0cmVhbWluZ1RoaW5raW5nIGNoYW5nZXMgZnJlcXVlbnRseSAtIGFsd2F5cyByZS1yZW5kZXIgd2hlbiBpdCBjaGFuZ2VzXG4gICAgICAvLyAobm8gc3BlY2lhbCBoYW5kbGluZyBuZWVkZWQsIGRlZmF1bHQgYmVoYXZpb3IgaXMgY29ycmVjdClcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZVxufSlcblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZFJlbmRlclN0YXRpY2FsbHkoXG4gIG1lc3NhZ2U6IFJlbmRlcmFibGVNZXNzYWdlLFxuICBzdHJlYW1pbmdUb29sVXNlSURzOiBTZXQ8c3RyaW5nPixcbiAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM6IFNldDxzdHJpbmc+LFxuICBzaWJsaW5nVG9vbFVzZUlEczogUmVhZG9ubHlTZXQ8c3RyaW5nPixcbiAgc2NyZWVuOiBTY3JlZW4sXG4gIGxvb2t1cHM6IFJldHVyblR5cGU8dHlwZW9mIGJ1aWxkTWVzc2FnZUxvb2t1cHM+LFxuKTogYm9vbGVhbiB7XG4gIGlmIChzY3JlZW4gPT09ICd0cmFuc2NyaXB0Jykge1xuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgc3dpdGNoIChtZXNzYWdlLnR5cGUpIHtcbiAgICBjYXNlICdhdHRhY2htZW50JzpcbiAgICBjYXNlICd1c2VyJzpcbiAgICBjYXNlICdhc3Npc3RhbnQnOiB7XG4gICAgICBpZiAobWVzc2FnZS50eXBlID09PSAnYXNzaXN0YW50Jykge1xuICAgICAgICBjb25zdCBibG9jayA9IG1lc3NhZ2UubWVzc2FnZS5jb250ZW50WzBdXG4gICAgICAgIGlmIChibG9jaz8udHlwZSA9PT0gJ3NlcnZlcl90b29sX3VzZScpIHtcbiAgICAgICAgICByZXR1cm4gbG9va3Vwcy5yZXNvbHZlZFRvb2xVc2VJRHMuaGFzKGJsb2NrLmlkKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCB0b29sVXNlSUQgPSBnZXRUb29sVXNlSUQobWVzc2FnZSlcbiAgICAgIGlmICghdG9vbFVzZUlEKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICBpZiAoc3RyZWFtaW5nVG9vbFVzZUlEcy5oYXModG9vbFVzZUlEKSkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICAgIGlmIChpblByb2dyZXNzVG9vbFVzZUlEcy5oYXModG9vbFVzZUlEKSkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgaWYgdGhlcmUgYXJlIGFueSB1bnJlc29sdmVkIFBvc3RUb29sVXNlIGhvb2tzIGZvciB0aGlzIHRvb2wgdXNlXG4gICAgICAvLyBJZiBzbywga2VlcCB0aGUgbWVzc2FnZSB0cmFuc2llbnQgc28gdGhlIEhvb2tQcm9ncmVzc01lc3NhZ2UgY2FuIHVwZGF0ZVxuICAgICAgaWYgKGhhc1VucmVzb2x2ZWRIb29rc0Zyb21Mb29rdXAodG9vbFVzZUlELCAnUG9zdFRvb2xVc2UnLCBsb29rdXBzKSkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGV2ZXJ5KHNpYmxpbmdUb29sVXNlSURzLCBsb29rdXBzLnJlc29sdmVkVG9vbFVzZUlEcylcbiAgICB9XG4gICAgY2FzZSAnc3lzdGVtJzoge1xuICAgICAgLy8gYXBpIGVycm9ycyBhbHdheXMgcmVuZGVyIGR5bmFtaWNhbGx5LCBzaW5jZSB3ZSBoaWRlXG4gICAgICAvLyB0aGVtIGFzIHNvb24gYXMgd2Ugc2VlIGFub3RoZXIgbm9uLWVycm9yIG1lc3NhZ2UuXG4gICAgICByZXR1cm4gbWVzc2FnZS5zdWJ0eXBlICE9PSAnYXBpX2Vycm9yJ1xuICAgIH1cbiAgICBjYXNlICdncm91cGVkX3Rvb2xfdXNlJzoge1xuICAgICAgY29uc3QgYWxsUmVzb2x2ZWQgPSBtZXNzYWdlLm1lc3NhZ2VzLmV2ZXJ5KG1zZyA9PiB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBtc2cubWVzc2FnZS5jb250ZW50WzBdXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgY29udGVudD8udHlwZSA9PT0gJ3Rvb2xfdXNlJyAmJlxuICAgICAgICAgIGxvb2t1cHMucmVzb2x2ZWRUb29sVXNlSURzLmhhcyhjb250ZW50LmlkKVxuICAgICAgICApXG4gICAgICB9KVxuICAgICAgcmV0dXJuIGFsbFJlc29sdmVkXG4gICAgfVxuICAgIGNhc2UgJ2NvbGxhcHNlZF9yZWFkX3NlYXJjaCc6IHtcbiAgICAgIC8vIEluIHByb21wdCBtb2RlLCBuZXZlciBtYXJrIGFzIHN0YXRpYyB0byBwcmV2ZW50IGZsaWNrZXIgYmV0d2VlbiBBUEkgdHVybnNcbiAgICAgIC8vIChJbiB0cmFuc2NyaXB0IG1vZGUsIHdlIGFscmVhZHkgcmV0dXJuZWQgdHJ1ZSBhdCB0aGUgdG9wIG9mIHRoaXMgZnVuY3Rpb24pXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLFNBQVNBLE9BQU8sUUFBUSxZQUFZO0FBQ3BDLE9BQU9DLEtBQUssTUFBTSxPQUFPO0FBQ3pCLGNBQWNDLElBQUksUUFBUSxRQUFRO0FBQ2xDLGNBQWNDLFNBQVMsUUFBUSxPQUFPO0FBQ3RDLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0MsV0FBVyxFQUFFQyxTQUFTLEVBQUVDLE9BQU8sRUFBRUMsTUFBTSxFQUFFQyxRQUFRLFFBQVEsT0FBTztBQUN6RSxTQUFTQyxLQUFLLFFBQVEsa0JBQWtCO0FBQ3hDLFNBQVNDLGVBQWUsUUFBUSx1QkFBdUI7QUFDdkQsY0FBY0MsT0FBTyxRQUFRLGdCQUFnQjtBQUM3QyxTQUFTQyxZQUFZLFFBQVEseUJBQXlCO0FBQ3RELFNBQVNDLGVBQWUsUUFBUSw2QkFBNkI7QUFDN0QsY0FBY0MsZUFBZSxRQUFRLGdDQUFnQztBQUNyRSxTQUFTQyx1QkFBdUIsUUFBUSxtQ0FBbUM7QUFDM0UsU0FBU0MsR0FBRyxFQUFFQyxJQUFJLFFBQVEsV0FBVztBQUNyQyxTQUFTQyxrQkFBa0IsUUFBUSxzQ0FBc0M7QUFDekUsY0FBY0MsTUFBTSxRQUFRLG9CQUFvQjtBQUNoRCxjQUFjQyxLQUFLLFFBQVEsWUFBWTtBQUN2QyxTQUFTQyxjQUFjLFFBQVEsWUFBWTtBQUMzQyxjQUFjQyxzQkFBc0IsUUFBUSxxQ0FBcUM7QUFDakYsY0FDRUMsT0FBTyxJQUFJQyxXQUFXLEVBQ3RCQyxpQkFBaUIsRUFDakJDLGVBQWUsSUFBSUMsbUJBQW1CLEVBQ3RDQyxpQkFBaUIsUUFDWixxQkFBcUI7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