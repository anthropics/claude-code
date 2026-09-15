import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import React, { createContext, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { fileURLToPath } from 'url';
import { ModalContext } from '../context/modalContext.js';
import { PromptOverlayProvider, usePromptOverlay, usePromptOverlayDialog } from '../context/promptOverlayContext.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import ScrollBox, { type ScrollBoxHandle } from '../ink/components/ScrollBox.js';
import instances from '../ink/instances.js';
import { Box, Text } from '../ink.js';
import type { Message } from '../types/message.js';
import { openBrowser, openPath } from '../utils/browser.js';
import { isFullscreenEnvEnabled } from '../utils/fullscreen.js';
import { plural } from '../utils/stringUtils.js';
import { isNullRenderingAttachment } from './messages/nullRenderingAttachments.js';
import PromptInputFooterSuggestions from './PromptInput/PromptInputFooterSuggestions.js';
import type { StickyPrompt } from './VirtualMessageList.js';

/** Rows of transcript context kept visible above the modal pane's ▔ divider. */
const MODAL_TRANSCRIPT_PEEK = 2;

/** Context for scroll-derived chrome (sticky header, pill). StickyTracker
 *  in VirtualMessageList writes via this instead of threading a callback
 *  up through Messages → REPL → FullscreenLayout. The setter is stable so
 *  consuming this context never causes re-renders. */
export const ScrollChromeContext = createContext<{
  setStickyPrompt: (p: StickyPrompt | null) => void;
}>({
  setStickyPrompt: () => {}
});
type Props = {
  /** Content that scrolls (messages, tool output) */
  scrollable: ReactNode;
  /** Content pinned to the bottom (spinner, prompt, permissions) */
  bottom: ReactNode;
  /** Content rendered inside the ScrollBox after messages — user can scroll
   *  up to see context while it's showing (used by PermissionRequest). */
  overlay?: ReactNode;
  /** Absolute-positioned content anchored at the bottom-right of the
   *  ScrollBox area, floating over scrollback. Rendered inside the flexGrow
   *  region (not the bottom slot) so the overflowY:hidden cap doesn't clip
   *  it. Fullscreen only — used for the companion speech bubble. */
  bottomFloat?: ReactNode;
  /** Slash-command dialog content. Rendered in an absolute-positioned
   *  bottom-anchored pane (▔ divider, paddingX=2) that paints over the
   *  ScrollBox AND bottom slot. Provides ModalContext so Pane/Dialog inside
   *  skip their own frame. Fullscreen only; inline after overlay otherwise. */
  modal?: ReactNode;
  /** Ref passed via ModalContext so Tabs (or any scroll-owning descendant)
   *  can attach it to their own ScrollBox for tall content. */
  modalScrollRef?: React.RefObject<ScrollBoxHandle | null>;
  /** Ref to the scroll box for keyboard scrolling. RefObject (not Ref) so
   *  pillVisible's useSyncExternalStore can subscribe to scroll changes. */
  scrollRef?: RefObject<ScrollBoxHandle | null>;
  /** Y-position (scrollHeight at snapshot) of the unseen-divider. Pill
   *  shows while viewport bottom hasn't reached this. Ref so REPL doesn't
   *  re-render on the one-shot snapshot write. */
  dividerYRef?: RefObject<number | null>;
  /** Force-hide the pill (e.g. viewing a sub-agent task). */
  hidePill?: boolean;
  /** Force-hide the sticky prompt header (e.g. viewing a teammate task). */
  hideSticky?: boolean;
  /** Count for the pill text. 0 → "Jump to bottom", >0 → "N new messages". */
  newMessageCount?: number;
  /** Called when the user clicks the "N new" pill. */
  onPillClick?: () => void;
};

/**
 * Tracks the in-transcript "N new messages" divider position while the
 * user is scrolled up. Snapshots message count AND scrollHeight the first
 * time sticky breaks. scrollHeight ≈ the y-position of the divider in the
 * scroll content (it renders right after the last message that existed at
 * snapshot time).
 *
 * `pillVisible` lives in FullscreenLayout (not here) — it subscribes
 * directly to ScrollBox via useSyncExternalStore with a boolean snapshot
 * against `dividerYRef`, so per-frame scroll never re-renders REPL.
 * `dividerIndex` stays here because REPL needs it for computeUnseenDivider
 * → Messages' divider line; it changes only ~twice/scroll-session
 * (first scroll-away + repin), acceptable REPL re-render cost.
 *
 * `onScrollAway` must be called by every scroll-away action with the
 * handle; `onRepin` by submit/scroll-to-bottom.
 */
export function useUnseenDivider(messageCount: number): {
  /** Index into messages[] where the divider line renders. Cleared on
   *  sticky-resume (scroll back to bottom) so the "N new" line doesn't
   *  linger once everything is visible. */
  dividerIndex: number | null;
  /** scrollHeight snapshot at first scroll-away — the divider's y-position.
   *  FullscreenLayout subscribes to ScrollBox and compares viewport bottom
   *  against this for pillVisible. Ref so writes don't re-render REPL. */
  dividerYRef: RefObject<number | null>;
  onScrollAway: (handle: ScrollBoxHandle) => void;
  onRepin: () => void;
  /** Scroll the handle so the divider line is at the top of the viewport. */
  jumpToNew: (handle: ScrollBoxHandle | null) => void;
  /** Shift dividerIndex and dividerYRef when messages are prepended
   *  (infinite scroll-back). indexDelta = number of messages prepended;
   *  heightDelta = content height growth in rows. */
  shiftDivider: (indexDelta: number, heightDelta: number) => void;
} {
  const [dividerIndex, setDividerIndex] = useState<number | null>(null);
  // Ref holds the current count for onScrollAway to snapshot. Written in
  // the render body (not useEffect) so wheel events arriving between a
  // message-append render and its effect flush don't capture a stale
  // count (off-by-one in the baseline). React Compiler bails out here —
  // acceptable for a hook instantiated once in REPL.
  const countRef = useRef(messageCount);
  countRef.current = messageCount;
  // scrollHeight snapshot — the divider's y in content coords. Ref-only:
  // read synchronously in onScrollAway (setState is batched, can't
  // read-then-write in the same callback) AND by FullscreenLayout's
  // pillVisible subscription. null = pinned to bottom.
  const dividerYRef = useRef<number | null>(null);
  const onRepin = useCallback(() => {
    // Don't clear dividerYRef here — a trackpad momentum wheel event
    // racing in the same stdin batch would see null and re-snapshot,
    // overriding the setDividerIndex(null) below. The useEffect below
    // clears the ref after React commits the null dividerIndex, so the
    // ref stays non-null until the state settles.
    setDividerIndex(null);
  }, []);
  const onScrollAway = useCallback((handle: ScrollBoxHandle) => {
    // Nothing below the viewport → nothing to jump to. Covers both:
    // • empty/short session: scrollUp calls scrollTo(0) which breaks sticky
    //   even at scrollTop=0 (wheel-up on fresh session showed the pill)
    // • click-to-select at bottom: useDragToScroll.check() calls
    //   scrollTo(current) to break sticky so streaming content doesn't shift
    //   under the selection, then onScroll(false, …) — but scrollTop is still
    //   at max (Sarah Deaton, #claude-code-feedback 2026-03-15)
    // pendingDelta: scrollBy accumulates without updating scrollTop. Without
    // it, wheeling up from max would see scrollTop==max and suppress the pill.
    const max = Math.max(0, handle.getScrollHeight() - handle.getViewportHeight());
    if (handle.getScrollTop() + handle.getPendingDelta() >= max) return;
    // Snapshot only on the FIRST scroll-away. onScrollAway fires on EVERY
    // scroll action (not just the initial break from sticky) — this guard
    // preserves the original baseline so the count doesn't reset on the
    // second PageUp. Subsequent calls are ref-only no-ops (no REPL re-render).
    if (dividerYRef.current === null) {
      dividerYRef.current = handle.getScrollHeight();
      // New scroll-away session → move the divider here (replaces old one)
      setDividerIndex(countRef.current);
    }
  }, []);
  const jumpToNew = useCallback((handle_0: ScrollBoxHandle | null) => {
    if (!handle_0) return;
    // scrollToBottom (not scrollTo(dividerY)): sets stickyScroll=true so
    // useVirtualScroll mounts the tail and render-node-to-output pins
    // scrollTop=maxScroll. scrollTo sets stickyScroll=false → the clamp
    // (still at top-range bounds before React re-renders) pins scrollTop
    // back, stopping short. The divider stays rendered (dividerIndex
    // unchanged) so users see where new messages started; the clear on
    // next submit/explicit scroll-to-bottom handles cleanup.
    handle_0.scrollToBottom();
  }, []);

  // Sync dividerYRef with dividerIndex. When onRepin fires (submit,
  // scroll-to-bottom), it sets dividerIndex=null but leaves the ref
  // non-null — a wheel event racing in the same stdin batch would
  // otherwise see null and re-snapshot. Deferring the ref clear to
  // useEffect guarantees the ref stays non-null until React has committed
  // the null dividerIndex, blocking the if-null guard in onScrollAway.
  //
  // Also handles /clear, rewind, teammate-view swap — if the count drops
  // below the divider index, the divider would point at nothing.
  useEffect(() => {
    if (dividerIndex === null) {
      dividerYRef.current = null;
    } else if (messageCount < dividerIndex) {
      dividerYRef.current = null;
      setDividerIndex(null);
    }
  }, [messageCount, dividerIndex]);
  const shiftDivider = useCallback((indexDelta: number, heightDelta: number) => {
    setDividerIndex(idx => idx === null ? null : idx + indexDelta);
    if (dividerYRef.current !== null) {
      dividerYRef.current += heightDelta;
    }
  }, []);
  return {
    dividerIndex,
    dividerYRef,
    onScrollAway,
    onRepin,
    jumpToNew,
    shiftDivider
  };
}

/**
 * Counts assistant turns in messages[dividerIndex..end). A "turn" is what
 * users think of as "a new message from Claude" — not raw assistant entries
 * (one turn yields multiple entries: tool_use blocks + text blocks). We count
 * non-assistant→assistant transitions, but only for entries that actually
 * carry text — tool-use-only entries are skipped (like progress messages)
 * so "⏺ Searched for 13 patterns, read 6 files" doesn't tick the pill.
 */
export function countUnseenAssistantTurns(messages: readonly Message[], dividerIndex: number): number {
  let count = 0;
  let prevWasAssistant = false;
  for (let i = dividerIndex; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.type === 'progress') continue;
    // Tool-use-only assistant entries aren't "new messages" to the user —
    // skip them the same way we skip progress. prevWasAssistant is NOT
    // updated, so a text block immediately following still counts as the
    // same turn (tool_use + text from one API response = 1).
    if (m.type === 'assistant' && !assistantHasVisibleText(m)) continue;
    const isAssistant = m.type === 'assistant';
    if (isAssistant && !prevWasAssistant) count++;
    prevWasAssistant = isAssistant;
  }
  return count;
}
function assistantHasVisibleText(m: Message): boolean {
  if (m.type !== 'assistant') return false;
  for (const b of m.message.content) {
    if (b.type === 'text' && b.text.trim() !== '') return true;
  }
  return false;
}
export type UnseenDivider = {
  firstUnseenUuid: Message['uuid'];
  count: number;
};

/**
 * Builds the unseenDivider object REPL passes to Messages + the pill.
 * Returns undefined only when no content has arrived past the divider
 * yet (messages[dividerIndex] doesn't exist). Once ANY message arrives
 * — including tool_use-only assistant entries and tool_result user entries
 * that countUnseenAssistantTurns skips — count floors at 1 so the pill
 * flips from "Jump to bottom" to "1 new message". Without the floor,
 * the pill stays "Jump to bottom" through an entire tool-call sequence
 * until Claude's text response lands.
 */
export function computeUnseenDivider(messages: readonly Message[], dividerIndex: number | null): UnseenDivider | undefined {
  if (dividerIndex === null) return undefined;
  // Skip progress and null-rendering attachments when picking the divider
  // anchor — Messages.tsx filters these out of renderableMessages before the
  // dividerBeforeIndex search, so their UUID wouldn't be found (CC-724).
  // Hook attachments use randomUUID() so nothing shares their 24-char prefix.
  let anchorIdx = dividerIndex;
  while (anchorIdx < messages.length && (messages[anchorIdx]?.type === 'progress' || isNullRenderingAttachment(messages[anchorIdx]!))) {
    anchorIdx++;
  }
  const uuid = messages[anchorIdx]?.uuid;
  if (!uuid) return undefined;
  const count = countUnseenAssistantTurns(messages, dividerIndex);
  return {
    firstUnseenUuid: uuid,
    count: Math.max(1, count)
  };
}

/**
 * Layout wrapper for the REPL. In fullscreen mode, puts scrollable
 * content in a sticky-scroll box and pins bottom content via flexbox.
 * Outside fullscreen mode, renders content sequentially so the existing
 * main-screen scrollback rendering works unchanged.
 *
 * Fullscreen mode defaults on for ants (CLAUDE_CODE_NO_FLICKER=0 to opt out)
 * and off for external users (CLAUDE_CODE_NO_FLICKER=1 to opt in).
 * The <AlternateScreen> wrapper
 * (alt buffer + mouse tracking + height constraint) lives at REPL's root
 * so nothing can accidentally render outside it.
 */
export function FullscreenLayout(t0) {
  const $ = _c(47);
  const {
    scrollable,
    bottom,
    overlay,
    bottomFloat,
    modal,
    modalScrollRef,
    scrollRef,
    dividerYRef,
    hidePill: t1,
    hideSticky: t2,
    newMessageCount: t3,
    onPillClick
  } = t0;
  const hidePill = t1 === undefined ? false : t1;
  const hideSticky = t2 === undefined ? false : t2;
  const newMessageCount = t3 === undefined ? 0 : t3;
  const {
    rows: terminalRows,
    columns
  } = useTerminalSize();
  const [stickyPrompt, setStickyPrompt] = useState(null);
  let t4;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t4 = {
      setStickyPrompt
    };
    $[0] = t4;
  } else {
    t4 = $[0];
  }
  const chromeCtx = t4;
  let t5;
  if ($[1] !== scrollRef) {
    t5 = listener => scrollRef?.current?.subscribe(listener) ?? _temp;
    $[1] = scrollRef;
    $[2] = t5;
  } else {
    t5 = $[2];
  }
  const subscribe = t5;
  let t6;
  if ($[3] !== dividerYRef || $[4] !== scrollRef) {
    t6 = () => {
      const s = scrollRef?.current;
      const dividerY = dividerYRef?.current;
      if (!s || dividerY == null) {
        return false;
      }
      return s.getScrollTop() + s.getPendingDelta() + s.getViewportHeight() < dividerY;
    };
    $[3] = dividerYRef;
    $[4] = scrollRef;
    $[5] = t6;
  } else {
    t6 = $[5];
  }
  const pillVisible = useSyncExternalStore(subscribe, t6);
  let t7;
  if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
    t7 = [];
    $[6] = t7;
  } else {
    t7 = $[6];
  }
  useLayoutEffect(_temp3, t7);
  if (isFullscreenEnvEnabled()) {
    const sticky = hideSticky ? null : stickyPrompt;
    const headerPrompt = sticky != null && sticky !== "clicked" && overlay == null ? sticky : null;
    const padCollapsed = sticky != null && overlay == null;
    let t8;
    if ($[7] !== headerPrompt) {
      t8 = headerPrompt && <StickyPromptHeader text={headerPrompt.text} onClick={headerPrompt.scrollTo} />;
      $[7] = headerPrompt;
      $[8] = t8;
    } else {
      t8 = $[8];
    }
    const t9 = padCollapsed ? 0 : 1;
    let t10;
    if ($[9] !== scrollable) {
      t10 = <ScrollChromeContext value={chromeCtx}>{scrollable}</ScrollChromeContext>;
      $[9] = scrollable;
      $[10] = t10;
    } else {
      t10 = $[10];
    }
    let t11;
    if ($[11] !== overlay || $[12] !== scrollRef || $[13] !== t10 || $[14] !== t9) {
      t11 = <ScrollBox ref={scrollRef} flexGrow={1} flexDirection="column" paddingTop={t9} stickyScroll={true}>{t10}{overlay}</ScrollBox>;
      $[11] = overlay;
      $[12] = scrollRef;
      $[13] = t10;
      $[14] = t9;
      $[15] = t11;
    } else {
      t11 = $[15];
    }
    let t12;
    if ($[16] !== hidePill || $[17] !== newMessageCount || $[18] !== onPillClick || $[19] !== overlay || $[20] !== pillVisible) {
      t12 = !hidePill && pillVisible && overlay == null && <NewMessagesPill count={newMessageCount} onClick={onPillClick} />;
      $[16] = hidePill;
      $[17] = newMessageCount;
      $[18] = onPillClick;
      $[19] = overlay;
      $[20] = pillVisible;
      $[21] = t12;
    } else {
      t12 = $[21];
    }
    let t13;
    if ($[22] !== bottomFloat) {
      t13 = bottomFloat != null && <Box position="absolute" bottom={0} right={0} opaque={true}>{bottomFloat}</Box>;
      $[22] = bottomFloat;
      $[23] = t13;
    } else {
      t13 = $[23];
    }
    let t14;
    if ($[24] !== t11 || $[25] !== t12 || $[26] !== t13 || $[27] !== t8) {
      t14 = <Box flexGrow={1} flexDirection="column" overflow="hidden">{t8}{t11}{t12}{t13}</Box>;
      $[24] = t11;
      $[25] = t12;
      $[26] = t13;
      $[27] = t8;
      $[28] = t14;
    } else {
      t14 = $[28];
    }
    let t15;
    let t16;
    if ($[29] === Symbol.for("react.memo_cache_sentinel")) {
      t15 = <SuggestionsOverlay />;
      t16 = <DialogOverlay />;
      $[29] = t15;
      $[30] = t16;
    } else {
      t15 = $[29];
      t16 = $[30];
    }
    let t17;
    if ($[31] !== bottom) {
      t17 = <Box flexDirection="column" flexShrink={0} width="100%" maxHeight="50%">{t15}{t16}<Box flexDirection="column" width="100%" flexGrow={1} overflowY="hidden">{bottom}</Box></Box>;
      $[31] = bottom;
      $[32] = t17;
    } else {
      t17 = $[32];
    }
    let t18;
    if ($[33] !== columns || $[34] !== modal || $[35] !== modalScrollRef || $[36] !== terminalRows) {
      t18 = modal != null && <ModalContext value={{
        rows: terminalRows - MODAL_TRANSCRIPT_PEEK - 1,
        columns: columns - 4,
        scrollRef: modalScrollRef ?? null
      }}><Box position="absolute" bottom={0} left={0} right={0} maxHeight={terminalRows - MODAL_TRANSCRIPT_PEEK} flexDirection="column" overflow="hidden" opaque={true}><Box flexShrink={0}><Text color="permission">{"\u2594".repeat(columns)}</Text></Box><Box flexDirection="column" paddingX={2} flexShrink={0} overflow="hidden">{modal}</Box></Box></ModalContext>;
      $[33] = columns;
      $[34] = modal;
      $[35] = modalScrollRef;
      $[36] = terminalRows;
      $[37] = t18;
    } else {
      t18 = $[37];
    }
    let t19;
    if ($[38] !== t14 || $[39] !== t17 || $[40] !== t18) {
      t19 = <PromptOverlayProvider>{t14}{t17}{t18}</PromptOverlayProvider>;
      $[38] = t14;
      $[39] = t17;
      $[40] = t18;
      $[41] = t19;
    } else {
      t19 = $[41];
    }
    return t19;
  }
  let t8;
  if ($[42] !== bottom || $[43] !== modal || $[44] !== overlay || $[45] !== scrollable) {
    t8 = <>{scrollable}{bottom}{overlay}{modal}</>;
    $[42] = bottom;
    $[43] = modal;
    $[44] = overlay;
    $[45] = scrollable;
    $[46] = t8;
  } else {
    t8 = $[46];
  }
  return t8;
}

// Slack-style pill. Absolute overlay at bottom={0} of the scrollwrap — floats
// over the ScrollBox's last content row, only obscuring the centered pill
// text (the rest of the row shows ScrollBox content). Scroll-smear from
// DECSTBM shifting the pill's pixels is repaired at the Ink layer
// (absoluteRectsPrev third-pass in render-node-to-output.ts, #23939). Shows
// "Jump to bottom" when count is 0 (scrolled away but no new messages yet —
// the dead zone where users previously thought chat stalled).
function _temp3() {
  if (!isFullscreenEnvEnabled()) {
    return;
  }
  const ink = instances.get(process.stdout);
  if (!ink) {
    return;
  }
  ink.onHyperlinkClick = _temp2;
  return () => {
    ink.onHyperlinkClick = undefined;
  };
}
function _temp2(url) {
  if (url.startsWith("file:")) {
    try {
      openPath(fileURLToPath(url));
    } catch {}
  } else {
    openBrowser(url);
  }
}
function _temp() {}
function NewMessagesPill(t0) {
  const $ = _c(10);
  const {
    count,
    onClick
  } = t0;
  const [hover, setHover] = useState(false);
  let t1;
  let t2;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = () => setHover(true);
    t2 = () => setHover(false);
    $[0] = t1;
    $[1] = t2;
  } else {
    t1 = $[0];
    t2 = $[1];
  }
  const t3 = hover ? "userMessageBackgroundHover" : "userMessageBackground";
  let t4;
  if ($[2] !== count) {
    t4 = count > 0 ? `${count} new ${plural(count, "message")}` : "Jump to bottom";
    $[2] = count;
    $[3] = t4;
  } else {
    t4 = $[3];
  }
  let t5;
  if ($[4] !== t3 || $[5] !== t4) {
    t5 = <Text backgroundColor={t3} dimColor={true}>{" "}{t4}{" "}{figures.arrowDown}{" "}</Text>;
    $[4] = t3;
    $[5] = t4;
    $[6] = t5;
  } else {
    t5 = $[6];
  }
  let t6;
  if ($[7] !== onClick || $[8] !== t5) {
    t6 = <Box position="absolute" bottom={0} left={0} right={0} justifyContent="center"><Box onClick={onClick} onMouseEnter={t1} onMouseLeave={t2}>{t5}</Box></Box>;
    $[7] = onClick;
    $[8] = t5;
    $[9] = t6;
  } else {
    t6 = $[9];
  }
  return t6;
}

// Context breadcrumb: when scrolled up into history, pin the current
// conversation turn's prompt above the viewport so you know what Claude was
// responding to. Normal-flow sibling BEFORE the ScrollBox (mirrors the pill
// below it) — shrinks the ScrollBox by exactly 1 row via flex, stays outside
// the DECSTBM scroll region. Click jumps back to the prompt.
//
// Height is FIXED at 1 row (truncate-end for long prompts). A variable-height
// header (1 when short, 2 when wrapped) shifts the ScrollBox by 1 row every
// time the sticky prompt switches during scroll — content jumps on screen
// even with scrollTop unchanged (the DECSTBM region top shifts with the
// ScrollBox, and the diff engine sees "everything moved"). Fixed height
// keeps the ScrollBox anchored; only the header TEXT changes, not its box.
function StickyPromptHeader(t0) {
  const $ = _c(8);
  const {
    text,
    onClick
  } = t0;
  const [hover, setHover] = useState(false);
  const t1 = hover ? "userMessageBackgroundHover" : "userMessageBackground";
  let t2;
  let t3;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = () => setHover(true);
    t3 = () => setHover(false);
    $[0] = t2;
    $[1] = t3;
  } else {
    t2 = $[0];
    t3 = $[1];
  }
  let t4;
  if ($[2] !== text) {
    t4 = <Text color="subtle" wrap="truncate-end">{figures.pointer} {text}</Text>;
    $[2] = text;
    $[3] = t4;
  } else {
    t4 = $[3];
  }
  let t5;
  if ($[4] !== onClick || $[5] !== t1 || $[6] !== t4) {
    t5 = <Box flexShrink={0} width="100%" height={1} paddingRight={1} backgroundColor={t1} onClick={onClick} onMouseEnter={t2} onMouseLeave={t3}>{t4}</Box>;
    $[4] = onClick;
    $[5] = t1;
    $[6] = t4;
    $[7] = t5;
  } else {
    t5 = $[7];
  }
  return t5;
}

// Slash-command suggestion overlay — see promptOverlayContext.tsx for why
// it's portaled. Scroll-smear from floating over the DECSTBM region is
// repaired at the Ink layer (absoluteRectsPrev in render-node-to-output.ts).
// The renderer clamps negative y to 0 for absolute elements (see
// render-node-to-output.ts), so the top rows (best matches) stay visible
// even when the overlay extends above the viewport. We omit minHeight and
// flex-end here: they would create empty padding rows that shift visible
// items down into the prompt area when the list has fewer items than max.
function SuggestionsOverlay() {
  const $ = _c(4);
  const data = usePromptOverlay();
  if (!data || data.suggestions.length === 0) {
    return null;
  }
  let t0;
  if ($[0] !== data.maxColumnWidth || $[1] !== data.selectedSuggestion || $[2] !== data.suggestions) {
    t0 = <Box position="absolute" bottom="100%" left={0} right={0} paddingX={2} paddingTop={1} flexDirection="column" opaque={true}><PromptInputFooterSuggestions suggestions={data.suggestions} selectedSuggestion={data.selectedSuggestion} maxColumnWidth={data.maxColumnWidth} overlay={true} /></Box>;
    $[0] = data.maxColumnWidth;
    $[1] = data.selectedSuggestion;
    $[2] = data.suggestions;
    $[3] = t0;
  } else {
    t0 = $[3];
  }
  return t0;
}

// Dialog portaled from PromptInput (AutoModeOptInDialog) — same clip-escape
// pattern as SuggestionsOverlay. Renders later in tree order so it paints
// over suggestions if both are ever up (they shouldn't be).
function DialogOverlay() {
  const $ = _c(2);
  const node = usePromptOverlayDialog();
  if (!node) {
    return null;
  }
  let t0;
  if ($[0] !== node) {
    t0 = <Box position="absolute" bottom="100%" left={0} right={0} opaque={true}>{node}</Box>;
    $[0] = node;
    $[1] = t0;
  } else {
    t0 = $[1];
  }
  return t0;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJjcmVhdGVDb250ZXh0IiwiUmVhY3ROb2RlIiwiUmVmT2JqZWN0IiwidXNlQ2FsbGJhY2siLCJ1c2VFZmZlY3QiLCJ1c2VMYXlvdXRFZmZlY3QiLCJ1c2VNZW1vIiwidXNlUmVmIiwidXNlU3RhdGUiLCJ1c2VTeW5jRXh0ZXJuYWxTdG9yZSIsImZpbGVVUkxUb1BhdGgiLCJNb2RhbENvbnRleHQiLCJQcm9tcHRPdmVybGF5UHJvdmlkZXIiLCJ1c2VQcm9tcHRPdmVybGF5IiwidXNlUHJvbXB0T3ZlcmxheURpYWxvZyIsInVzZVRlcm1pbmFsU2l6ZSIsIlNjcm9sbEJveCIsIlNjcm9sbEJveEhhbmRsZSIsImluc3RhbmNlcyIsIkJveCIsIlRleHQiLCJNZXNzYWdlIiwib3BlbkJyb3dzZXIiLCJvcGVuUGF0aCIsImlzRnVsbHNjcmVlbkVudkVuYWJsZWQiLCJwbHVyYWwiLCJpc051bGxSZW5kZXJpbmdBdHRhY2htZW50IiwiUHJvbXB0SW5wdXRGb290ZXJTdWdnZXN0aW9ucyIsIlN0aWNreVByb21wdCIsIk1PREFMX1RSQU5TQ1JJUFRfUEVFSyIsIlNjcm9sbENocm9tZUNvbnRleHQiLCJzZXRTdGlja3lQcm9tcHQiLCJwIiwiUHJvcHMiLCJzY3JvbGxhYmxlIiwiYm90dG9tIiwib3ZlcmxheSIsImJvdHRvbUZsb2F0IiwibW9kYWwiLCJtb2RhbFNjcm9sbFJlZiIsInNjcm9sbFJlZiIsImRpdmlkZXJZUmVmIiwiaGlkZVBpbGwiLCJoaWRlU3RpY2t5IiwibmV3TWVzc2FnZUNvdW50Iiwib25QaWxsQ2xpY2siLCJ1c2VVbnNlZW5EaXZpZGVyIiwibWVzc2FnZUNvdW50IiwiZGl2aWRlckluZGV4Iiwib25TY3JvbGxBd2F5IiwiaGFuZGxlIiwib25SZXBpbiIsImp1bXBUb05ldyIsInNoaWZ0RGl2aWRlciIsImluZGV4RGVsdGEiLCJoZWlnaHREZWx0YSIsInNldERpdmlkZXJJbmRleCIsImNvdW50UmVmIiwiY3VycmVudCIsIm1heCIsIk1hdGgiLCJnZXRTY3JvbGxIZWlnaHQiLCJnZXRWaWV3cG9ydEhlaWdodCIsImdldFNjcm9sbFRvcCIsImdldFBlbmRpbmdEZWx0YSIsInNjcm9sbFRvQm90dG9tIiwiaWR4IiwiY291bnRVbnNlZW5Bc3Npc3RhbnRUdXJucyIsIm1lc3NhZ2VzIiwiY291bnQiLCJwcmV2V2FzQXNzaXN0YW50IiwiaSIsImxlbmd0aCIsIm0iLCJ0eXBlIiwiYXNzaXN0YW50SGFzVmlzaWJsZVRleHQiLCJpc0Fzc2lzdGFudCIsImIiLCJtZXNzYWdlIiwiY29udGVudCIsInRleHQiLCJ0cmltIiwiVW5zZWVuRGl2aWRlciIsImZpcnN0VW5zZWVuVXVpZCIsImNvbXB1dGVVbnNlZW5EaXZpZGVyIiwidW5kZWZpbmVkIiwiYW5jaG9ySWR4IiwidXVpZCIsIkZ1bGxzY3JlZW5MYXlvdXQiLCJ0MCIsIiQiLCJfYyIsInQxIiwidDIiLCJ0MyIsInJvd3MiLCJ0ZXJtaW5hbFJvd3MiLCJjb2x1bW5zIiwic3RpY2t5UHJvbXB0IiwidDQiLCJTeW1ib2wiLCJmb3IiLCJjaHJvbWVDdHgiLCJ0NSIsImxpc3RlbmVyIiwic3Vic2NyaWJlIiwiX3RlbXAiLCJ0NiIsInMiLCJkaXZpZGVyWSIsInBpbGxWaXNpYmxlIiwidDciLCJfdGVtcDMiLCJzdGlja3kiLCJoZWFkZXJQcm9tcHQiLCJwYWRDb2xsYXBzZWQiLCJ0OCIsInNjcm9sbFRvIiwidDkiLCJ0MTAiLCJ0MTEiLCJ0MTIiLCJ0MTMiLCJ0MTQiLCJ0MTUiLCJ0MTYiLCJ0MTciLCJ0MTgiLCJyZXBlYXQiLCJ0MTkiLCJpbmsiLCJnZXQiLCJwcm9jZXNzIiwic3Rkb3V0Iiwib25IeXBlcmxpbmtDbGljayIsIl90ZW1wMiIsInVybCIsInN0YXJ0c1dpdGgiLCJOZXdNZXNzYWdlc1BpbGwiLCJvbkNsaWNrIiwiaG92ZXIiLCJzZXRIb3ZlciIsImFycm93RG93biIsIlN0aWNreVByb21wdEhlYWRlciIsInBvaW50ZXIiLCJTdWdnZXN0aW9uc092ZXJsYXkiLCJkYXRhIiwic3VnZ2VzdGlvbnMiLCJtYXhDb2x1bW5XaWR0aCIsInNlbGVjdGVkU3VnZ2VzdGlvbiIsIkRpYWxvZ092ZXJsYXkiLCJub2RlIl0sInNvdXJjZXMiOlsiRnVsbHNjcmVlbkxheW91dC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCBSZWFjdCwge1xuICBjcmVhdGVDb250ZXh0LFxuICB0eXBlIFJlYWN0Tm9kZSxcbiAgdHlwZSBSZWZPYmplY3QsXG4gIHVzZUNhbGxiYWNrLFxuICB1c2VFZmZlY3QsXG4gIHVzZUxheW91dEVmZmVjdCxcbiAgdXNlTWVtbyxcbiAgdXNlUmVmLFxuICB1c2VTdGF0ZSxcbiAgdXNlU3luY0V4dGVybmFsU3RvcmUsXG59IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCdcbmltcG9ydCB7IE1vZGFsQ29udGV4dCB9IGZyb20gJy4uL2NvbnRleHQvbW9kYWxDb250ZXh0LmpzJ1xuaW1wb3J0IHtcbiAgUHJvbXB0T3ZlcmxheVByb3ZpZGVyLFxuICB1c2VQcm9tcHRPdmVybGF5LFxuICB1c2VQcm9tcHRPdmVybGF5RGlhbG9nLFxufSBmcm9tICcuLi9jb250ZXh0L3Byb21wdE92ZXJsYXlDb250ZXh0LmpzJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnLi4vaG9va3MvdXNlVGVybWluYWxTaXplLmpzJ1xuaW1wb3J0IFNjcm9sbEJveCwgeyB0eXBlIFNjcm9sbEJveEhhbmRsZSB9IGZyb20gJy4uL2luay9jb21wb25lbnRzL1Njcm9sbEJveC5qcydcbmltcG9ydCBpbnN0YW5jZXMgZnJvbSAnLi4vaW5rL2luc3RhbmNlcy5qcydcbmltcG9ydCB7IEJveCwgVGV4dCB9IGZyb20gJy4uL2luay5qcydcbmltcG9ydCB0eXBlIHsgTWVzc2FnZSB9IGZyb20gJy4uL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQgeyBvcGVuQnJvd3Nlciwgb3BlblBhdGggfSBmcm9tICcuLi91dGlscy9icm93c2VyLmpzJ1xuaW1wb3J0IHsgaXNGdWxsc2NyZWVuRW52RW5hYmxlZCB9IGZyb20gJy4uL3V0aWxzL2Z1bGxzY3JlZW4uanMnXG5pbXBvcnQgeyBwbHVyYWwgfSBmcm9tICcuLi91dGlscy9zdHJpbmdVdGlscy5qcydcbmltcG9ydCB7IGlzTnVsbFJlbmRlcmluZ0F0dGFjaG1lbnQgfSBmcm9tICcuL21lc3NhZ2VzL251bGxSZW5kZXJpbmdBdHRhY2htZW50cy5qcydcbmltcG9ydCBQcm9tcHRJbnB1dEZvb3RlclN1Z2dlc3Rpb25zIGZyb20gJy4vUHJvbXB0SW5wdXQvUHJvbXB0SW5wdXRGb290ZXJTdWdnZXN0aW9ucy5qcydcbmltcG9ydCB0eXBlIHsgU3RpY2t5UHJvbXB0IH0gZnJvbSAnLi9WaXJ0dWFsTWVzc2FnZUxpc3QuanMnXG5cbi8qKiBSb3dzIG9mIHRyYW5zY3JpcHQgY29udGV4dCBrZXB0IHZpc2libGUgYWJvdmUgdGhlIG1vZGFsIHBhbmUncyDilpQgZGl2aWRlci4gKi9cbmNvbnN0IE1PREFMX1RSQU5TQ1JJUFRfUEVFSyA9IDJcblxuLyoqIENvbnRleHQgZm9yIHNjcm9sbC1kZXJpdmVkIGNocm9tZSAoc3RpY2t5IGhlYWRlciwgcGlsbCkuIFN0aWNreVRyYWNrZXJcbiAqICBpbiBWaXJ0dWFsTWVzc2FnZUxpc3Qgd3JpdGVzIHZpYSB0aGlzIGluc3RlYWQgb2YgdGhyZWFkaW5nIGEgY2FsbGJhY2tcbiAqICB1cCB0aHJvdWdoIE1lc3NhZ2VzIOKGkiBSRVBMIOKGkiBGdWxsc2NyZWVuTGF5b3V0LiBUaGUgc2V0dGVyIGlzIHN0YWJsZSBzb1xuICogIGNvbnN1bWluZyB0aGlzIGNvbnRleHQgbmV2ZXIgY2F1c2VzIHJlLXJlbmRlcnMuICovXG5leHBvcnQgY29uc3QgU2Nyb2xsQ2hyb21lQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8e1xuICBzZXRTdGlja3lQcm9tcHQ6IChwOiBTdGlja3lQcm9tcHQgfCBudWxsKSA9PiB2b2lkXG59Pih7IHNldFN0aWNreVByb21wdDogKCkgPT4ge30gfSlcblxudHlwZSBQcm9wcyA9IHtcbiAgLyoqIENvbnRlbnQgdGhhdCBzY3JvbGxzIChtZXNzYWdlcywgdG9vbCBvdXRwdXQpICovXG4gIHNjcm9sbGFibGU6IFJlYWN0Tm9kZVxuICAvKiogQ29udGVudCBwaW5uZWQgdG8gdGhlIGJvdHRvbSAoc3Bpbm5lciwgcHJvbXB0LCBwZXJtaXNzaW9ucykgKi9cbiAgYm90dG9tOiBSZWFjdE5vZGVcbiAgLyoqIENvbnRlbnQgcmVuZGVyZWQgaW5zaWRlIHRoZSBTY3JvbGxCb3ggYWZ0ZXIgbWVzc2FnZXMg4oCUIHVzZXIgY2FuIHNjcm9sbFxuICAgKiAgdXAgdG8gc2VlIGNvbnRleHQgd2hpbGUgaXQncyBzaG93aW5nICh1c2VkIGJ5IFBlcm1pc3Npb25SZXF1ZXN0KS4gKi9cbiAgb3ZlcmxheT86IFJlYWN0Tm9kZVxuICAvKiogQWJzb2x1dGUtcG9zaXRpb25lZCBjb250ZW50IGFuY2hvcmVkIGF0IHRoZSBib3R0b20tcmlnaHQgb2YgdGhlXG4gICAqICBTY3JvbGxCb3ggYXJlYSwgZmxvYXRpbmcgb3ZlciBzY3JvbGxiYWNrLiBSZW5kZXJlZCBpbnNpZGUgdGhlIGZsZXhHcm93XG4gICAqICByZWdpb24gKG5vdCB0aGUgYm90dG9tIHNsb3QpIHNvIHRoZSBvdmVyZmxvd1k6aGlkZGVuIGNhcCBkb2Vzbid0IGNsaXBcbiAgICogIGl0LiBGdWxsc2NyZWVuIG9ubHkg4oCUIHVzZWQgZm9yIHRoZSBjb21wYW5pb24gc3BlZWNoIGJ1YmJsZS4gKi9cbiAgYm90dG9tRmxvYXQ/OiBSZWFjdE5vZGVcbiAgLyoqIFNsYXNoLWNvbW1hbmQgZGlhbG9nIGNvbnRlbnQuIFJlbmRlcmVkIGluIGFuIGFic29sdXRlLXBvc2l0aW9uZWRcbiAgICogIGJvdHRvbS1hbmNob3JlZCBwYW5lICjilpQgZGl2aWRlciwgcGFkZGluZ1g9MikgdGhhdCBwYWludHMgb3ZlciB0aGVcbiAgICogIFNjcm9sbEJveCBBTkQgYm90dG9tIHNsb3QuIFByb3ZpZGVzIE1vZGFsQ29udGV4dCBzbyBQYW5lL0RpYWxvZyBpbnNpZGVcbiAgICogIHNraXAgdGhlaXIgb3duIGZyYW1lLiBGdWxsc2NyZWVuIG9ubHk7IGlubGluZSBhZnRlciBvdmVybGF5IG90aGVyd2lzZS4gKi9cbiAgbW9kYWw/OiBSZWFjdE5vZGVcbiAgLyoqIFJlZiBwYXNzZWQgdmlhIE1vZGFsQ29udGV4dCBzbyBUYWJzIChvciBhbnkgc2Nyb2xsLW93bmluZyBkZXNjZW5kYW50KVxuICAgKiAgY2FuIGF0dGFjaCBpdCB0byB0aGVpciBvd24gU2Nyb2xsQm94IGZvciB0YWxsIGNvbnRlbnQuICovXG4gIG1vZGFsU2Nyb2xsUmVmPzogUmVhY3QuUmVmT2JqZWN0PFNjcm9sbEJveEhhbmRsZSB8IG51bGw+XG4gIC8qKiBSZWYgdG8gdGhlIHNjcm9sbCBib3ggZm9yIGtleWJvYXJkIHNjcm9sbGluZy4gUmVmT2JqZWN0IChub3QgUmVmKSBzb1xuICAgKiAgcGlsbFZpc2libGUncyB1c2VTeW5jRXh0ZXJuYWxTdG9yZSBjYW4gc3Vic2NyaWJlIHRvIHNjcm9sbCBjaGFuZ2VzLiAqL1xuICBzY3JvbGxSZWY/OiBSZWZPYmplY3Q8U2Nyb2xsQm94SGFuZGxlIHwgbnVsbD5cbiAgLyoqIFktcG9zaXRpb24gKHNjcm9sbEhlaWdodCBhdCBzbmFwc2hvdCkgb2YgdGhlIHVuc2Vlbi1kaXZpZGVyLiBQaWxsXG4gICAqICBzaG93cyB3aGlsZSB2aWV3cG9ydCBib3R0b20gaGFzbid0IHJlYWNoZWQgdGhpcy4gUmVmIHNvIFJFUEwgZG9lc24ndFxuICAgKiAgcmUtcmVuZGVyIG9uIHRoZSBvbmUtc2hvdCBzbmFwc2hvdCB3cml0ZS4gKi9cbiAgZGl2aWRlcllSZWY/OiBSZWZPYmplY3Q8bnVtYmVyIHwgbnVsbD5cbiAgLyoqIEZvcmNlLWhpZGUgdGhlIHBpbGwgKGUuZy4gdmlld2luZyBhIHN1Yi1hZ2VudCB0YXNrKS4gKi9cbiAgaGlkZVBpbGw/OiBib29sZWFuXG4gIC8qKiBGb3JjZS1oaWRlIHRoZSBzdGlja3kgcHJvbXB0IGhlYWRlciAoZS5nLiB2aWV3aW5nIGEgdGVhbW1hdGUgdGFzaykuICovXG4gIGhpZGVTdGlja3k/OiBib29sZWFuXG4gIC8qKiBDb3VudCBmb3IgdGhlIHBpbGwgdGV4dC4gMCDihpIgXCJKdW1wIHRvIGJvdHRvbVwiLCA+MCDihpIgXCJOIG5ldyBtZXNzYWdlc1wiLiAqL1xuICBuZXdNZXNzYWdlQ291bnQ/OiBudW1iZXJcbiAgLyoqIENhbGxlZCB3aGVuIHRoZSB1c2VyIGNsaWNrcyB0aGUgXCJOIG5ld1wiIHBpbGwuICovXG4gIG9uUGlsbENsaWNrPzogKCkgPT4gdm9pZFxufVxuXG4vKipcbiAqIFRyYWNrcyB0aGUgaW4tdHJhbnNjcmlwdCBcIk4gbmV3IG1lc3NhZ2VzXCIgZGl2aWRlciBwb3NpdGlvbiB3aGlsZSB0aGVcbiAqIHVzZXIgaXMgc2Nyb2xsZWQgdXAuIFNuYXBzaG90cyBtZXNzYWdlIGNvdW50IEFORCBzY3JvbGxIZWlnaHQgdGhlIGZpcnN0XG4gKiB0aW1lIHN0aWNreSBicmVha3MuIHNjcm9sbEhlaWdodCDiiYggdGhlIHktcG9zaXRpb24gb2YgdGhlIGRpdmlkZXIgaW4gdGhlXG4gKiBzY3JvbGwgY29udGVudCAoaXQgcmVuZGVycyByaWdodCBhZnRlciB0aGUgbGFzdCBtZXNzYWdlIHRoYXQgZXhpc3RlZCBhdFxuICogc25hcHNob3QgdGltZSkuXG4gKlxuICogYHBpbGxWaXNpYmxlYCBsaXZlcyBpbiBGdWxsc2NyZWVuTGF5b3V0IChub3QgaGVyZSkg4oCUIGl0IHN1YnNjcmliZXNcbiAqIGRpcmVjdGx5IHRvIFNjcm9sbEJveCB2aWEgdXNlU3luY0V4dGVybmFsU3RvcmUgd2l0aCBhIGJvb2xlYW4gc25hcHNob3RcbiAqIGFnYWluc3QgYGRpdmlkZXJZUmVmYCwgc28gcGVyLWZyYW1lIHNjcm9sbCBuZXZlciByZS1yZW5kZXJzIFJFUEwuXG4gKiBgZGl2aWRlckluZGV4YCBzdGF5cyBoZXJlIGJlY2F1c2UgUkVQTCBuZWVkcyBpdCBmb3IgY29tcHV0ZVVuc2VlbkRpdmlkZXJcbiAqIOKGkiBNZXNzYWdlcycgZGl2aWRlciBsaW5lOyBpdCBjaGFuZ2VzIG9ubHkgfnR3aWNlL3Njcm9sbC1zZXNzaW9uXG4gKiAoZmlyc3Qgc2Nyb2xsLWF3YXkgKyByZXBpbiksIGFjY2VwdGFibGUgUkVQTCByZS1yZW5kZXIgY29zdC5cbiAqXG4gKiBgb25TY3JvbGxBd2F5YCBtdXN0IGJlIGNhbGxlZCBieSBldmVyeSBzY3JvbGwtYXdheSBhY3Rpb24gd2l0aCB0aGVcbiAqIGhhbmRsZTsgYG9uUmVwaW5gIGJ5IHN1Ym1pdC9zY3JvbGwtdG8tYm90dG9tLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdXNlVW5zZWVuRGl2aWRlcihtZXNzYWdlQ291bnQ6IG51bWJlcik6IHtcbiAgLyoqIEluZGV4IGludG8gbWVzc2FnZXNbXSB3aGVyZSB0aGUgZGl2aWRlciBsaW5lIHJlbmRlcnMuIENsZWFyZWQgb25cbiAgICogIHN0aWNreS1yZXN1bWUgKHNjcm9sbCBiYWNrIHRvIGJvdHRvbSkgc28gdGhlIFwiTiBuZXdcIiBsaW5lIGRvZXNuJ3RcbiAgICogIGxpbmdlciBvbmNlIGV2ZXJ5dGhpbmcgaXMgdmlzaWJsZS4gKi9cbiAgZGl2aWRlckluZGV4OiBudW1iZXIgfCBudWxsXG4gIC8qKiBzY3JvbGxIZWlnaHQgc25hcHNob3QgYXQgZmlyc3Qgc2Nyb2xsLWF3YXkg4oCUIHRoZSBkaXZpZGVyJ3MgeS1wb3NpdGlvbi5cbiAgICogIEZ1bGxzY3JlZW5MYXlvdXQgc3Vic2NyaWJlcyB0byBTY3JvbGxCb3ggYW5kIGNvbXBhcmVzIHZpZXdwb3J0IGJvdHRvbVxuICAgKiAgYWdhaW5zdCB0aGlzIGZvciBwaWxsVmlzaWJsZS4gUmVmIHNvIHdyaXRlcyBkb24ndCByZS1yZW5kZXIgUkVQTC4gKi9cbiAgZGl2aWRlcllSZWY6IFJlZk9iamVjdDxudW1iZXIgfCBudWxsPlxuICBvblNjcm9sbEF3YXk6IChoYW5kbGU6IFNjcm9sbEJveEhhbmRsZSkgPT4gdm9pZFxuICBvblJlcGluOiAoKSA9PiB2b2lkXG4gIC8qKiBTY3JvbGwgdGhlIGhhbmRsZSBzbyB0aGUgZGl2aWRlciBsaW5lIGlzIGF0IHRoZSB0b3Agb2YgdGhlIHZpZXdwb3J0LiAqL1xuICBqdW1wVG9OZXc6IChoYW5kbGU6IFNjcm9sbEJveEhhbmRsZSB8IG51bGwpID0+IHZvaWRcbiAgLyoqIFNoaWZ0IGRpdmlkZXJJbmRleCBhbmQgZGl2aWRlcllSZWYgd2hlbiBtZXNzYWdlcyBhcmUgcHJlcGVuZGVkXG4gICAqICAoaW5maW5pdGUgc2Nyb2xsLWJhY2spLiBpbmRleERlbHRhID0gbnVtYmVyIG9mIG1lc3NhZ2VzIHByZXBlbmRlZDtcbiAgICogIGhlaWdodERlbHRhID0gY29udGVudCBoZWlnaHQgZ3Jvd3RoIGluIHJvd3MuICovXG4gIHNoaWZ0RGl2aWRlcjogKGluZGV4RGVsdGE6IG51bWJlciwgaGVpZ2h0RGVsdGE6IG51bWJlcikgPT4gdm9pZFxufSB7XG4gIGNvbnN0IFtkaXZpZGVySW5kZXgsIHNldERpdmlkZXJJbmRleF0gPSB1c2VTdGF0ZTxudW1iZXIgfCBudWxsPihudWxsKVxuICAvLyBSZWYgaG9sZHMgdGhlIGN1cnJlbnQgY291bnQgZm9yIG9uU2Nyb2xsQXdheSB0byBzbmFwc2hvdC4gV3JpdHRlbiBpblxuICAvLyB0aGUgcmVuZGVyIGJvZHkgKG5vdCB1c2VFZmZlY3QpIHNvIHdoZWVsIGV2ZW50cyBhcnJpdmluZyBiZXR3ZWVuIGFcbiAgLy8gbWVzc2FnZS1hcHBlbmQgcmVuZGVyIGFuZCBpdHMgZWZmZWN0IGZsdXNoIGRvbid0IGNhcHR1cmUgYSBzdGFsZVxuICAvLyBjb3VudCAob2ZmLWJ5LW9uZSBpbiB0aGUgYmFzZWxpbmUpLiBSZWFjdCBDb21waWxlciBiYWlscyBvdXQgaGVyZSDigJRcbiAgLy8gYWNjZXB0YWJsZSBmb3IgYSBob29rIGluc3RhbnRpYXRlZCBvbmNlIGluIFJFUEwuXG4gIGNvbnN0IGNvdW50UmVmID0gdXNlUmVmKG1lc3NhZ2VDb3VudClcbiAgY291bnRSZWYuY3VycmVudCA9IG1lc3NhZ2VDb3VudFxuICAvLyBzY3JvbGxIZWlnaHQgc25hcHNob3Qg4oCUIHRoZSBkaXZpZGVyJ3MgeSBpbiBjb250ZW50IGNvb3Jkcy4gUmVmLW9ubHk6XG4gIC8vIHJlYWQgc3luY2hyb25vdXNseSBpbiBvblNjcm9sbEF3YXkgKHNldFN0YXRlIGlzIGJhdGNoZWQsIGNhbid0XG4gIC8vIHJlYWQtdGhlbi13cml0ZSBpbiB0aGUgc2FtZSBjYWxsYmFjaykgQU5EIGJ5IEZ1bGxzY3JlZW5MYXlvdXQnc1xuICAvLyBwaWxsVmlzaWJsZSBzdWJzY3JpcHRpb24uIG51bGwgPSBwaW5uZWQgdG8gYm90dG9tLlxuICBjb25zdCBkaXZpZGVyWVJlZiA9IHVzZVJlZjxudW1iZXIgfCBudWxsPihudWxsKVxuXG4gIGNvbnN0IG9uUmVwaW4gPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgLy8gRG9uJ3QgY2xlYXIgZGl2aWRlcllSZWYgaGVyZSDigJQgYSB0cmFja3BhZCBtb21lbnR1bSB3aGVlbCBldmVudFxuICAgIC8vIHJhY2luZyBpbiB0aGUgc2FtZSBzdGRpbiBiYXRjaCB3b3VsZCBzZWUgbnVsbCBhbmQgcmUtc25hcHNob3QsXG4gICAgLy8gb3ZlcnJpZGluZyB0aGUgc2V0RGl2aWRlckluZGV4KG51bGwpIGJlbG93LiBUaGUgdXNlRWZmZWN0IGJlbG93XG4gICAgLy8gY2xlYXJzIHRoZSByZWYgYWZ0ZXIgUmVhY3QgY29tbWl0cyB0aGUgbnVsbCBkaXZpZGVySW5kZXgsIHNvIHRoZVxuICAgIC8vIHJlZiBzdGF5cyBub24tbnVsbCB1bnRpbCB0aGUgc3RhdGUgc2V0dGxlcy5cbiAgICBzZXREaXZpZGVySW5kZXgobnVsbClcbiAgfSwgW10pXG5cbiAgY29uc3Qgb25TY3JvbGxBd2F5ID0gdXNlQ2FsbGJhY2soKGhhbmRsZTogU2Nyb2xsQm94SGFuZGxlKSA9PiB7XG4gICAgLy8gTm90aGluZyBiZWxvdyB0aGUgdmlld3BvcnQg4oaSIG5vdGhpbmcgdG8ganVtcCB0by4gQ292ZXJzIGJvdGg6XG4gICAgLy8g4oCiIGVtcHR5L3Nob3J0IHNlc3Npb246IHNjcm9sbFVwIGNhbGxzIHNjcm9sbFRvKDApIHdoaWNoIGJyZWFrcyBzdGlja3lcbiAgICAvLyAgIGV2ZW4gYXQgc2Nyb2xsVG9wPTAgKHdoZWVsLXVwIG9uIGZyZXNoIHNlc3Npb24gc2hvd2VkIHRoZSBwaWxsKVxuICAgIC8vIOKAoiBjbGljay10by1zZWxlY3QgYXQgYm90dG9tOiB1c2VEcmFnVG9TY3JvbGwuY2hlY2soKSBjYWxsc1xuICAgIC8vICAgc2Nyb2xsVG8oY3VycmVudCkgdG8gYnJlYWsgc3RpY2t5IHNvIHN0cmVhbWluZyBjb250ZW50IGRvZXNuJ3Qgc2hpZnRcbiAgICAvLyAgIHVuZGVyIHRoZSBzZWxlY3Rpb24sIHRoZW4gb25TY3JvbGwoZmFsc2UsIOKApikg4oCUIGJ1dCBzY3JvbGxUb3AgaXMgc3RpbGxcbiAgICAvLyAgIGF0IG1heCAoU2FyYWggRGVhdG9uLCAjY2xhdWRlLWNvZGUtZmVlZGJhY2sgMjAyNi0wMy0xNSlcbiAgICAvLyBwZW5kaW5nRGVsdGE6IHNjcm9sbEJ5IGFjY3VtdWxhdGVzIHdpdGhvdXQgdXBkYXRpbmcgc2Nyb2xsVG9wLiBXaXRob3V0XG4gICAgLy8gaXQsIHdoZWVsaW5nIHVwIGZyb20gbWF4IHdvdWxkIHNlZSBzY3JvbGxUb3A9PW1heCBhbmQgc3VwcHJlc3MgdGhlIHBpbGwuXG4gICAgY29uc3QgbWF4ID0gTWF0aC5tYXgoXG4gICAgICAwLFxuICAgICAgaGFuZGxlLmdldFNjcm9sbEhlaWdodCgpIC0gaGFuZGxlLmdldFZpZXdwb3J0SGVpZ2h0KCksXG4gICAgKVxuICAgIGlmIChoYW5kbGUuZ2V0U2Nyb2xsVG9wKCkgKyBoYW5kbGUuZ2V0UGVuZGluZ0RlbHRhKCkgPj0gbWF4KSByZXR1cm5cbiAgICAvLyBTbmFwc2hvdCBvbmx5IG9uIHRoZSBGSVJTVCBzY3JvbGwtYXdheS4gb25TY3JvbGxBd2F5IGZpcmVzIG9uIEVWRVJZXG4gICAgLy8gc2Nyb2xsIGFjdGlvbiAobm90IGp1c3QgdGhlIGluaXRpYWwgYnJlYWsgZnJvbSBzdGlja3kpIOKAlCB0aGlzIGd1YXJkXG4gICAgLy8gcHJlc2VydmVzIHRoZSBvcmlnaW5hbCBiYXNlbGluZSBzbyB0aGUgY291bnQgZG9lc24ndCByZXNldCBvbiB0aGVcbiAgICAvLyBzZWNvbmQgUGFnZVVwLiBTdWJzZXF1ZW50IGNhbGxzIGFyZSByZWYtb25seSBuby1vcHMgKG5vIFJFUEwgcmUtcmVuZGVyKS5cbiAgICBpZiAoZGl2aWRlcllSZWYuY3VycmVudCA9PT0gbnVsbCkge1xuICAgICAgZGl2aWRlcllSZWYuY3VycmVudCA9IGhhbmRsZS5nZXRTY3JvbGxIZWlnaHQoKVxuICAgICAgLy8gTmV3IHNjcm9sbC1hd2F5IHNlc3Npb24g4oaSIG1vdmUgdGhlIGRpdmlkZXIgaGVyZSAocmVwbGFjZXMgb2xkIG9uZSlcbiAgICAgIHNldERpdmlkZXJJbmRleChjb3VudFJlZi5jdXJyZW50KVxuICAgIH1cbiAgfSwgW10pXG5cbiAgY29uc3QganVtcFRvTmV3ID0gdXNlQ2FsbGJhY2soKGhhbmRsZTogU2Nyb2xsQm94SGFuZGxlIHwgbnVsbCkgPT4ge1xuICAgIGlmICghaGFuZGxlKSByZXR1cm5cbiAgICAvLyBzY3JvbGxUb0JvdHRvbSAobm90IHNjcm9sbFRvKGRpdmlkZXJZKSk6IHNldHMgc3RpY2t5U2Nyb2xsPXRydWUgc29cbiAgICAvLyB1c2VWaXJ0dWFsU2Nyb2xsIG1vdW50cyB0aGUgdGFpbCBhbmQgcmVuZGVyLW5vZGUtdG8tb3V0cHV0IHBpbnNcbiAgICAvLyBzY3JvbGxUb3A9bWF4U2Nyb2xsLiBzY3JvbGxUbyBzZXRzIHN0aWNreVNjcm9sbD1mYWxzZSDihpIgdGhlIGNsYW1wXG4gICAgLy8gKHN0aWxsIGF0IHRvcC1yYW5nZSBib3VuZHMgYmVmb3JlIFJlYWN0IHJlLXJlbmRlcnMpIHBpbnMgc2Nyb2xsVG9wXG4gICAgLy8gYmFjaywgc3RvcHBpbmcgc2hvcnQuIFRoZSBkaXZpZGVyIHN0YXlzIHJlbmRlcmVkIChkaXZpZGVySW5kZXhcbiAgICAvLyB1bmNoYW5nZWQpIHNvIHVzZXJzIHNlZSB3aGVyZSBuZXcgbWVzc2FnZXMgc3RhcnRlZDsgdGhlIGNsZWFyIG9uXG4gICAgLy8gbmV4dCBzdWJtaXQvZXhwbGljaXQgc2Nyb2xsLXRvLWJvdHRvbSBoYW5kbGVzIGNsZWFudXAuXG4gICAgaGFuZGxlLnNjcm9sbFRvQm90dG9tKClcbiAgfSwgW10pXG5cbiAgLy8gU3luYyBkaXZpZGVyWVJlZiB3aXRoIGRpdmlkZXJJbmRleC4gV2hlbiBvblJlcGluIGZpcmVzIChzdWJtaXQsXG4gIC8vIHNjcm9sbC10by1ib3R0b20pLCBpdCBzZXRzIGRpdmlkZXJJbmRleD1udWxsIGJ1dCBsZWF2ZXMgdGhlIHJlZlxuICAvLyBub24tbnVsbCDigJQgYSB3aGVlbCBldmVudCByYWNpbmcgaW4gdGhlIHNhbWUgc3RkaW4gYmF0Y2ggd291bGRcbiAgLy8gb3RoZXJ3aXNlIHNlZSBudWxsIGFuZCByZS1zbmFwc2hvdC4gRGVmZXJyaW5nIHRoZSByZWYgY2xlYXIgdG9cbiAgLy8gdXNlRWZmZWN0IGd1YXJhbnRlZXMgdGhlIHJlZiBzdGF5cyBub24tbnVsbCB1bnRpbCBSZWFjdCBoYXMgY29tbWl0dGVkXG4gIC8vIHRoZSBudWxsIGRpdmlkZXJJbmRleCwgYmxvY2tpbmcgdGhlIGlmLW51bGwgZ3VhcmQgaW4gb25TY3JvbGxBd2F5LlxuICAvL1xuICAvLyBBbHNvIGhhbmRsZXMgL2NsZWFyLCByZXdpbmQsIHRlYW1tYXRlLXZpZXcgc3dhcCDigJQgaWYgdGhlIGNvdW50IGRyb3BzXG4gIC8vIGJlbG93IHRoZSBkaXZpZGVyIGluZGV4LCB0aGUgZGl2aWRlciB3b3VsZCBwb2ludCBhdCBub3RoaW5nLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChkaXZpZGVySW5kZXggPT09IG51bGwpIHtcbiAgICAgIGRpdmlkZXJZUmVmLmN1cnJlbnQgPSBudWxsXG4gICAgfSBlbHNlIGlmIChtZXNzYWdlQ291bnQgPCBkaXZpZGVySW5kZXgpIHtcbiAgICAgIGRpdmlkZXJZUmVmLmN1cnJlbnQgPSBudWxsXG4gICAgICBzZXREaXZpZGVySW5kZXgobnVsbClcbiAgICB9XG4gIH0sIFttZXNzYWdlQ291bnQsIGRpdmlkZXJJbmRleF0pXG5cbiAgY29uc3Qgc2hpZnREaXZpZGVyID0gdXNlQ2FsbGJhY2soXG4gICAgKGluZGV4RGVsdGE6IG51bWJlciwgaGVpZ2h0RGVsdGE6IG51bWJlcikgPT4ge1xuICAgICAgc2V0RGl2aWRlckluZGV4KGlkeCA9PiAoaWR4ID09PSBudWxsID8gbnVsbCA6IGlkeCArIGluZGV4RGVsdGEpKVxuICAgICAgaWYgKGRpdmlkZXJZUmVmLmN1cnJlbnQgIT09IG51bGwpIHtcbiAgICAgICAgZGl2aWRlcllSZWYuY3VycmVudCArPSBoZWlnaHREZWx0YVxuICAgICAgfVxuICAgIH0sXG4gICAgW10sXG4gIClcblxuICByZXR1cm4ge1xuICAgIGRpdmlkZXJJbmRleCxcbiAgICBkaXZpZGVyWVJlZixcbiAgICBvblNjcm9sbEF3YXksXG4gICAgb25SZXBpbixcbiAgICBqdW1wVG9OZXcsXG4gICAgc2hpZnREaXZpZGVyLFxuICB9XG59XG5cbi8qKlxuICogQ291bnRzIGFzc2lzdGFudCB0dXJucyBpbiBtZXNzYWdlc1tkaXZpZGVySW5kZXguLmVuZCkuIEEgXCJ0dXJuXCIgaXMgd2hhdFxuICogdXNlcnMgdGhpbmsgb2YgYXMgXCJhIG5ldyBtZXNzYWdlIGZyb20gQ2xhdWRlXCIg4oCUIG5vdCByYXcgYXNzaXN0YW50IGVudHJpZXNcbiAqIChvbmUgdHVybiB5aWVsZHMgbXVsdGlwbGUgZW50cmllczogdG9vbF91c2UgYmxvY2tzICsgdGV4dCBibG9ja3MpLiBXZSBjb3VudFxuICogbm9uLWFzc2lzdGFudOKGkmFzc2lzdGFudCB0cmFuc2l0aW9ucywgYnV0IG9ubHkgZm9yIGVudHJpZXMgdGhhdCBhY3R1YWxseVxuICogY2FycnkgdGV4dCDigJQgdG9vbC11c2Utb25seSBlbnRyaWVzIGFyZSBza2lwcGVkIChsaWtlIHByb2dyZXNzIG1lc3NhZ2VzKVxuICogc28gXCLij7ogU2VhcmNoZWQgZm9yIDEzIHBhdHRlcm5zLCByZWFkIDYgZmlsZXNcIiBkb2Vzbid0IHRpY2sgdGhlIHBpbGwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb3VudFVuc2VlbkFzc2lzdGFudFR1cm5zKFxuICBtZXNzYWdlczogcmVhZG9ubHkgTWVzc2FnZVtdLFxuICBkaXZpZGVySW5kZXg6IG51bWJlcixcbik6IG51bWJlciB7XG4gIGxldCBjb3VudCA9IDBcbiAgbGV0IHByZXZXYXNBc3Npc3RhbnQgPSBmYWxzZVxuICBmb3IgKGxldCBpID0gZGl2aWRlckluZGV4OyBpIDwgbWVzc2FnZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBtID0gbWVzc2FnZXNbaV0hXG4gICAgaWYgKG0udHlwZSA9PT0gJ3Byb2dyZXNzJykgY29udGludWVcbiAgICAvLyBUb29sLXVzZS1vbmx5IGFzc2lzdGFudCBlbnRyaWVzIGFyZW4ndCBcIm5ldyBtZXNzYWdlc1wiIHRvIHRoZSB1c2VyIOKAlFxuICAgIC8vIHNraXAgdGhlbSB0aGUgc2FtZSB3YXkgd2Ugc2tpcCBwcm9ncmVzcy4gcHJldldhc0Fzc2lzdGFudCBpcyBOT1RcbiAgICAvLyB1cGRhdGVkLCBzbyBhIHRleHQgYmxvY2sgaW1tZWRpYXRlbHkgZm9sbG93aW5nIHN0aWxsIGNvdW50cyBhcyB0aGVcbiAgICAvLyBzYW1lIHR1cm4gKHRvb2xfdXNlICsgdGV4dCBmcm9tIG9uZSBBUEkgcmVzcG9uc2UgPSAxKS5cbiAgICBpZiAobS50eXBlID09PSAnYXNzaXN0YW50JyAmJiAhYXNzaXN0YW50SGFzVmlzaWJsZVRleHQobSkpIGNvbnRpbnVlXG4gICAgY29uc3QgaXNBc3Npc3RhbnQgPSBtLnR5cGUgPT09ICdhc3Npc3RhbnQnXG4gICAgaWYgKGlzQXNzaXN0YW50ICYmICFwcmV2V2FzQXNzaXN0YW50KSBjb3VudCsrXG4gICAgcHJldldhc0Fzc2lzdGFudCA9IGlzQXNzaXN0YW50XG4gIH1cbiAgcmV0dXJuIGNvdW50XG59XG5cbmZ1bmN0aW9uIGFzc2lzdGFudEhhc1Zpc2libGVUZXh0KG06IE1lc3NhZ2UpOiBib29sZWFuIHtcbiAgaWYgKG0udHlwZSAhPT0gJ2Fzc2lzdGFudCcpIHJldHVybiBmYWxzZVxuICBmb3IgKGNvbnN0IGIgb2YgbS5tZXNzYWdlLmNvbnRlbnQpIHtcbiAgICBpZiAoYi50eXBlID09PSAndGV4dCcgJiYgYi50ZXh0LnRyaW0oKSAhPT0gJycpIHJldHVybiB0cnVlXG4gIH1cbiAgcmV0dXJuIGZhbHNlXG59XG5cbmV4cG9ydCB0eXBlIFVuc2VlbkRpdmlkZXIgPSB7IGZpcnN0VW5zZWVuVXVpZDogTWVzc2FnZVsndXVpZCddOyBjb3VudDogbnVtYmVyIH1cblxuLyoqXG4gKiBCdWlsZHMgdGhlIHVuc2VlbkRpdmlkZXIgb2JqZWN0IFJFUEwgcGFzc2VzIHRvIE1lc3NhZ2VzICsgdGhlIHBpbGwuXG4gKiBSZXR1cm5zIHVuZGVmaW5lZCBvbmx5IHdoZW4gbm8gY29udGVudCBoYXMgYXJyaXZlZCBwYXN0IHRoZSBkaXZpZGVyXG4gKiB5ZXQgKG1lc3NhZ2VzW2RpdmlkZXJJbmRleF0gZG9lc24ndCBleGlzdCkuIE9uY2UgQU5ZIG1lc3NhZ2UgYXJyaXZlc1xuICog4oCUIGluY2x1ZGluZyB0b29sX3VzZS1vbmx5IGFzc2lzdGFudCBlbnRyaWVzIGFuZCB0b29sX3Jlc3VsdCB1c2VyIGVudHJpZXNcbiAqIHRoYXQgY291bnRVbnNlZW5Bc3Npc3RhbnRUdXJucyBza2lwcyDigJQgY291bnQgZmxvb3JzIGF0IDEgc28gdGhlIHBpbGxcbiAqIGZsaXBzIGZyb20gXCJKdW1wIHRvIGJvdHRvbVwiIHRvIFwiMSBuZXcgbWVzc2FnZVwiLiBXaXRob3V0IHRoZSBmbG9vcixcbiAqIHRoZSBwaWxsIHN0YXlzIFwiSnVtcCB0byBib3R0b21cIiB0aHJvdWdoIGFuIGVudGlyZSB0b29sLWNhbGwgc2VxdWVuY2VcbiAqIHVudGlsIENsYXVkZSdzIHRleHQgcmVzcG9uc2UgbGFuZHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlVW5zZWVuRGl2aWRlcihcbiAgbWVzc2FnZXM6IHJlYWRvbmx5IE1lc3NhZ2VbXSxcbiAgZGl2aWRlckluZGV4OiBudW1iZXIgfCBudWxsLFxuKTogVW5zZWVuRGl2aWRlciB8IHVuZGVmaW5lZCB7XG4gIGlmIChkaXZpZGVySW5kZXggPT09IG51bGwpIHJldHVybiB1bmRlZmluZWRcbiAgLy8gU2tpcCBwcm9ncmVzcyBhbmQgbnVsbC1yZW5kZXJpbmcgYXR0YWNobWVudHMgd2hlbiBwaWNraW5nIHRoZSBkaXZpZGVyXG4gIC8vIGFuY2hvciDigJQgTWVzc2FnZXMudHN4IGZpbHRlcnMgdGhlc2Ugb3V0IG9mIHJlbmRlcmFibGVNZXNzYWdlcyBiZWZvcmUgdGhlXG4gIC8vIGRpdmlkZXJCZWZvcmVJbmRleCBzZWFyY2gsIHNvIHRoZWlyIFVVSUQgd291bGRuJ3QgYmUgZm91bmQgKENDLTcyNCkuXG4gIC8vIEhvb2sgYXR0YWNobWVudHMgdXNlIHJhbmRvbVVVSUQoKSBzbyBub3RoaW5nIHNoYXJlcyB0aGVpciAyNC1jaGFyIHByZWZpeC5cbiAgbGV0IGFuY2hvcklkeCA9IGRpdmlkZXJJbmRleFxuICB3aGlsZSAoXG4gICAgYW5jaG9ySWR4IDwgbWVzc2FnZXMubGVuZ3RoICYmXG4gICAgKG1lc3NhZ2VzW2FuY2hvcklkeF0/LnR5cGUgPT09ICdwcm9ncmVzcycgfHxcbiAgICAgIGlzTnVsbFJlbmRlcmluZ0F0dGFjaG1lbnQobWVzc2FnZXNbYW5jaG9ySWR4XSEpKVxuICApIHtcbiAgICBhbmNob3JJZHgrK1xuICB9XG4gIGNvbnN0IHV1aWQgPSBtZXNzYWdlc1thbmNob3JJZHhdPy51dWlkXG4gIGlmICghdXVpZCkgcmV0dXJuIHVuZGVmaW5lZFxuICBjb25zdCBjb3VudCA9IGNvdW50VW5zZWVuQXNzaXN0YW50VHVybnMobWVzc2FnZXMsIGRpdmlkZXJJbmRleClcbiAgcmV0dXJuIHsgZmlyc3RVbnNlZW5VdWlkOiB1dWlkLCBjb3VudDogTWF0aC5tYXgoMSwgY291bnQpIH1cbn1cblxuLyoqXG4gKiBMYXlvdXQgd3JhcHBlciBmb3IgdGhlIFJFUEwuIEluIGZ1bGxzY3JlZW4gbW9kZSwgcHV0cyBzY3JvbGxhYmxlXG4gKiBjb250ZW50IGluIGEgc3RpY2t5LXNjcm9sbCBib3ggYW5kIHBpbnMgYm90dG9tIGNvbnRlbnQgdmlhIGZsZXhib3guXG4gKiBPdXRzaWRlIGZ1bGxzY3JlZW4gbW9kZSwgcmVuZGVycyBjb250ZW50IHNlcXVlbnRpYWxseSBzbyB0aGUgZXhpc3RpbmdcbiAqIG1haW4tc2NyZWVuIHNjcm9sbGJhY2sgcmVuZGVyaW5nIHdvcmtzIHVuY2hhbmdlZC5cbiAqXG4gKiBGdWxsc2NyZWVuIG1vZGUgZGVmYXVsdHMgb24gZm9yIGFudHMgKENMQVVERV9DT0RFX05PX0ZMSUNLRVI9MCB0byBvcHQgb3V0KVxuICogYW5kIG9mZiBmb3IgZXh0ZXJuYWwgdXNlcnMgKENMQVVERV9DT0RFX05PX0ZMSUNLRVI9MSB0byBvcHQgaW4pLlxuICogVGhlIDxBbHRlcm5hdGVTY3JlZW4+IHdyYXBwZXJcbiAqIChhbHQgYnVmZmVyICsgbW91c2UgdHJhY2tpbmcgKyBoZWlnaHQgY29uc3RyYWludCkgbGl2ZXMgYXQgUkVQTCdzIHJvb3RcbiAqIHNvIG5vdGhpbmcgY2FuIGFjY2lkZW50YWxseSByZW5kZXIgb3V0c2lkZSBpdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIEZ1bGxzY3JlZW5MYXlvdXQoe1xuICBzY3JvbGxhYmxlLFxuICBib3R0b20sXG4gIG92ZXJsYXksXG4gIGJvdHRvbUZsb2F0LFxuICBtb2RhbCxcbiAgbW9kYWxTY3JvbGxSZWYsXG4gIHNjcm9sbFJlZixcbiAgZGl2aWRlcllSZWYsXG4gIGhpZGVQaWxsID0gZmFsc2UsXG4gIGhpZGVTdGlja3kgPSBmYWxzZSxcbiAgbmV3TWVzc2FnZUNvdW50ID0gMCxcbiAgb25QaWxsQ2xpY2ssXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHsgcm93czogdGVybWluYWxSb3dzLCBjb2x1bW5zIH0gPSB1c2VUZXJtaW5hbFNpemUoKVxuICAvLyBTY3JvbGwtZGVyaXZlZCBjaHJvbWUgc3RhdGUgbGl2ZXMgSEVSRSwgbm90IGluIFJFUEwuIFN0aWNreVRyYWNrZXJcbiAgLy8gd3JpdGVzIHZpYSBTY3JvbGxDaHJvbWVDb250ZXh0OyBwaWxsVmlzaWJsZSBzdWJzY3JpYmVzIGRpcmVjdGx5IHRvXG4gIC8vIFNjcm9sbEJveC4gQm90aCBjaGFuZ2UgcmFyZWx5IChwaWxsIGZsaXBzIG9uY2UgcGVyIHRocmVzaG9sZCBjcm9zc2luZyxcbiAgLy8gc3RpY2t5IGNoYW5nZXMgfjUtMjDDly90cmFuc2NyaXB0KSDigJQgcmUtcmVuZGVyaW5nIEZ1bGxzY3JlZW5MYXlvdXQgb25cbiAgLy8gdGhvc2UgaXMgZmluZTsgcmUtcmVuZGVyaW5nIHRoZSA2OTY2LWxpbmUgUkVQTCArIGl0cyAyMisgdXNlQXBwU3RhdGVcbiAgLy8gc2VsZWN0b3JzIHBlci1zY3JvbGwtZnJhbWUgd2FzIG5vdC5cbiAgY29uc3QgW3N0aWNreVByb21wdCwgc2V0U3RpY2t5UHJvbXB0XSA9IHVzZVN0YXRlPFN0aWNreVByb21wdCB8IG51bGw+KG51bGwpXG4gIGNvbnN0IGNocm9tZUN0eCA9IHVzZU1lbW8oKCkgPT4gKHsgc2V0U3RpY2t5UHJvbXB0IH0pLCBbXSlcbiAgLy8gQm9vbGVhbi1xdWFudGl6ZWQgc2Nyb2xsIHN1YnNjcmlwdGlvbi4gU25hcHNob3QgaXMgXCJpcyB2aWV3cG9ydCBib3R0b21cbiAgLy8gYWJvdmUgdGhlIGRpdmlkZXIgeT9cIiDigJQgT2JqZWN0LmlzIG9uIGEgYm9vbGVhbiDihpIgRnVsbHNjcmVlbkxheW91dCBvbmx5XG4gIC8vIHJlLXJlbmRlcnMgd2hlbiB0aGUgcGlsbCBzaG91bGQgYWN0dWFsbHkgZmxpcCwgbm90IHBlci1mcmFtZS5cbiAgY29uc3Qgc3Vic2NyaWJlID0gdXNlQ2FsbGJhY2soXG4gICAgKGxpc3RlbmVyOiAoKSA9PiB2b2lkKSA9PlxuICAgICAgc2Nyb2xsUmVmPy5jdXJyZW50Py5zdWJzY3JpYmUobGlzdGVuZXIpID8/ICgoKSA9PiB7fSksXG4gICAgW3Njcm9sbFJlZl0sXG4gIClcbiAgY29uc3QgcGlsbFZpc2libGUgPSB1c2VTeW5jRXh0ZXJuYWxTdG9yZShzdWJzY3JpYmUsICgpID0+IHtcbiAgICBjb25zdCBzID0gc2Nyb2xsUmVmPy5jdXJyZW50XG4gICAgY29uc3QgZGl2aWRlclkgPSBkaXZpZGVyWVJlZj8uY3VycmVudFxuICAgIGlmICghcyB8fCBkaXZpZGVyWSA9PSBudWxsKSByZXR1cm4gZmFsc2VcbiAgICByZXR1cm4gKFxuICAgICAgcy5nZXRTY3JvbGxUb3AoKSArIHMuZ2V0UGVuZGluZ0RlbHRhKCkgKyBzLmdldFZpZXdwb3J0SGVpZ2h0KCkgPCBkaXZpZGVyWVxuICAgIClcbiAgfSlcbiAgLy8gV2lyZSB1cCBoeXBlcmxpbmsgY2xpY2sgaGFuZGxpbmcg4oCUIGluIGZ1bGxzY3JlZW4gbW9kZSwgbW91c2UgdHJhY2tpbmdcbiAgLy8gaW50ZXJjZXB0cyBjbGlja3MgYmVmb3JlIHRoZSB0ZXJtaW5hbCBjYW4gb3BlbiBPU0MgOCBsaW5rcyBuYXRpdmVseS5cbiAgdXNlTGF5b3V0RWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKSkgcmV0dXJuXG4gICAgY29uc3QgaW5rID0gaW5zdGFuY2VzLmdldChwcm9jZXNzLnN0ZG91dClcbiAgICBpZiAoIWluaykgcmV0dXJuXG4gICAgaW5rLm9uSHlwZXJsaW5rQ2xpY2sgPSB1cmwgPT4ge1xuICAgICAgLy8gTW9zdCBPU0MgOCBsaW5rcyBlbWl0dGVkIGJ5IENsYXVkZSBDb2RlIGFyZSBmaWxlOi8vIFVSTHMgZnJvbVxuICAgICAgLy8gRmlsZVBhdGhMaW5rIChGaWxlRWRpdC9GaWxlV3JpdGUvRmlsZVJlYWQgdG9vbCBvdXRwdXQpLiBvcGVuQnJvd3NlclxuICAgICAgLy8gcmVqZWN0cyBub24taHR0cChzKSBwcm90b2NvbHMg4oCUIHJvdXRlIGZpbGU6IHRvIG9wZW5QYXRoIGluc3RlYWQuXG4gICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2ZpbGU6JykpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2b2lkIG9wZW5QYXRoKGZpbGVVUkxUb1BhdGgodXJsKSlcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gTWFsZm9ybWVkIGZpbGU6IFVSTHMgKGUuZy4gZmlsZTovL2hvc3QvcGF0aCBmcm9tIHBsYWluLXRleHRcbiAgICAgICAgICAvLyBkZXRlY3Rpb24pIGNhdXNlIGZpbGVVUkxUb1BhdGggdG8gdGhyb3cg4oCUIGlnbm9yZSBzaWxlbnRseS5cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdm9pZCBvcGVuQnJvd3Nlcih1cmwpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBpbmsub25IeXBlcmxpbmtDbGljayA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSwgW10pXG5cbiAgaWYgKGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKSkge1xuICAgIC8vIE92ZXJsYXkgcmVuZGVycyBCRUxPVyBtZXNzYWdlcyBpbnNpZGUgdGhlIHNhbWUgU2Nyb2xsQm94IOKAlCB1c2VyIGNhblxuICAgIC8vIHNjcm9sbCB1cCB0byBzZWUgcHJpb3IgY29udGV4dCB3aGlsZSBhIHBlcm1pc3Npb24gZGlhbG9nIGlzIHNob3dpbmcuXG4gICAgLy8gVGhlIFNjcm9sbEJveCBuZXZlciB1bm1vdW50cyBhY3Jvc3Mgb3ZlcmxheSB0cmFuc2l0aW9ucywgc28gc2Nyb2xsXG4gICAgLy8gcG9zaXRpb24gaXMgcHJlc2VydmVkIHdpdGhvdXQgc2F2ZS9yZXN0b3JlLiBzdGlja3lTY3JvbGwgYXV0by1zY3JvbGxzXG4gICAgLy8gdG8gdGhlIGFwcGVuZGVkIG92ZXJsYXkgd2hlbiBpdCBtb3VudHMgKGlmIHVzZXIgd2FzIGFscmVhZHkgYXRcbiAgICAvLyBib3R0b20pOyBSRVBMIHJlLXBpbnMgb24gdGhlIG92ZXJsYXkgYXBwZWFyL2Rpc21pc3MgdHJhbnNpdGlvbiBmb3JcbiAgICAvLyB0aGUgY2FzZSB3aGVyZSBzdGlja3kgd2FzIGJyb2tlbi4gVGFsbCBkaWFsb2dzIChGaWxlRWRpdCBkaWZmcykgc3RpbGxcbiAgICAvLyBnZXQgUGdVcC9QZ0RuL3doZWVsIOKAlCBzYW1lIHNjcm9sbFJlZiBkcml2ZXMgdGhlIHNhbWUgU2Nyb2xsQm94LlxuICAgIC8vIFRocmVlIHN0aWNreSBzdGF0ZXM6IG51bGwgKGF0IGJvdHRvbSksIHt0ZXh0LHNjcm9sbFRvfSAoc2Nyb2xsZWQgdXAsXG4gICAgLy8gaGVhZGVyIHNob3dzKSwgJ2NsaWNrZWQnIChqdXN0IGNsaWNrZWQgaGVhZGVyIOKAlCBoaWRlIGl0IHNvIHRoZVxuICAgIC8vIGNvbnRlbnQg4p2vIHRha2VzIHJvdyAwKS4gcGFkQ29sbGFwc2VkIGNvdmVycyB0aGUgbGF0dGVyIHR3bzogb25jZVxuICAgIC8vIHNjcm9sbGVkIGF3YXkgZnJvbSBib3R0b20sIHBhZGRpbmcgZHJvcHMgdG8gMCBhbmQgc3RheXMgdGhlcmUgdW50aWxcbiAgICAvLyByZXBpbi4gaGVhZGVyVmlzaWJsZSBpcyBvbmx5IHRoZSBtaWRkbGUgc3RhdGUuIEFmdGVyIGNsaWNrOlxuICAgIC8vIHNjcm9sbEJveF95PTAgKGhlYWRlciBnb25lKSArIHBhZGRpbmc9MCDihpIgdmlld3BvcnRUb3A9MCDihpIg4p2vIGF0XG4gICAgLy8gcm93IDAuIE9uIG5leHQgc2Nyb2xsIHRoZSBvbkNoYW5nZSBmaXJlcyB3aXRoIGEgZnJlc2gge3RleHR9IGFuZFxuICAgIC8vIGhlYWRlciBjb21lcyBiYWNrICh2aWV3cG9ydFRvcCAw4oaSMSwgYSBzaW5nbGUgMS1yb3cgc2hpZnQg4oCUXG4gICAgLy8gYWNjZXB0YWJsZSBzaW5jZSB1c2VyIGV4cGxpY2l0bHkgc2Nyb2xsZWQpLlxuICAgIGNvbnN0IHN0aWNreSA9IGhpZGVTdGlja3kgPyBudWxsIDogc3RpY2t5UHJvbXB0XG4gICAgY29uc3QgaGVhZGVyUHJvbXB0ID1cbiAgICAgIHN0aWNreSAhPSBudWxsICYmIHN0aWNreSAhPT0gJ2NsaWNrZWQnICYmIG92ZXJsYXkgPT0gbnVsbCA/IHN0aWNreSA6IG51bGxcbiAgICBjb25zdCBwYWRDb2xsYXBzZWQgPSBzdGlja3kgIT0gbnVsbCAmJiBvdmVybGF5ID09IG51bGxcbiAgICByZXR1cm4gKFxuICAgICAgPFByb21wdE92ZXJsYXlQcm92aWRlcj5cbiAgICAgICAgPEJveCBmbGV4R3Jvdz17MX0gZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG92ZXJmbG93PVwiaGlkZGVuXCI+XG4gICAgICAgICAge2hlYWRlclByb21wdCAmJiAoXG4gICAgICAgICAgICA8U3RpY2t5UHJvbXB0SGVhZGVyXG4gICAgICAgICAgICAgIHRleHQ9e2hlYWRlclByb21wdC50ZXh0fVxuICAgICAgICAgICAgICBvbkNsaWNrPXtoZWFkZXJQcm9tcHQuc2Nyb2xsVG99XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICl9XG4gICAgICAgICAgPFNjcm9sbEJveFxuICAgICAgICAgICAgcmVmPXtzY3JvbGxSZWZ9XG4gICAgICAgICAgICBmbGV4R3Jvdz17MX1cbiAgICAgICAgICAgIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIlxuICAgICAgICAgICAgcGFkZGluZ1RvcD17cGFkQ29sbGFwc2VkID8gMCA6IDF9XG4gICAgICAgICAgICBzdGlja3lTY3JvbGxcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8U2Nyb2xsQ2hyb21lQ29udGV4dCB2YWx1ZT17Y2hyb21lQ3R4fT5cbiAgICAgICAgICAgICAge3Njcm9sbGFibGV9XG4gICAgICAgICAgICA8L1Njcm9sbENocm9tZUNvbnRleHQ+XG4gICAgICAgICAgICB7b3ZlcmxheX1cbiAgICAgICAgICA8L1Njcm9sbEJveD5cbiAgICAgICAgICB7IWhpZGVQaWxsICYmIHBpbGxWaXNpYmxlICYmIG92ZXJsYXkgPT0gbnVsbCAmJiAoXG4gICAgICAgICAgICA8TmV3TWVzc2FnZXNQaWxsIGNvdW50PXtuZXdNZXNzYWdlQ291bnR9IG9uQ2xpY2s9e29uUGlsbENsaWNrfSAvPlxuICAgICAgICAgICl9XG4gICAgICAgICAge2JvdHRvbUZsb2F0ICE9IG51bGwgJiYgKFxuICAgICAgICAgICAgPEJveCBwb3NpdGlvbj1cImFic29sdXRlXCIgYm90dG9tPXswfSByaWdodD17MH0gb3BhcXVlPlxuICAgICAgICAgICAgICB7Ym90dG9tRmxvYXR9XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZmxleFNocmluaz17MH0gd2lkdGg9XCIxMDAlXCIgbWF4SGVpZ2h0PVwiNTAlXCI+XG4gICAgICAgICAgPFN1Z2dlc3Rpb25zT3ZlcmxheSAvPlxuICAgICAgICAgIDxEaWFsb2dPdmVybGF5IC8+XG4gICAgICAgICAgPEJveFxuICAgICAgICAgICAgZmxleERpcmVjdGlvbj1cImNvbHVtblwiXG4gICAgICAgICAgICB3aWR0aD1cIjEwMCVcIlxuICAgICAgICAgICAgZmxleEdyb3c9ezF9XG4gICAgICAgICAgICBvdmVyZmxvd1k9XCJoaWRkZW5cIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIHtib3R0b219XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgICB7bW9kYWwgIT0gbnVsbCAmJiAoXG4gICAgICAgICAgPE1vZGFsQ29udGV4dFxuICAgICAgICAgICAgdmFsdWU9e3tcbiAgICAgICAgICAgICAgcm93czogdGVybWluYWxSb3dzIC0gTU9EQUxfVFJBTlNDUklQVF9QRUVLIC0gMSxcbiAgICAgICAgICAgICAgY29sdW1uczogY29sdW1ucyAtIDQsXG4gICAgICAgICAgICAgIHNjcm9sbFJlZjogbW9kYWxTY3JvbGxSZWYgPz8gbnVsbCxcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgey8qIEJvdHRvbS1hbmNob3JlZCwgZ3Jvd3MgdXB3YXJkIHRvIGZpdCBjb250ZW50LiBtYXhIZWlnaHQga2VlcHMgYVxuICAgICAgICAgICAgICAgIGZldyByb3dzIG9mIHRyYW5zY3JpcHQgcGVlayBhYm92ZSB0aGUg4paUIGRpdmlkZXIuIFNob3J0IG1vZGFsc1xuICAgICAgICAgICAgICAgICgvbW9kZWwpIHNpdCBzbWFsbCBhdCB0aGUgYm90dG9tIHdpdGggbG90cyBvZiB0cmFuc2NyaXB0IGFib3ZlO1xuICAgICAgICAgICAgICAgIHRhbGwgbW9kYWxzICgvYnVkZHkgQ2FyZCkgZ3JvdyBhcyBuZWVkZWQsIGNsaXBwZWQgYnkgb3ZlcmZsb3cuXG4gICAgICAgICAgICAgICAgUHJldmlvdXNseSBmaXhlZC1oZWlnaHQgKHRvcCtib3R0b20gYW5jaG9yZWQpIOKAlCBhbnkgZml4ZWQgY2FwXG4gICAgICAgICAgICAgICAgZWl0aGVyIGNsaXBwZWQgdGFsbCBjb250ZW50IG9yIGxlZnQgc2hvcnQgY29udGVudCBmbG9hdGluZyBpblxuICAgICAgICAgICAgICAgIGEgbW9zdGx5LWVtcHR5IHBhbmUuXG5cbiAgICAgICAgICAgICAgICBmbGV4U2hyaW5rPTAgb24gdGhlIGlubmVyIEJveCBpcyBsb2FkLWJlYXJpbmc6IHdpdGggU2hyaW5rPTEsXG4gICAgICAgICAgICAgICAgeW9nYSBzcXVlZXplcyBkZWVwIGNoaWxkcmVuIHRvIGg9MCB3aGVuIGNvbnRlbnQgPiBtYXhIZWlnaHQsXG4gICAgICAgICAgICAgICAgYW5kIHNpYmxpbmcgVGV4dHMgbGFuZCBvbiB0aGUgc2FtZSByb3cg4oaSIGdob3N0IG92ZXJsYXBcbiAgICAgICAgICAgICAgICAoXCI1IHNlcnZlcnNQIHNlcnZlcnNcIikuIENsaXBwaW5nIGF0IHRoZSBvdXRlciBCb3gncyBtYXhIZWlnaHRcbiAgICAgICAgICAgICAgICBrZWVwcyBjaGlsZHJlbiBhdCBuYXR1cmFsIHNpemUuXG5cbiAgICAgICAgICAgICAgICBEaXZpZGVyIHdyYXBwZWQgaW4gZmxleFNocmluaz0wOiB3aGVuIHRoZSBpbm5lciBib3ggb3ZlcmZsb3dzXG4gICAgICAgICAgICAgICAgKHRhbGwgL2NvbmZpZyBvcHRpb24gbGlzdCksIHlvZ2Egc2hyaW5rcyB0aGUgZGl2aWRlciBUZXh0IHRvXG4gICAgICAgICAgICAgICAgaD0wIHRvIGFic29yYiB0aGUgZGVmaWNpdCDigJQgaXQncyB0aGUgb25seSBzaHJpbmthYmxlIHNpYmxpbmcuXG4gICAgICAgICAgICAgICAgVGhlIHdyYXBwZXIga2VlcHMgaXQgYXQgMSByb3c7IG92ZXJmbG93IHBhc3QgbWF4SGVpZ2h0IGlzXG4gICAgICAgICAgICAgICAgY2xpcHBlZCBhdCB0aGUgYm90dG9tIGJ5IG92ZXJmbG93PWhpZGRlbiBpbnN0ZWFkLiAqL31cbiAgICAgICAgICAgIDxCb3hcbiAgICAgICAgICAgICAgcG9zaXRpb249XCJhYnNvbHV0ZVwiXG4gICAgICAgICAgICAgIGJvdHRvbT17MH1cbiAgICAgICAgICAgICAgbGVmdD17MH1cbiAgICAgICAgICAgICAgcmlnaHQ9ezB9XG4gICAgICAgICAgICAgIG1heEhlaWdodD17dGVybWluYWxSb3dzIC0gTU9EQUxfVFJBTlNDUklQVF9QRUVLfVxuICAgICAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICAgICAgb3ZlcmZsb3c9XCJoaWRkZW5cIlxuICAgICAgICAgICAgICBvcGFxdWVcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPEJveCBmbGV4U2hyaW5rPXswfT5cbiAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cInBlcm1pc3Npb25cIj57J+KWlCcucmVwZWF0KGNvbHVtbnMpfTwvVGV4dD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgIDxCb3hcbiAgICAgICAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICAgICAgICBwYWRkaW5nWD17Mn1cbiAgICAgICAgICAgICAgICBmbGV4U2hyaW5rPXswfVxuICAgICAgICAgICAgICAgIG92ZXJmbG93PVwiaGlkZGVuXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHttb2RhbH1cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8L01vZGFsQ29udGV4dD5cbiAgICAgICAgKX1cbiAgICAgIDwvUHJvbXB0T3ZlcmxheVByb3ZpZGVyPlxuICAgIClcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIHtzY3JvbGxhYmxlfVxuICAgICAge2JvdHRvbX1cbiAgICAgIHtvdmVybGF5fVxuICAgICAge21vZGFsfVxuICAgIDwvPlxuICApXG59XG5cbi8vIFNsYWNrLXN0eWxlIHBpbGwuIEFic29sdXRlIG92ZXJsYXkgYXQgYm90dG9tPXswfSBvZiB0aGUgc2Nyb2xsd3JhcCDigJQgZmxvYXRzXG4vLyBvdmVyIHRoZSBTY3JvbGxCb3gncyBsYXN0IGNvbnRlbnQgcm93LCBvbmx5IG9ic2N1cmluZyB0aGUgY2VudGVyZWQgcGlsbFxuLy8gdGV4dCAodGhlIHJlc3Qgb2YgdGhlIHJvdyBzaG93cyBTY3JvbGxCb3ggY29udGVudCkuIFNjcm9sbC1zbWVhciBmcm9tXG4vLyBERUNTVEJNIHNoaWZ0aW5nIHRoZSBwaWxsJ3MgcGl4ZWxzIGlzIHJlcGFpcmVkIGF0IHRoZSBJbmsgbGF5ZXJcbi8vIChhYnNvbHV0ZVJlY3RzUHJldiB0aGlyZC1wYXNzIGluIHJlbmRlci1ub2RlLXRvLW91dHB1dC50cywgIzIzOTM5KS4gU2hvd3Ncbi8vIFwiSnVtcCB0byBib3R0b21cIiB3aGVuIGNvdW50IGlzIDAgKHNjcm9sbGVkIGF3YXkgYnV0IG5vIG5ldyBtZXNzYWdlcyB5ZXQg4oCUXG4vLyB0aGUgZGVhZCB6b25lIHdoZXJlIHVzZXJzIHByZXZpb3VzbHkgdGhvdWdodCBjaGF0IHN0YWxsZWQpLlxuZnVuY3Rpb24gTmV3TWVzc2FnZXNQaWxsKHtcbiAgY291bnQsXG4gIG9uQ2xpY2ssXG59OiB7XG4gIGNvdW50OiBudW1iZXJcbiAgb25DbGljaz86ICgpID0+IHZvaWRcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBbaG92ZXIsIHNldEhvdmVyXSA9IHVzZVN0YXRlKGZhbHNlKVxuICByZXR1cm4gKFxuICAgIDxCb3hcbiAgICAgIHBvc2l0aW9uPVwiYWJzb2x1dGVcIlxuICAgICAgYm90dG9tPXswfVxuICAgICAgbGVmdD17MH1cbiAgICAgIHJpZ2h0PXswfVxuICAgICAganVzdGlmeUNvbnRlbnQ9XCJjZW50ZXJcIlxuICAgID5cbiAgICAgIDxCb3hcbiAgICAgICAgb25DbGljaz17b25DbGlja31cbiAgICAgICAgb25Nb3VzZUVudGVyPXsoKSA9PiBzZXRIb3Zlcih0cnVlKX1cbiAgICAgICAgb25Nb3VzZUxlYXZlPXsoKSA9PiBzZXRIb3ZlcihmYWxzZSl9XG4gICAgICA+XG4gICAgICAgIDxUZXh0XG4gICAgICAgICAgYmFja2dyb3VuZENvbG9yPXtcbiAgICAgICAgICAgIGhvdmVyID8gJ3VzZXJNZXNzYWdlQmFja2dyb3VuZEhvdmVyJyA6ICd1c2VyTWVzc2FnZUJhY2tncm91bmQnXG4gICAgICAgICAgfVxuICAgICAgICAgIGRpbUNvbG9yXG4gICAgICAgID5cbiAgICAgICAgICB7JyAnfVxuICAgICAgICAgIHtjb3VudCA+IDBcbiAgICAgICAgICAgID8gYCR7Y291bnR9IG5ldyAke3BsdXJhbChjb3VudCwgJ21lc3NhZ2UnKX1gXG4gICAgICAgICAgICA6ICdKdW1wIHRvIGJvdHRvbSd9eycgJ31cbiAgICAgICAgICB7ZmlndXJlcy5hcnJvd0Rvd259eycgJ31cbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuLy8gQ29udGV4dCBicmVhZGNydW1iOiB3aGVuIHNjcm9sbGVkIHVwIGludG8gaGlzdG9yeSwgcGluIHRoZSBjdXJyZW50XG4vLyBjb252ZXJzYXRpb24gdHVybidzIHByb21wdCBhYm92ZSB0aGUgdmlld3BvcnQgc28geW91IGtub3cgd2hhdCBDbGF1ZGUgd2FzXG4vLyByZXNwb25kaW5nIHRvLiBOb3JtYWwtZmxvdyBzaWJsaW5nIEJFRk9SRSB0aGUgU2Nyb2xsQm94IChtaXJyb3JzIHRoZSBwaWxsXG4vLyBiZWxvdyBpdCkg4oCUIHNocmlua3MgdGhlIFNjcm9sbEJveCBieSBleGFjdGx5IDEgcm93IHZpYSBmbGV4LCBzdGF5cyBvdXRzaWRlXG4vLyB0aGUgREVDU1RCTSBzY3JvbGwgcmVnaW9uLiBDbGljayBqdW1wcyBiYWNrIHRvIHRoZSBwcm9tcHQuXG4vL1xuLy8gSGVpZ2h0IGlzIEZJWEVEIGF0IDEgcm93ICh0cnVuY2F0ZS1lbmQgZm9yIGxvbmcgcHJvbXB0cykuIEEgdmFyaWFibGUtaGVpZ2h0XG4vLyBoZWFkZXIgKDEgd2hlbiBzaG9ydCwgMiB3aGVuIHdyYXBwZWQpIHNoaWZ0cyB0aGUgU2Nyb2xsQm94IGJ5IDEgcm93IGV2ZXJ5XG4vLyB0aW1lIHRoZSBzdGlja3kgcHJvbXB0IHN3aXRjaGVzIGR1cmluZyBzY3JvbGwg4oCUIGNvbnRlbnQganVtcHMgb24gc2NyZWVuXG4vLyBldmVuIHdpdGggc2Nyb2xsVG9wIHVuY2hhbmdlZCAodGhlIERFQ1NUQk0gcmVnaW9uIHRvcCBzaGlmdHMgd2l0aCB0aGVcbi8vIFNjcm9sbEJveCwgYW5kIHRoZSBkaWZmIGVuZ2luZSBzZWVzIFwiZXZlcnl0aGluZyBtb3ZlZFwiKS4gRml4ZWQgaGVpZ2h0XG4vLyBrZWVwcyB0aGUgU2Nyb2xsQm94IGFuY2hvcmVkOyBvbmx5IHRoZSBoZWFkZXIgVEVYVCBjaGFuZ2VzLCBub3QgaXRzIGJveC5cbmZ1bmN0aW9uIFN0aWNreVByb21wdEhlYWRlcih7XG4gIHRleHQsXG4gIG9uQ2xpY2ssXG59OiB7XG4gIHRleHQ6IHN0cmluZ1xuICBvbkNsaWNrOiAoKSA9PiB2b2lkXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgW2hvdmVyLCBzZXRIb3Zlcl0gPSB1c2VTdGF0ZShmYWxzZSlcbiAgcmV0dXJuIChcbiAgICA8Qm94XG4gICAgICBmbGV4U2hyaW5rPXswfVxuICAgICAgd2lkdGg9XCIxMDAlXCJcbiAgICAgIGhlaWdodD17MX1cbiAgICAgIHBhZGRpbmdSaWdodD17MX1cbiAgICAgIGJhY2tncm91bmRDb2xvcj17XG4gICAgICAgIGhvdmVyID8gJ3VzZXJNZXNzYWdlQmFja2dyb3VuZEhvdmVyJyA6ICd1c2VyTWVzc2FnZUJhY2tncm91bmQnXG4gICAgICB9XG4gICAgICBvbkNsaWNrPXtvbkNsaWNrfVxuICAgICAgb25Nb3VzZUVudGVyPXsoKSA9PiBzZXRIb3Zlcih0cnVlKX1cbiAgICAgIG9uTW91c2VMZWF2ZT17KCkgPT4gc2V0SG92ZXIoZmFsc2UpfVxuICAgID5cbiAgICAgIDxUZXh0IGNvbG9yPVwic3VidGxlXCIgd3JhcD1cInRydW5jYXRlLWVuZFwiPlxuICAgICAgICB7ZmlndXJlcy5wb2ludGVyfSB7dGV4dH1cbiAgICAgIDwvVGV4dD5cbiAgICA8L0JveD5cbiAgKVxufVxuXG4vLyBTbGFzaC1jb21tYW5kIHN1Z2dlc3Rpb24gb3ZlcmxheSDigJQgc2VlIHByb21wdE92ZXJsYXlDb250ZXh0LnRzeCBmb3Igd2h5XG4vLyBpdCdzIHBvcnRhbGVkLiBTY3JvbGwtc21lYXIgZnJvbSBmbG9hdGluZyBvdmVyIHRoZSBERUNTVEJNIHJlZ2lvbiBpc1xuLy8gcmVwYWlyZWQgYXQgdGhlIEluayBsYXllciAoYWJzb2x1dGVSZWN0c1ByZXYgaW4gcmVuZGVyLW5vZGUtdG8tb3V0cHV0LnRzKS5cbi8vIFRoZSByZW5kZXJlciBjbGFtcHMgbmVnYXRpdmUgeSB0byAwIGZvciBhYnNvbHV0ZSBlbGVtZW50cyAoc2VlXG4vLyByZW5kZXItbm9kZS10by1vdXRwdXQudHMpLCBzbyB0aGUgdG9wIHJvd3MgKGJlc3QgbWF0Y2hlcykgc3RheSB2aXNpYmxlXG4vLyBldmVuIHdoZW4gdGhlIG92ZXJsYXkgZXh0ZW5kcyBhYm92ZSB0aGUgdmlld3BvcnQuIFdlIG9taXQgbWluSGVpZ2h0IGFuZFxuLy8gZmxleC1lbmQgaGVyZTogdGhleSB3b3VsZCBjcmVhdGUgZW1wdHkgcGFkZGluZyByb3dzIHRoYXQgc2hpZnQgdmlzaWJsZVxuLy8gaXRlbXMgZG93biBpbnRvIHRoZSBwcm9tcHQgYXJlYSB3aGVuIHRoZSBsaXN0IGhhcyBmZXdlciBpdGVtcyB0aGFuIG1heC5cbmZ1bmN0aW9uIFN1Z2dlc3Rpb25zT3ZlcmxheSgpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBkYXRhID0gdXNlUHJvbXB0T3ZlcmxheSgpXG4gIGlmICghZGF0YSB8fCBkYXRhLnN1Z2dlc3Rpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGxcbiAgcmV0dXJuIChcbiAgICA8Qm94XG4gICAgICBwb3NpdGlvbj1cImFic29sdXRlXCJcbiAgICAgIGJvdHRvbT1cIjEwMCVcIlxuICAgICAgbGVmdD17MH1cbiAgICAgIHJpZ2h0PXswfVxuICAgICAgcGFkZGluZ1g9ezJ9XG4gICAgICBwYWRkaW5nVG9wPXsxfVxuICAgICAgZmxleERpcmVjdGlvbj1cImNvbHVtblwiXG4gICAgICBvcGFxdWVcbiAgICA+XG4gICAgICA8UHJvbXB0SW5wdXRGb290ZXJTdWdnZXN0aW9uc1xuICAgICAgICBzdWdnZXN0aW9ucz17ZGF0YS5zdWdnZXN0aW9uc31cbiAgICAgICAgc2VsZWN0ZWRTdWdnZXN0aW9uPXtkYXRhLnNlbGVjdGVkU3VnZ2VzdGlvbn1cbiAgICAgICAgbWF4Q29sdW1uV2lkdGg9e2RhdGEubWF4Q29sdW1uV2lkdGh9XG4gICAgICAgIG92ZXJsYXlcbiAgICAgIC8+XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuLy8gRGlhbG9nIHBvcnRhbGVkIGZyb20gUHJvbXB0SW5wdXQgKEF1dG9Nb2RlT3B0SW5EaWFsb2cpIOKAlCBzYW1lIGNsaXAtZXNjYXBlXG4vLyBwYXR0ZXJuIGFzIFN1Z2dlc3Rpb25zT3ZlcmxheS4gUmVuZGVycyBsYXRlciBpbiB0cmVlIG9yZGVyIHNvIGl0IHBhaW50c1xuLy8gb3ZlciBzdWdnZXN0aW9ucyBpZiBib3RoIGFyZSBldmVyIHVwICh0aGV5IHNob3VsZG4ndCBiZSkuXG5mdW5jdGlvbiBEaWFsb2dPdmVybGF5KCk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IG5vZGUgPSB1c2VQcm9tcHRPdmVybGF5RGlhbG9nKClcbiAgaWYgKCFub2RlKSByZXR1cm4gbnVsbFxuICByZXR1cm4gKFxuICAgIDxCb3ggcG9zaXRpb249XCJhYnNvbHV0ZVwiIGJvdHRvbT1cIjEwMCVcIiBsZWZ0PXswfSByaWdodD17MH0gb3BhcXVlPlxuICAgICAge25vZGV9XG4gICAgPC9Cb3g+XG4gIClcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU9BLE9BQU8sTUFBTSxTQUFTO0FBQzdCLE9BQU9DLEtBQUssSUFDVkMsYUFBYSxFQUNiLEtBQUtDLFNBQVMsRUFDZCxLQUFLQyxTQUFTLEVBQ2RDLFdBQVcsRUFDWEMsU0FBUyxFQUNUQyxlQUFlLEVBQ2ZDLE9BQU8sRUFDUEMsTUFBTSxFQUNOQyxRQUFRLEVBQ1JDLG9CQUFvQixRQUNmLE9BQU87QUFDZCxTQUFTQyxhQUFhLFFBQVEsS0FBSztBQUNuQyxTQUFTQyxZQUFZLFFBQVEsNEJBQTRCO0FBQ3pELFNBQ0VDLHFCQUFxQixFQUNyQkMsZ0JBQWdCLEVBQ2hCQyxzQkFBc0IsUUFDakIsb0NBQW9DO0FBQzNDLFNBQVNDLGVBQWUsUUFBUSw2QkFBNkI7QUFDN0QsT0FBT0MsU0FBUyxJQUFJLEtBQUtDLGVBQWUsUUFBUSxnQ0FBZ0M7QUFDaEYsT0FBT0MsU0FBUyxNQUFNLHFCQUFxQjtBQUMzQyxTQUFTQyxHQUFHLEVBQUVDLElBQUksUUFBUSxXQUFXO0FBQ3JDLGNBQWNDLE9BQU8sUUFBUSxxQkFBcUI7QUFDbEQsU0FBU0MsV0FBVyxFQUFFQyxRQUFRLFFBQVEscUJBQXFCO0FBQzNELFNBQVNDLHNCQUFzQixRQUFRLHdCQUF3QjtBQUMvRCxTQUFTQyxNQUFNLFFBQVEseUJBQXlCO0FBQ2hELFNBQVNDLHlCQUF5QixRQUFRLHdDQUF3QztBQUNsRixPQUFPQyw0QkFBNEIsTUFBTSwrQ0FBK0M7QUFDeEYsY0FBY0MsWUFBWSxRQUFRLHlCQUF5Qjs7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