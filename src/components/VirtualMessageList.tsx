import { c as _c } from "react/compiler-runtime";
import type { RefObject } from 'react';
import * as React from 'react';
import { useCallback, useContext, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from 'react';
import { useVirtualScroll } from '../hooks/useVirtualScroll.js';
import type { ScrollBoxHandle } from '../ink/components/ScrollBox.js';
import type { DOMElement } from '../ink/dom.js';
import type { MatchPosition } from '../ink/render-to-screen.js';
import { Box } from '../ink.js';
import type { RenderableMessage } from '../types/message.js';
import { TextHoverColorContext } from './design-system/ThemedText.js';
import { ScrollChromeContext } from './FullscreenLayout.js';

// Rows of breathing room above the target when we scrollTo.
const HEADROOM = 3;
import { logForDebugging } from '../utils/debug.js';
import { sleep } from '../utils/sleep.js';
import { renderableSearchText } from '../utils/transcriptSearch.js';
import { isNavigableMessage, type MessageActionsNav, type MessageActionsState, type NavigableMessage, stripSystemReminders, toolCallOf } from './messageActions.js';

// Fallback extractor: lower + cache here for callers without the
// Messages.tsx tool-lookup path (tests, static contexts). Messages.tsx
// provides its own lowering cache that also handles tool extractSearchText.
const fallbackLowerCache = new WeakMap<RenderableMessage, string>();
function defaultExtractSearchText(msg: RenderableMessage): string {
  const cached = fallbackLowerCache.get(msg);
  if (cached !== undefined) return cached;
  const lowered = renderableSearchText(msg);
  fallbackLowerCache.set(msg, lowered);
  return lowered;
}
export type StickyPrompt = {
  text: string;
  scrollTo: () => void;
}
// Click sets this — header HIDES but padding stays collapsed (0) so
// the content ❯ lands at screen row 0 instead of row 1. Cleared on
// the next sticky-prompt compute (user scrolls again).
| 'clicked';

/** Huge pasted prompts (cat file | claude) can be MBs. Header wraps into
 *  2 rows via overflow:hidden — this just bounds the React prop size. */
const STICKY_TEXT_CAP = 500;

/** Imperative handle for transcript navigation. Methods compute matches
 *  HERE (renderableMessages indices are only valid inside this component —
 *  Messages.tsx filters and reorders, REPL can't compute externally). */
export type JumpHandle = {
  jumpToIndex: (i: number) => void;
  setSearchQuery: (q: string) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  /** Capture current scrollTop as the incsearch anchor. Typing jumps
   *  around as preview; 0-matches snaps back here. Enter/n/N never
   *  restore (they don't call setSearchQuery with empty). Next / call
   *  overwrites. */
  setAnchor: () => void;
  /** Warm the search-text cache by extracting every message's text.
   *  Returns elapsed ms, or 0 if already warm (subsequent / in same
   *  transcript session). Yields before work so the caller can paint
   *  "indexing…" first. Caller shows "indexed in Xms" on resolve. */
  warmSearchIndex: () => Promise<number>;
  /** Manual scroll (j/k/PgUp/wheel) exited the search context. Clear
   *  positions (yellow goes away, inverse highlights stay). Next n/N
   *  re-establishes via step()→jump(). Wired from ScrollKeybindingHandler's
   *  onScroll — only fires for keyboard/wheel, not programmatic scrollTo. */
  disarmSearch: () => void;
};
type Props = {
  messages: RenderableMessage[];
  scrollRef: RefObject<ScrollBoxHandle | null>;
  /** Invalidates heightCache on change — cached heights from a different
   *  width are wrong (text rewrap → black screen on scroll-up after widen). */
  columns: number;
  itemKey: (msg: RenderableMessage) => string;
  renderItem: (msg: RenderableMessage, index: number) => React.ReactNode;
  /** Fires when a message Box is clicked (toggle per-message verbose). */
  onItemClick?: (msg: RenderableMessage) => void;
  /** Per-item filter — suppress hover/click for messages where the verbose
   *  toggle does nothing (text, file edits, etc). Defaults to all-clickable. */
  isItemClickable?: (msg: RenderableMessage) => boolean;
  /** Expanded items get a persistent grey bg (not just on hover). */
  isItemExpanded?: (msg: RenderableMessage) => boolean;
  /** PRE-LOWERED search text. Messages.tsx caches the lowered result
   *  once at warm time so setSearchQuery's per-keystroke loop does
   *  only indexOf (zero toLowerCase alloc). Falls back to a lowering
   *  wrapper on renderableSearchText for callers without the cache. */
  extractSearchText?: (msg: RenderableMessage) => string;
  /** Enable the sticky-prompt tracker. StickyTracker writes via
   *  ScrollChromeContext (not a callback prop) so state lives in
   *  FullscreenLayout instead of REPL. */
  trackStickyPrompt?: boolean;
  selectedIndex?: number;
  /** Nav handle lives here because height measurement lives here. */
  cursorNavRef?: React.Ref<MessageActionsNav>;
  setCursor?: (c: MessageActionsState | null) => void;
  jumpRef?: RefObject<JumpHandle | null>;
  /** Fires when search matches change (query edit, n/N). current is
   *  1-based for "3/47" display; 0 means no matches. */
  onSearchMatchesChange?: (count: number, current: number) => void;
  /** Paint existing DOM subtree to fresh Screen, scan. Element from the
   *  main tree (all providers). Message-relative positions (row 0 = el
   *  top). Works for any height — closes the tall-message gap. */
  scanElement?: (el: DOMElement) => MatchPosition[];
  /** Position-based CURRENT highlight. Positions known upfront (from
   *  scanElement), navigation = index arithmetic + scrollTo. rowOffset
   *  = message's current screen-top; positions stay stable. */
  setPositions?: (state: {
    positions: MatchPosition[];
    rowOffset: number;
    currentIdx: number;
  } | null) => void;
};

/**
 * Returns the text of a real user prompt, or null for anything else.
 * "Real" = what the human typed: not tool results, not XML-wrapped payloads
 * (<bash-stdout>, <command-message>, <teammate-message>, etc.), not meta.
 *
 * Two shapes land here: NormalizedUserMessage (normal prompts) and
 * AttachmentMessage with type==='queued_command' (prompts sent mid-turn
 * while a tool was executing — they get drained as attachments on the
 * next turn, see query.ts:1410). Both render as ❯-prefixed UserTextMessage
 * in the UI so both should stick.
 *
 * Leading <system-reminder> blocks are stripped before checking — they get
 * prepended to the stored text for Claude's context (memory updates, auto
 * mode reminders) but aren't what the user typed. Without stripping, any
 * prompt that happened to get a reminder is rejected by the startsWith('<')
 * check. Shows up on `cc -c` resumes where memory-update reminders are dense.
 */
const promptTextCache = new WeakMap<RenderableMessage, string | null>();
function stickyPromptText(msg: RenderableMessage): string | null {
  // Cache keyed on message object — messages are append-only and don't
  // mutate, so a WeakMap hit is always valid. The walk (StickyTracker,
  // per-scroll-tick) calls this 5-50+ times with the SAME messages every
  // tick; the system-reminder strip allocates a fresh string on each
  // parse. WeakMap self-GCs on compaction/clear (messages[] replaced).
  const cached = promptTextCache.get(msg);
  if (cached !== undefined) return cached;
  const result = computeStickyPromptText(msg);
  promptTextCache.set(msg, result);
  return result;
}
function computeStickyPromptText(msg: RenderableMessage): string | null {
  let raw: string | null = null;
  if (msg.type === 'user') {
    if (msg.isMeta || msg.isVisibleInTranscriptOnly) return null;
    const block = msg.message.content[0];
    if (block?.type !== 'text') return null;
    raw = block.text;
  } else if (msg.type === 'attachment' && msg.attachment.type === 'queued_command' && msg.attachment.commandMode !== 'task-notification' && !msg.attachment.isMeta) {
    const p = msg.attachment.prompt;
    raw = typeof p === 'string' ? p : p.flatMap(b => b.type === 'text' ? [b.text] : []).join('\n');
  }
  if (raw === null) return null;
  const t = stripSystemReminders(raw);
  if (t.startsWith('<') || t === '') return null;
  return t;
}

/**
 * Virtualized message list for fullscreen mode. Split from Messages.tsx so
 * useVirtualScroll is called unconditionally (rules-of-hooks) — Messages.tsx
 * conditionally renders either this or a plain .map().
 *
 * The wrapping <Box ref> is the measurement anchor — MessageRow doesn't take
 * a ref. Single-child column Box passes Yoga height through unchanged.
 */
type VirtualItemProps = {
  itemKey: string;
  msg: RenderableMessage;
  idx: number;
  measureRef: (key: string) => (el: DOMElement | null) => void;
  expanded: boolean | undefined;
  hovered: boolean;
  clickable: boolean;
  onClickK: (msg: RenderableMessage, cellIsBlank: boolean) => void;
  onEnterK: (k: string) => void;
  onLeaveK: (k: string) => void;
  renderItem: (msg: RenderableMessage, idx: number) => React.ReactNode;
};

// Item wrapper with stable click handlers. The per-item closures were the
// `operationNewArrowFunction` leafs → `FunctionExecutable::finalizeUnconditionally`
// GC cleanup (16% of GC time during fast scroll). 3 closures × 60 mounted ×
// 10 commits/sec = 1800 closures/sec. With stable onClickK/onEnterK/onLeaveK
// threaded via itemKey, the closures here are per-item-per-render but CHEAP
// (just wrap the stable callback with k bound) and don't close over msg/idx
// which lets JIT inline them. The bigger win is inside: MessageRow.memo
// bails for unchanged msgs, skipping marked.lexer + formatToken.
//
// NOT React.memo'd — renderItem captures changing state (cursor, selectedIdx,
// verbose). Memoing with a comparator that ignores renderItem would use a
// STALE closure on bail (wrong selection highlight, stale verbose). Including
// renderItem in the comparator defeats memo since it's fresh each render.
function VirtualItem(t0) {
  const $ = _c(30);
  const {
    itemKey: k,
    msg,
    idx,
    measureRef,
    expanded,
    hovered,
    clickable,
    onClickK,
    onEnterK,
    onLeaveK,
    renderItem
  } = t0;
  let t1;
  if ($[0] !== k || $[1] !== measureRef) {
    t1 = measureRef(k);
    $[0] = k;
    $[1] = measureRef;
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  const t2 = expanded ? "userMessageBackgroundHover" : undefined;
  const t3 = expanded ? 1 : undefined;
  let t4;
  if ($[3] !== clickable || $[4] !== msg || $[5] !== onClickK) {
    t4 = clickable ? e => onClickK(msg, e.cellIsBlank) : undefined;
    $[3] = clickable;
    $[4] = msg;
    $[5] = onClickK;
    $[6] = t4;
  } else {
    t4 = $[6];
  }
  let t5;
  if ($[7] !== clickable || $[8] !== k || $[9] !== onEnterK) {
    t5 = clickable ? () => onEnterK(k) : undefined;
    $[7] = clickable;
    $[8] = k;
    $[9] = onEnterK;
    $[10] = t5;
  } else {
    t5 = $[10];
  }
  let t6;
  if ($[11] !== clickable || $[12] !== k || $[13] !== onLeaveK) {
    t6 = clickable ? () => onLeaveK(k) : undefined;
    $[11] = clickable;
    $[12] = k;
    $[13] = onLeaveK;
    $[14] = t6;
  } else {
    t6 = $[14];
  }
  const t7 = hovered && !expanded ? "text" : undefined;
  let t8;
  if ($[15] !== idx || $[16] !== msg || $[17] !== renderItem) {
    t8 = renderItem(msg, idx);
    $[15] = idx;
    $[16] = msg;
    $[17] = renderItem;
    $[18] = t8;
  } else {
    t8 = $[18];
  }
  let t9;
  if ($[19] !== t7 || $[20] !== t8) {
    t9 = <TextHoverColorContext.Provider value={t7}>{t8}</TextHoverColorContext.Provider>;
    $[19] = t7;
    $[20] = t8;
    $[21] = t9;
  } else {
    t9 = $[21];
  }
  let t10;
  if ($[22] !== t1 || $[23] !== t2 || $[24] !== t3 || $[25] !== t4 || $[26] !== t5 || $[27] !== t6 || $[28] !== t9) {
    t10 = <Box ref={t1} flexDirection="column" backgroundColor={t2} paddingBottom={t3} onClick={t4} onMouseEnter={t5} onMouseLeave={t6}>{t9}</Box>;
    $[22] = t1;
    $[23] = t2;
    $[24] = t3;
    $[25] = t4;
    $[26] = t5;
    $[27] = t6;
    $[28] = t9;
    $[29] = t10;
  } else {
    t10 = $[29];
  }
  return t10;
}
export function VirtualMessageList({
  messages,
  scrollRef,
  columns,
  itemKey,
  renderItem,
  onItemClick,
  isItemClickable,
  isItemExpanded,
  extractSearchText = defaultExtractSearchText,
  trackStickyPrompt,
  selectedIndex,
  cursorNavRef,
  setCursor,
  jumpRef,
  onSearchMatchesChange,
  scanElement,
  setPositions
}: Props): React.ReactNode {
  // Incremental key array. Streaming appends one message at a time; rebuilding
  // the full string array on every commit allocates O(n) per message (~1MB
  // churn at 27k messages). Append-only delta push when the prefix matches;
  // fall back to full rebuild on compaction, /clear, or itemKey change.
  const keysRef = useRef<string[]>([]);
  const prevMessagesRef = useRef<typeof messages>(messages);
  const prevItemKeyRef = useRef(itemKey);
  if (prevItemKeyRef.current !== itemKey || messages.length < keysRef.current.length || messages[0] !== prevMessagesRef.current[0]) {
    keysRef.current = messages.map(m => itemKey(m));
  } else {
    for (let i = keysRef.current.length; i < messages.length; i++) {
      keysRef.current.push(itemKey(messages[i]!));
    }
  }
  prevMessagesRef.current = messages;
  prevItemKeyRef.current = itemKey;
  const keys = keysRef.current;
  const {
    range,
    topSpacer,
    bottomSpacer,
    measureRef,
    spacerRef,
    offsets,
    getItemTop,
    getItemElement,
    getItemHeight,
    scrollToIndex
  } = useVirtualScroll(scrollRef, keys, columns);
  const [start, end] = range;

  // Unmeasured (undefined height) falls through — assume visible.
  const isVisible = useCallback((i: number) => {
    const h = getItemHeight(i);
    if (h === 0) return false;
    return isNavigableMessage(messages[i]!);
  }, [getItemHeight, messages]);
  useImperativeHandle(cursorNavRef, (): MessageActionsNav => {
    const select = (m: NavigableMessage) => setCursor?.({
      uuid: m.uuid,
      msgType: m.type,
      expanded: false,
      toolName: toolCallOf(m)?.name
    });
    const selIdx = selectedIndex ?? -1;
    const scan = (from: number, dir: 1 | -1, pred: (i: number) => boolean = isVisible) => {
      for (let i = from; i >= 0 && i < messages.length; i += dir) {
        if (pred(i)) {
          select(messages[i]!);
          return true;
        }
      }
      return false;
    };
    const isUser = (i: number) => isVisible(i) && messages[i]!.type === 'user';
    return {
      // Entry via shift+↑ = same semantic as in-cursor shift+↑ (prevUser).
      enterCursor: () => scan(messages.length - 1, -1, isUser),
      navigatePrev: () => scan(selIdx - 1, -1),
      navigateNext: () => {
        if (scan(selIdx + 1, 1)) return;
        // Past last visible → exit + repin. Last message's TOP is at viewport
        // top (selection-scroll effect); its BOTTOM may be below the fold.
        scrollRef.current?.scrollToBottom();
        setCursor?.(null);
      },
      // type:'user' only — queued_command attachments look like prompts but have no raw UserMessage to rewind to.
      navigatePrevUser: () => scan(selIdx - 1, -1, isUser),
      navigateNextUser: () => scan(selIdx + 1, 1, isUser),
      navigateTop: () => scan(0, 1),
      navigateBottom: () => scan(messages.length - 1, -1),
      getSelected: () => selIdx >= 0 ? messages[selIdx] ?? null : null
    };
  }, [messages, selectedIndex, setCursor, isVisible]);
  // Two-phase jump + search engine. Read-through-ref so the handle stays
  // stable across renders — offsets/messages identity changes every render,
  // can't go in useImperativeHandle deps without recreating the handle.
  const jumpState = useRef({
    offsets,
    start,
    getItemElement,
    getItemTop,
    messages,
    scrollToIndex
  });
  jumpState.current = {
    offsets,
    start,
    getItemElement,
    getItemTop,
    messages,
    scrollToIndex
  };

  // Keep cursor-selected message visible. offsets rebuilds every render
  // — as a bare dep this re-pinned on every mousewheel tick. Read through
  // jumpState instead; past-overscan jumps land via scrollToIndex, next
  // nav is precise.
  useEffect(() => {
    if (selectedIndex === undefined) return;
    const s = jumpState.current;
    const el = s.getItemElement(selectedIndex);
    if (el) {
      scrollRef.current?.scrollToElement(el, 1);
    } else {
      s.scrollToIndex(selectedIndex);
    }
  }, [selectedIndex, scrollRef]);

  // Pending seek request. jump() sets this + bumps seekGen. The seek
  // effect fires post-paint (passive effect — after resetAfterCommit),
  // checks if target is mounted. Yes → scan+highlight. No → re-estimate
  // with a fresher anchor (start moved toward idx) and scrollTo again.
  const scanRequestRef = useRef<{
    idx: number;
    wantLast: boolean;
    tries: number;
  } | null>(null);
  // Message-relative positions from scanElement. Row 0 = message top.
  // Stable across scroll — highlight computes rowOffset fresh. msgIdx
  // for computing rowOffset = getItemTop(msgIdx) - scrollTop.
  const elementPositions = useRef<{
    msgIdx: number;
    positions: MatchPosition[];
  }>({
    msgIdx: -1,
    positions: []
  });
  // Wraparound guard. Auto-advance stops if ptr wraps back to here.
  const startPtrRef = useRef(-1);
  // Phantom-burst cap. Resets on scan success.
  const phantomBurstRef = useRef(0);
  // One-deep queue: n/N arriving mid-seek gets stored (not dropped) and
  // fires after the seek completes. Holding n stays smooth without
  // queueing 30 jumps. Latest press overwrites — we want the direction
  // the user is going NOW, not where they were 10 keypresses ago.
  const pendingStepRef = useRef<1 | -1 | 0>(0);
  // step + highlight via ref so the seek effect reads latest without
  // closure-capture or deps churn.
  const stepRef = useRef<(d: 1 | -1) => void>(() => {});
  const highlightRef = useRef<(ord: number) => void>(() => {});
  const searchState = useRef({
    matches: [] as number[],
    // deduplicated msg indices
    ptr: 0,
    screenOrd: 0,
    // Cumulative engine-occurrence count before each matches[k]. Lets us
    // compute a global current index: prefixSum[ptr] + screenOrd + 1.
    // Engine-counted (indexOf on extractSearchText), not render-counted —
    // close enough for the badge; exact counts would need scanElement on
    // every matched message (~1-3ms × N). total = prefixSum[matches.length].
    prefixSum: [] as number[]
  });
  // scrollTop at the moment / was pressed. Incsearch preview-jumps snap
  // back here when matches drop to 0. -1 = no anchor (before first /).
  const searchAnchor = useRef(-1);
  const indexWarmed = useRef(false);

  // Scroll target for message i: land at MESSAGE TOP. est = top - HEADROOM
  // so lo = top - est = HEADROOM ≥ 0 (or lo = top if est clamped to 0).
  // Post-clamp read-back in jump() handles the scrollHeight boundary.
  // No frac (render transform didn't respect it), no monotone clamp
  // (was a safety net for frac garbage — without frac, est IS the next
  // message's top, spam-n/N converges because message tops are ordered).
  function targetFor(i: number): number {
    const top = jumpState.current.getItemTop(i);
    return Math.max(0, top - HEADROOM);
  }

  // Highlight positions[ord]. Positions are MESSAGE-RELATIVE (row 0 =
  // element top, from scanElement). Compute rowOffset = getItemTop -
  // scrollTop fresh. If ord's position is off-viewport, scroll to bring
  // it in, recompute rowOffset. setPositions triggers overlay write.
  function highlight(ord: number): void {
    const s = scrollRef.current;
    const {
      msgIdx,
      positions
    } = elementPositions.current;
    if (!s || positions.length === 0 || msgIdx < 0) {
      setPositions?.(null);
      return;
    }
    const idx = Math.max(0, Math.min(ord, positions.length - 1));
    const p = positions[idx]!;
    const top = jumpState.current.getItemTop(msgIdx);
    // lo = item's position within scroll content (wrapper-relative).
    // viewportTop = where the scroll content starts on SCREEN (after
    // ScrollBox padding/border + any chrome above). Highlight writes to
    // screen-absolute, so rowOffset = viewportTop + lo. Observed: off-by-
    // 1+ without viewportTop (FullscreenLayout has paddingTop=1 on the
    // ScrollBox, plus any header above).
    const vpTop = s.getViewportTop();
    let lo = top - s.getScrollTop();
    const vp = s.getViewportHeight();
    let screenRow = vpTop + lo + p.row;
    // Off viewport → scroll to bring it in (HEADROOM from top).
    // scrollTo commits sync; read-back after gives fresh lo.
    if (screenRow < vpTop || screenRow >= vpTop + vp) {
      s.scrollTo(Math.max(0, top + p.row - HEADROOM));
      lo = top - s.getScrollTop();
      screenRow = vpTop + lo + p.row;
    }
    setPositions?.({
      positions,
      rowOffset: vpTop + lo,
      currentIdx: idx
    });
    // Badge: global current = sum of occurrences before this msg + ord+1.
    // prefixSum[ptr] is engine-counted (indexOf on extractSearchText);
    // may drift from render-count for ghost messages but close enough —
    // badge is a rough location hint, not a proof.
    const st = searchState.current;
    const total = st.prefixSum.at(-1) ?? 0;
    const current = (st.prefixSum[st.ptr] ?? 0) + idx + 1;
    onSearchMatchesChange?.(total, current);
    logForDebugging(`highlight(i=${msgIdx}, ord=${idx}/${positions.length}): ` + `pos={row:${p.row},col:${p.col}} lo=${lo} screenRow=${screenRow} ` + `badge=${current}/${total}`);
  }
  highlightRef.current = highlight;

  // Seek effect. jump() sets scanRequestRef + scrollToIndex + bump.
  // bump → re-render → useVirtualScroll mounts the target (scrollToIndex
  // guarantees this — scrollTop and topSpacer agree via the same
  // offsets value) → resetAfterCommit paints → this passive effect
  // fires POST-PAINT with the element mounted. Precise scrollTo + scan.
  //
  // Dep is ONLY seekGen — effect doesn't re-run on random renders
  // (onSearchMatchesChange churn during incsearch).
  const [seekGen, setSeekGen] = useState(0);
  const bumpSeek = useCallback(() => setSeekGen(g => g + 1), []);
  useEffect(() => {
    const req = scanRequestRef.current;
    if (!req) return;
    const {
      idx,
      wantLast,
      tries
    } = req;
    const s = scrollRef.current;
    if (!s) return;
    const {
      getItemElement,
      getItemTop,
      scrollToIndex
    } = jumpState.current;
    const el = getItemElement(idx);
    const h = el?.yogaNode?.getComputedHeight() ?? 0;
    if (!el || h === 0) {
      // Not mounted after scrollToIndex. Shouldn't happen — scrollToIndex
      // guarantees mount by construction (scrollTop and topSpacer agree
      // via the same offsets value). Sanity: retry once, then skip.
      if (tries > 1) {
        scanRequestRef.current = null;
        logForDebugging(`seek(i=${idx}): no mount after scrollToIndex, skip`);
        stepRef.current(wantLast ? -1 : 1);
        return;
      }
      scanRequestRef.current = {
        idx,
        wantLast,
        tries: tries + 1
      };
      scrollToIndex(idx);
      bumpSeek();
      return;
    }
    scanRequestRef.current = null;
    // Precise scrollTo — scrollToIndex got us in the neighborhood
    // (item is mounted, maybe a few-dozen rows off due to overscan
    // estimate drift). Now land it at top-HEADROOM.
    s.scrollTo(Math.max(0, getItemTop(idx) - HEADROOM));
    const positions = scanElement?.(el) ?? [];
    elementPositions.current = {
      msgIdx: idx,
      positions
    };
    logForDebugging(`seek(i=${idx} t=${tries}): ${positions.length} positions`);
    if (positions.length === 0) {
      // Phantom — engine matched, render didn't. Auto-advance.
      if (++phantomBurstRef.current > 20) {
        phantomBurstRef.current = 0;
        return;
      }
      stepRef.current(wantLast ? -1 : 1);
      return;
    }
    phantomBurstRef.current = 0;
    const ord = wantLast ? positions.length - 1 : 0;
    searchState.current.screenOrd = ord;
    startPtrRef.current = -1;
    highlightRef.current(ord);
    const pending = pendingStepRef.current;
    if (pending) {
      pendingStepRef.current = 0;
      stepRef.current(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekGen]);

  // Scroll to message i's top, arm scanPending. scan-effect reads fresh
  // screen next tick. wantLast: N-into-message — screenOrd = length-1.
  function jump(i: number, wantLast: boolean): void {
    const s = scrollRef.current;
    if (!s) return;
    const js = jumpState.current;
    const {
      getItemElement,
      scrollToIndex
    } = js;
    // offsets is a Float64Array whose .length is the allocated buffer (only
    // grows) — messages.length is the logical item count.
    if (i < 0 || i >= js.messages.length) return;
    // Clear stale highlight before scroll. Between now and the seek
    // effect's highlight, inverse-only from scan-highlight shows.
    setPositions?.(null);
    elementPositions.current = {
      msgIdx: -1,
      positions: []
    };
    scanRequestRef.current = {
      idx: i,
      wantLast,
      tries: 0
    };
    const el = getItemElement(i);
    const h = el?.yogaNode?.getComputedHeight() ?? 0;
    // Mounted → precise scrollTo. Unmounted → scrollToIndex mounts it
    // (scrollTop and topSpacer agree via the same offsets value — exact
    // by construction, no estimation). Seek effect does the precise
    // scrollTo after paint either way.
    if (el && h > 0) {
      s.scrollTo(targetFor(i));
    } else {
      scrollToIndex(i);
    }
    bumpSeek();
  }

  // Advance screenOrd within elementPositions. Exhausted → ptr advances,
  // jump to next matches[ptr], re-scan. Phantom (scan found 0 after
  // jump) triggers auto-advance from scan-effect. Wraparound guard stops
  // if every message is a phantom.
  function step(delta: 1 | -1): void {
    const st = searchState.current;
    const {
      matches,
      prefixSum
    } = st;
    const total = prefixSum.at(-1) ?? 0;
    if (matches.length === 0) return;

    // Seek in-flight — queue this press (one-deep, latest overwrites).
    // The seek effect fires it after highlight.
    if (scanRequestRef.current) {
      pendingStepRef.current = delta;
      return;
    }
    if (startPtrRef.current < 0) startPtrRef.current = st.ptr;
    const {
      positions
    } = elementPositions.current;
    const newOrd = st.screenOrd + delta;
    if (newOrd >= 0 && newOrd < positions.length) {
      st.screenOrd = newOrd;
      highlight(newOrd); // updates badge internally
      startPtrRef.current = -1;
      return;
    }

    // Exhausted visible. Advance ptr → jump → re-scan.
    const ptr = (st.ptr + delta + matches.length) % matches.length;
    if (ptr === startPtrRef.current) {
      setPositions?.(null);
      startPtrRef.current = -1;
      logForDebugging(`step: wraparound at ptr=${ptr}, all ${matches.length} msgs phantoms`);
      return;
    }
    st.ptr = ptr;
    st.screenOrd = 0; // resolved after scan (wantLast → length-1)
    jump(matches[ptr]!, delta < 0);
    // screenOrd will resolve after scan. Best-effort: prefixSum[ptr] + 0
    // for n (first pos), prefixSum[ptr+1] for N (last pos = count-1).
    // The scan-effect's highlight will be the real value; this is a
    // pre-scan placeholder so the badge updates immediately.
    const placeholder = delta < 0 ? prefixSum[ptr + 1] ?? total : prefixSum[ptr]! + 1;
    onSearchMatchesChange?.(total, placeholder);
  }
  stepRef.current = step;
  useImperativeHandle(jumpRef, () => ({
    // Non-search jump (sticky header click, etc). No scan, no positions.
    jumpToIndex: (i: number) => {
      const s = scrollRef.current;
      if (s) s.scrollTo(targetFor(i));
    },
    setSearchQuery: (q: string) => {
      // New search invalidates everything.
      scanRequestRef.current = null;
      elementPositions.current = {
        msgIdx: -1,
        positions: []
      };
      startPtrRef.current = -1;
      setPositions?.(null);
      const lq = q.toLowerCase();
      // One entry per MESSAGE (deduplicated). Boolean "does this msg
      // contain the query". ~10ms for 9k messages with cached lowered.
      const matches: number[] = [];
      // Per-message occurrence count → prefixSum for global current
      // index. Engine-counted (cheap indexOf loop); may differ from
      // render-count (scanElement) for ghost/phantom messages but close
      // enough for the badge. The badge is a rough location hint.
      const prefixSum: number[] = [0];
      if (lq) {
        const msgs = jumpState.current.messages;
        for (let i = 0; i < msgs.length; i++) {
          const text = extractSearchText(msgs[i]!);
          let pos = text.indexOf(lq);
          let cnt = 0;
          while (pos >= 0) {
            cnt++;
            pos = text.indexOf(lq, pos + lq.length);
          }
          if (cnt > 0) {
            matches.push(i);
            prefixSum.push(prefixSum.at(-1)! + cnt);
          }
        }
      }
      const total = prefixSum.at(-1)!;
      // Nearest MESSAGE to the anchor. <= so ties go to later.
      let ptr = 0;
      const s = scrollRef.current;
      const {
        offsets,
        start,
        getItemTop
      } = jumpState.current;
      const firstTop = getItemTop(start);
      const origin = firstTop >= 0 ? firstTop - offsets[start]! : 0;
      if (matches.length > 0 && s) {
        const curTop = searchAnchor.current >= 0 ? searchAnchor.current : s.getScrollTop();
        let best = Infinity;
        for (let k = 0; k < matches.length; k++) {
          const d = Math.abs(origin + offsets[matches[k]!]! - curTop);
          if (d <= best) {
            best = d;
            ptr = k;
          }
        }
        logForDebugging(`setSearchQuery('${q}'): ${matches.length} msgs · ptr=${ptr} ` + `msgIdx=${matches[ptr]} curTop=${curTop} origin=${origin}`);
      }
      searchState.current = {
        matches,
        ptr,
        screenOrd: 0,
        prefixSum
      };
      if (matches.length > 0) {
        // wantLast=true: preview the LAST occurrence in the nearest
        // message. At sticky-bottom (common / entry), nearest is the
        // last msg; its last occurrence is closest to where the user
        // was — minimal view movement. n advances forward from there.
        jump(matches[ptr]!, true);
      } else if (searchAnchor.current >= 0 && s) {
        // /foob → 0 matches → snap back to anchor. less/vim incsearch.
        s.scrollTo(searchAnchor.current);
      }
      // Global occurrence count + 1-based current. wantLast=true so the
      // scan will land on the last occurrence in matches[ptr]. Placeholder
      // = prefixSum[ptr+1] (count through this msg). highlight() updates
      // to the exact value after scan completes.
      onSearchMatchesChange?.(total, matches.length > 0 ? prefixSum[ptr + 1] ?? total : 0);
    },
    nextMatch: () => step(1),
    prevMatch: () => step(-1),
    setAnchor: () => {
      const s = scrollRef.current;
      if (s) searchAnchor.current = s.getScrollTop();
    },
    disarmSearch: () => {
      // Manual scroll invalidates screen-absolute positions.
      setPositions?.(null);
      scanRequestRef.current = null;
      elementPositions.current = {
        msgIdx: -1,
        positions: []
      };
      startPtrRef.current = -1;
    },
    warmSearchIndex: async () => {
      if (indexWarmed.current) return 0;
      const msgs = jumpState.current.messages;
      const CHUNK = 500;
      let workMs = 0;
      const wallStart = performance.now();
      for (let i = 0; i < msgs.length; i += CHUNK) {
        await sleep(0);
        const t0 = performance.now();
        const end = Math.min(i + CHUNK, msgs.length);
        for (let j = i; j < end; j++) {
          extractSearchText(msgs[j]!);
        }
        workMs += performance.now() - t0;
      }
      const wallMs = Math.round(performance.now() - wallStart);
      logForDebugging(`warmSearchIndex: ${msgs.length} msgs · work=${Math.round(workMs)}ms wall=${wallMs}ms chunks=${Math.ceil(msgs.length / CHUNK)}`);
      indexWarmed.current = true;
      return Math.round(workMs);
    }
  }),
  // Closures over refs + callbacks. scrollRef stable; others are
  // useCallback([]) or prop-drilled from REPL (stable).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [scrollRef]);

  // StickyTracker goes AFTER the list content. It returns null (no DOM node)
  // so order shouldn't matter for layout — but putting it first means every
  // fine-grained commit from its own scroll subscription reconciles THROUGH
  // the sibling items (React walks children in order). After the items, it's
  // a leaf reconcile. Defensive: also avoids any Yoga child-index quirks if
  // the Ink reconciler ever materializes a placeholder for null returns.
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  // Stable click/hover handlers — called with k, dispatch from a ref so
  // closure identity doesn't change per render. The per-item handler
  // closures (`e => ...`, `() => setHoveredKey(k)`) were the
  // `operationNewArrowFunction` leafs in the scroll CPU profile; their
  // cleanup was 16% of GC time (`FunctionExecutable::finalizeUnconditionally`).
  // Allocating 3 closures × 60 mounted items × 10 commits/sec during fast
  // scroll = 1800 short-lived closures/sec. With stable refs the item
  // wrapper props don't change → VirtualItem.memo bails for the ~35
  // unchanged items, only ~25 fresh items pay createElement cost.
  const handlersRef = useRef({
    onItemClick,
    setHoveredKey
  });
  handlersRef.current = {
    onItemClick,
    setHoveredKey
  };
  const onClickK = useCallback((msg: RenderableMessage, cellIsBlank: boolean) => {
    const h = handlersRef.current;
    if (!cellIsBlank && h.onItemClick) h.onItemClick(msg);
  }, []);
  const onEnterK = useCallback((k: string) => {
    handlersRef.current.setHoveredKey(k);
  }, []);
  const onLeaveK = useCallback((k: string) => {
    handlersRef.current.setHoveredKey(prev => prev === k ? null : prev);
  }, []);
  return <>
      <Box ref={spacerRef} height={topSpacer} flexShrink={0} />
      {messages.slice(start, end).map((msg, i) => {
      const idx = start + i;
      const k = keys[idx]!;
      const clickable = !!onItemClick && (isItemClickable?.(msg) ?? true);
      const hovered = clickable && hoveredKey === k;
      const expanded = isItemExpanded?.(msg);
      return <VirtualItem key={k} itemKey={k} msg={msg} idx={idx} measureRef={measureRef} expanded={expanded} hovered={hovered} clickable={clickable} onClickK={onClickK} onEnterK={onEnterK} onLeaveK={onLeaveK} renderItem={renderItem} />;
    })}
      {bottomSpacer > 0 && <Box height={bottomSpacer} flexShrink={0} />}
      {trackStickyPrompt && <StickyTracker messages={messages} start={start} end={end} offsets={offsets} getItemTop={getItemTop} getItemElement={getItemElement} scrollRef={scrollRef} />}
    </>;
}
const NOOP_UNSUB = () => {};

/**
 * Effect-only child that tracks the last user-prompt scrolled above the
 * viewport top and fires onChange when it changes.
 *
 * Rendered as a separate component (not a hook in VirtualMessageList) so it
 * can subscribe to scroll at FINER granularity than SCROLL_QUANTUM=40. The
 * list needs the coarse quantum to avoid per-wheel-tick Yoga relayouts; this
 * tracker is just a walk + comparison and can afford to run every tick. When
 * it re-renders alone, the list's reconciled output is unchanged (same props
 * from the parent's last commit) — no Yoga work. Without this split, the
 * header lags by ~one conversation turn (40 rows ≈ one prompt + response).
 *
 * firstVisible derivation: item Boxes are direct Yoga children of the
 * ScrollBox content wrapper (fragments collapse in the Ink DOM), so
 * yoga.getComputedTop is content-wrapper-relative — same coordinate space as
 * scrollTop. Compare against scrollTop + pendingDelta (the scroll TARGET —
 * scrollBy only sets pendingDelta, committed scrollTop lags). Walk backward
 * from the mount-range end; break when an item's top is above target.
 */
function StickyTracker({
  messages,
  start,
  end,
  offsets,
  getItemTop,
  getItemElement,
  scrollRef
}: {
  messages: RenderableMessage[];
  start: number;
  end: number;
  offsets: ArrayLike<number>;
  getItemTop: (index: number) => number;
  getItemElement: (index: number) => DOMElement | null;
  scrollRef: RefObject<ScrollBoxHandle | null>;
}): null {
  const {
    setStickyPrompt
  } = useContext(ScrollChromeContext);
  // Fine-grained subscription — snapshot is unquantized scrollTop+delta so
  // every scroll action (wheel tick, PgUp, drag) triggers a re-render of
  // THIS component only. Sticky bit folded into the sign so sticky→broken
  // also triggers (scrollToBottom sets sticky without moving scrollTop).
  const subscribe = useCallback((listener: () => void) => scrollRef.current?.subscribe(listener) ?? NOOP_UNSUB, [scrollRef]);
  useSyncExternalStore(subscribe, () => {
    const s = scrollRef.current;
    if (!s) return NaN;
    const t = s.getScrollTop() + s.getPendingDelta();
    return s.isSticky() ? -1 - t : t;
  });

  // Read live scroll state on every render.
  const isSticky = scrollRef.current?.isSticky() ?? true;
  const target = Math.max(0, (scrollRef.current?.getScrollTop() ?? 0) + (scrollRef.current?.getPendingDelta() ?? 0));

  // Walk the mounted range to find the first item at-or-below the viewport
  // top. `range` is from the parent's coarse-quantum render (may be slightly
  // stale) but overscan guarantees it spans well past the viewport in both
  // directions. Items without a Yoga layout yet (newly mounted this frame)
  // are treated as at-or-below — they're somewhere in view, and assuming
  // otherwise would show a sticky for a prompt that's actually on screen.
  let firstVisible = start;
  let firstVisibleTop = -1;
  for (let i = end - 1; i >= start; i--) {
    const top = getItemTop(i);
    if (top >= 0) {
      if (top < target) break;
      firstVisibleTop = top;
    }
    firstVisible = i;
  }
  let idx = -1;
  let text: string | null = null;
  if (firstVisible > 0 && !isSticky) {
    for (let i = firstVisible - 1; i >= 0; i--) {
      const t = stickyPromptText(messages[i]!);
      if (t === null) continue;
      // The prompt's wrapping Box top is above target (that's why it's in
      // the [0, firstVisible) range), but its ❯ is at top+1 (marginTop=1).
      // If the ❯ is at-or-below target, it's VISIBLE at viewport top —
      // showing the same text in the header would duplicate it. Happens
      // in the 1-row gap between Box top scrolling past and ❯ scrolling
      // past. Skip to the next-older prompt (its ❯ is definitely above).
      const top = getItemTop(i);
      if (top >= 0 && top + 1 >= target) continue;
      idx = i;
      text = t;
      break;
    }
  }
  const baseOffset = firstVisibleTop >= 0 ? firstVisibleTop - offsets[firstVisible]! : 0;
  const estimate = idx >= 0 ? Math.max(0, baseOffset + offsets[idx]!) : -1;

  // For click-jumps to items not yet mounted (user scrolled far past,
  // prompt is in the topSpacer). Click handler scrolls to the estimate
  // to mount it; this anchors by element once it appears. scrollToElement
  // defers the Yoga-position read to render time (render-node-to-output
  // reads el.yogaNode.getComputedTop() in the SAME calculateLayout pass
  // that produces scrollHeight) — no throttle race. Cap retries: a /clear
  // race could unmount the item mid-sequence.
  const pending = useRef({
    idx: -1,
    tries: 0
  });
  // Suppression state machine. The click handler arms; the onChange effect
  // consumes (armed→force) then fires-and-clears on the render AFTER that
  // (force→none). The force step poisons the dedup: after click, idx often
  // recomputes to the SAME prompt (its top is still above target), so
  // without force the last.idx===idx guard would hold 'clicked' until the
  // user crossed a prompt boundary. Previously encoded in last.idx as
  // -1/-2/-3 which overlapped with real indices — too clever.
  type Suppress = 'none' | 'armed' | 'force';
  const suppress = useRef<Suppress>('none');
  // Dedup on idx only — estimate derives from firstVisibleTop which shifts
  // every scroll tick, so including it in the key made the guard dead
  // (setStickyPrompt fired a fresh {text,scrollTo} per-frame). The scrollTo
  // closure still captures the current estimate; it just doesn't need to
  // re-fire when only estimate moved.
  const lastIdx = useRef(-1);

  // setStickyPrompt effect FIRST — must see pending.idx before the
  // correction effect below clears it. On the estimate-fallback path, the
  // render that mounts the item is ALSO the render where correction clears
  // pending; if this ran second, the pending gate would be dead and
  // setStickyPrompt(prevPrompt) would fire mid-jump, re-mounting the
  // header over 'clicked'.
  useEffect(() => {
    // Hold while two-phase correction is in flight.
    if (pending.current.idx >= 0) return;
    if (suppress.current === 'armed') {
      suppress.current = 'force';
      return;
    }
    const force = suppress.current === 'force';
    suppress.current = 'none';
    if (!force && lastIdx.current === idx) return;
    lastIdx.current = idx;
    if (text === null) {
      setStickyPrompt(null);
      return;
    }
    // First paragraph only (split on blank line) — a prompt like
    // "still seeing bugs:\n\n1. foo\n2. bar" previews as just the
    // lead-in. trimStart so a leading blank line (queued_command mid-
    // turn messages sometimes have one) doesn't find paraEnd at 0.
    const trimmed = text.trimStart();
    const paraEnd = trimmed.search(/\n\s*\n/);
    const collapsed = (paraEnd >= 0 ? trimmed.slice(0, paraEnd) : trimmed).slice(0, STICKY_TEXT_CAP).replace(/\s+/g, ' ').trim();
    if (collapsed === '') {
      setStickyPrompt(null);
      return;
    }
    const capturedIdx = idx;
    const capturedEstimate = estimate;
    setStickyPrompt({
      text: collapsed,
      scrollTo: () => {
        // Hide header, keep padding collapsed — FullscreenLayout's
        // 'clicked' sentinel → scrollBox_y=0 + pad=0 → viewportTop=0.
        setStickyPrompt('clicked');
        suppress.current = 'armed';
        // scrollToElement anchors by DOMElement ref, not a number:
        // render-node-to-output reads el.yogaNode.getComputedTop() at
        // paint time (same Yoga pass as scrollHeight). No staleness from
        // the throttled render — the ref is stable, the position read is
        // deferred. offset=1 = UserPromptMessage marginTop.
        const el = getItemElement(capturedIdx);
        if (el) {
          scrollRef.current?.scrollToElement(el, 1);
        } else {
          // Not mounted (scrolled far past — in topSpacer). Jump to
          // estimate to mount it; correction effect re-anchors once it
          // appears. Estimate is DEFAULT_ESTIMATE-based — lands short.
          scrollRef.current?.scrollTo(capturedEstimate);
          pending.current = {
            idx: capturedIdx,
            tries: 0
          };
        }
      }
    });
    // No deps — must run every render. Suppression state lives in a ref
    // (not idx/estimate), so a deps-gated effect would never see it tick.
    // Body's own guards short-circuit when nothing changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  // Correction: for click-jumps to unmounted items. Click handler scrolled
  // to the estimate; this re-anchors by element once the item appears.
  // scrollToElement defers the Yoga read to paint time — deterministic.
  // SECOND so it clears pending AFTER the onChange gate above has seen it.
  useEffect(() => {
    if (pending.current.idx < 0) return;
    const el = getItemElement(pending.current.idx);
    if (el) {
      scrollRef.current?.scrollToElement(el, 1);
      pending.current = {
        idx: -1,
        tries: 0
      };
    } else if (++pending.current.tries > 5) {
      pending.current = {
        idx: -1,
        tries: 0
      };
    }
  });
  return null;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWZPYmplY3QiLCJSZWFjdCIsInVzZUNhbGxiYWNrIiwidXNlQ29udGV4dCIsInVzZUVmZmVjdCIsInVzZUltcGVyYXRpdmVIYW5kbGUiLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsInVzZVN5bmNFeHRlcm5hbFN0b3JlIiwidXNlVmlydHVhbFNjcm9sbCIsIlNjcm9sbEJveEhhbmRsZSIsIkRPTUVsZW1lbnQiLCJNYXRjaFBvc2l0aW9uIiwiQm94IiwiUmVuZGVyYWJsZU1lc3NhZ2UiLCJUZXh0SG92ZXJDb2xvckNvbnRleHQiLCJTY3JvbGxDaHJvbWVDb250ZXh0IiwiSEVBRFJPT00iLCJsb2dGb3JEZWJ1Z2dpbmciLCJzbGVlcCIsInJlbmRlcmFibGVTZWFyY2hUZXh0IiwiaXNOYXZpZ2FibGVNZXNzYWdlIiwiTWVzc2FnZUFjdGlvbnNOYXYiLCJNZXNzYWdlQWN0aW9uc1N0YXRlIiwiTmF2aWdhYmxlTWVzc2FnZSIsInN0cmlwU3lzdGVtUmVtaW5kZXJzIiwidG9vbENhbGxPZiIsImZhbGxiYWNrTG93ZXJDYWNoZSIsIldlYWtNYXAiLCJkZWZhdWx0RXh0cmFjdFNlYXJjaFRleHQiLCJtc2ciLCJjYWNoZWQiLCJnZXQiLCJ1bmRlZmluZWQiLCJsb3dlcmVkIiwic2V0IiwiU3RpY2t5UHJvbXB0IiwidGV4dCIsInNjcm9sbFRvIiwiU1RJQ0tZX1RFWFRfQ0FQIiwiSnVtcEhhbmRsZSIsImp1bXBUb0luZGV4IiwiaSIsInNldFNlYXJjaFF1ZXJ5IiwicSIsIm5leHRNYXRjaCIsInByZXZNYXRjaCIsInNldEFuY2hvciIsIndhcm1TZWFyY2hJbmRleCIsIlByb21pc2UiLCJkaXNhcm1TZWFyY2giLCJQcm9wcyIsIm1lc3NhZ2VzIiwic2Nyb2xsUmVmIiwiY29sdW1ucyIsIml0ZW1LZXkiLCJyZW5kZXJJdGVtIiwiaW5kZXgiLCJSZWFjdE5vZGUiLCJvbkl0ZW1DbGljayIsImlzSXRlbUNsaWNrYWJsZSIsImlzSXRlbUV4cGFuZGVkIiwiZXh0cmFjdFNlYXJjaFRleHQiLCJ0cmFja1N0aWNreVByb21wdCIsInNlbGVjdGVkSW5kZXgiLCJjdXJzb3JOYXZSZWYiLCJSZWYiLCJzZXRDdXJzb3IiLCJjIiwianVtcFJlZiIsIm9uU2VhcmNoTWF0Y2hlc0NoYW5nZSIsImNvdW50IiwiY3VycmVudCIsInNjYW5FbGVtZW50IiwiZWwiLCJzZXRQb3NpdGlvbnMiLCJzdGF0ZSIsInBvc2l0aW9ucyIsInJvd09mZnNldCIsImN1cnJlbnRJZHgiLCJwcm9tcHRUZXh0Q2FjaGUiLCJzdGlja3lQcm9tcHRUZXh0IiwicmVzdWx0IiwiY29tcHV0ZVN0aWNreVByb21wdFRleHQiLCJyYXciLCJ0eXBlIiwiaXNNZXRhIiwiaXNWaXNpYmxlSW5UcmFuc2NyaXB0T25seSIsImJsb2NrIiwibWVzc2FnZSIsImNvbnRlbnQiLCJhdHRhY2htZW50IiwiY29tbWFuZE1vZGUiLCJwIiwicHJvbXB0IiwiZmxhdE1hcCIsImIiLCJqb2luIiwidCIsInN0YXJ0c1dpdGgiLCJWaXJ0dWFsSXRlbVByb3BzIiwiaWR4IiwibWVhc3VyZVJlZiIsImtleSIsImV4cGFuZGVkIiwiaG92ZXJlZCIsImNsaWNrYWJsZSIsIm9uQ2xpY2tLIiwiY2VsbElzQmxhbmsiLCJvbkVudGVySyIsImsiLCJvbkxlYXZlSyIsIlZpcnR1YWxJdGVtIiwidDAiLCIkIiwiX2MiLCJ0MSIsInQyIiwidDMiLCJ0NCIsImUiLCJ0NSIsInQ2IiwidDciLCJ0OCIsInQ5IiwidDEwIiwiVmlydHVhbE1lc3NhZ2VMaXN0Iiwia2V5c1JlZiIsInByZXZNZXNzYWdlc1JlZiIsInByZXZJdGVtS2V5UmVmIiwibGVuZ3RoIiwibWFwIiwibSIsInB1c2giLCJrZXlzIiwicmFuZ2UiLCJ0b3BTcGFjZXIiLCJib3R0b21TcGFjZXIiLCJzcGFjZXJSZWYiLCJvZmZzZXRzIiwiZ2V0SXRlbVRvcCIsImdldEl0ZW1FbGVtZW50IiwiZ2V0SXRlbUhlaWdodCIsInNjcm9sbFRvSW5kZXgiLCJzdGFydCIsImVuZCIsImlzVmlzaWJsZSIsImgiLCJzZWxlY3QiLCJ1dWlkIiwibXNnVHlwZSIsInRvb2xOYW1lIiwibmFtZSIsInNlbElkeCIsInNjYW4iLCJmcm9tIiwiZGlyIiwicHJlZCIsImlzVXNlciIsImVudGVyQ3Vyc29yIiwibmF2aWdhdGVQcmV2IiwibmF2aWdhdGVOZXh0Iiwic2Nyb2xsVG9Cb3R0b20iLCJuYXZpZ2F0ZVByZXZVc2VyIiwibmF2aWdhdGVOZXh0VXNlciIsIm5hdmlnYXRlVG9wIiwibmF2aWdhdGVCb3R0b20iLCJnZXRTZWxlY3RlZCIsImp1bXBTdGF0ZSIsInMiLCJzY3JvbGxUb0VsZW1lbnQiLCJzY2FuUmVxdWVzdFJlZiIsIndhbnRMYXN0IiwidHJpZXMiLCJlbGVtZW50UG9zaXRpb25zIiwibXNnSWR4Iiwic3RhcnRQdHJSZWYiLCJwaGFudG9tQnVyc3RSZWYiLCJwZW5kaW5nU3RlcFJlZiIsInN0ZXBSZWYiLCJkIiwiaGlnaGxpZ2h0UmVmIiwib3JkIiwic2VhcmNoU3RhdGUiLCJtYXRjaGVzIiwicHRyIiwic2NyZWVuT3JkIiwicHJlZml4U3VtIiwic2VhcmNoQW5jaG9yIiwiaW5kZXhXYXJtZWQiLCJ0YXJnZXRGb3IiLCJ0b3AiLCJNYXRoIiwibWF4IiwiaGlnaGxpZ2h0IiwibWluIiwidnBUb3AiLCJnZXRWaWV3cG9ydFRvcCIsImxvIiwiZ2V0U2Nyb2xsVG9wIiwidnAiLCJnZXRWaWV3cG9ydEhlaWdodCIsInNjcmVlblJvdyIsInJvdyIsInN0IiwidG90YWwiLCJhdCIsImNvbCIsInNlZWtHZW4iLCJzZXRTZWVrR2VuIiwiYnVtcFNlZWsiLCJnIiwicmVxIiwieW9nYU5vZGUiLCJnZXRDb21wdXRlZEhlaWdodCIsInBlbmRpbmciLCJqdW1wIiwianMiLCJzdGVwIiwiZGVsdGEiLCJuZXdPcmQiLCJwbGFjZWhvbGRlciIsImxxIiwidG9Mb3dlckNhc2UiLCJtc2dzIiwicG9zIiwiaW5kZXhPZiIsImNudCIsImZpcnN0VG9wIiwib3JpZ2luIiwiY3VyVG9wIiwiYmVzdCIsIkluZmluaXR5IiwiYWJzIiwiQ0hVTksiLCJ3b3JrTXMiLCJ3YWxsU3RhcnQiLCJwZXJmb3JtYW5jZSIsIm5vdyIsImoiLCJ3YWxsTXMiLCJyb3VuZCIsImNlaWwiLCJob3ZlcmVkS2V5Iiwic2V0SG92ZXJlZEtleSIsImhhbmRsZXJzUmVmIiwicHJldiIsInNsaWNlIiwiTk9PUF9VTlNVQiIsIlN0aWNreVRyYWNrZXIiLCJBcnJheUxpa2UiLCJzZXRTdGlja3lQcm9tcHQiLCJzdWJzY3JpYmUiLCJsaXN0ZW5lciIsIk5hTiIsImdldFBlbmRpbmdEZWx0YSIsImlzU3RpY2t5IiwidGFyZ2V0IiwiZmlyc3RWaXNpYmxlIiwiZmlyc3RWaXNpYmxlVG9wIiwiYmFzZU9mZnNldCIsImVzdGltYXRlIiwiU3VwcHJlc3MiLCJzdXBwcmVzcyIsImxhc3RJZHgiLCJmb3JjZSIsInRyaW1tZWQiLCJ0cmltU3RhcnQiLCJwYXJhRW5kIiwic2VhcmNoIiwiY29sbGFwc2VkIiwicmVwbGFjZSIsInRyaW0iLCJjYXB0dXJlZElkeCIsImNhcHR1cmVkRXN0aW1hdGUiXSwic291cmNlcyI6WyJWaXJ0dWFsTWVzc2FnZUxpc3QudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgUmVmT2JqZWN0IH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7XG4gIHVzZUNhbGxiYWNrLFxuICB1c2VDb250ZXh0LFxuICB1c2VFZmZlY3QsXG4gIHVzZUltcGVyYXRpdmVIYW5kbGUsXG4gIHVzZVJlZixcbiAgdXNlU3RhdGUsXG4gIHVzZVN5bmNFeHRlcm5hbFN0b3JlLFxufSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHVzZVZpcnR1YWxTY3JvbGwgfSBmcm9tICcuLi9ob29rcy91c2VWaXJ0dWFsU2Nyb2xsLmpzJ1xuaW1wb3J0IHR5cGUgeyBTY3JvbGxCb3hIYW5kbGUgfSBmcm9tICcuLi9pbmsvY29tcG9uZW50cy9TY3JvbGxCb3guanMnXG5pbXBvcnQgdHlwZSB7IERPTUVsZW1lbnQgfSBmcm9tICcuLi9pbmsvZG9tLmpzJ1xuaW1wb3J0IHR5cGUgeyBNYXRjaFBvc2l0aW9uIH0gZnJvbSAnLi4vaW5rL3JlbmRlci10by1zY3JlZW4uanMnXG5pbXBvcnQgeyBCb3ggfSBmcm9tICcuLi9pbmsuanMnXG5pbXBvcnQgdHlwZSB7IFJlbmRlcmFibGVNZXNzYWdlIH0gZnJvbSAnLi4vdHlwZXMvbWVzc2FnZS5qcydcbmltcG9ydCB7IFRleHRIb3ZlckNvbG9yQ29udGV4dCB9IGZyb20gJy4vZGVzaWduLXN5c3RlbS9UaGVtZWRUZXh0LmpzJ1xuaW1wb3J0IHsgU2Nyb2xsQ2hyb21lQ29udGV4dCB9IGZyb20gJy4vRnVsbHNjcmVlbkxheW91dC5qcydcblxuLy8gUm93cyBvZiBicmVhdGhpbmcgcm9vbSBhYm92ZSB0aGUgdGFyZ2V0IHdoZW4gd2Ugc2Nyb2xsVG8uXG5jb25zdCBIRUFEUk9PTSA9IDNcblxuaW1wb3J0IHsgbG9nRm9yRGVidWdnaW5nIH0gZnJvbSAnLi4vdXRpbHMvZGVidWcuanMnXG5pbXBvcnQgeyBzbGVlcCB9IGZyb20gJy4uL3V0aWxzL3NsZWVwLmpzJ1xuaW1wb3J0IHsgcmVuZGVyYWJsZVNlYXJjaFRleHQgfSBmcm9tICcuLi91dGlscy90cmFuc2NyaXB0U2VhcmNoLmpzJ1xuaW1wb3J0IHtcbiAgaXNOYXZpZ2FibGVNZXNzYWdlLFxuICB0eXBlIE1lc3NhZ2VBY3Rpb25zTmF2LFxuICB0eXBlIE1lc3NhZ2VBY3Rpb25zU3RhdGUsXG4gIHR5cGUgTmF2aWdhYmxlTWVzc2FnZSxcbiAgc3RyaXBTeXN0ZW1SZW1pbmRlcnMsXG4gIHRvb2xDYWxsT2YsXG59IGZyb20gJy4vbWVzc2FnZUFjdGlvbnMuanMnXG5cbi8vIEZhbGxiYWNrIGV4dHJhY3RvcjogbG93ZXIgKyBjYWNoZSBoZXJlIGZvciBjYWxsZXJzIHdpdGhvdXQgdGhlXG4vLyBNZXNzYWdlcy50c3ggdG9vbC1sb29rdXAgcGF0aCAodGVzdHMsIHN0YXRpYyBjb250ZXh0cykuIE1lc3NhZ2VzLnRzeFxuLy8gcHJvdmlkZXMgaXRzIG93biBsb3dlcmluZyBjYWNoZSB0aGF0IGFsc28gaGFuZGxlcyB0b29sIGV4dHJhY3RTZWFyY2hUZXh0LlxuY29uc3QgZmFsbGJhY2tMb3dlckNhY2hlID0gbmV3IFdlYWtNYXA8UmVuZGVyYWJsZU1lc3NhZ2UsIHN0cmluZz4oKVxuZnVuY3Rpb24gZGVmYXVsdEV4dHJhY3RTZWFyY2hUZXh0KG1zZzogUmVuZGVyYWJsZU1lc3NhZ2UpOiBzdHJpbmcge1xuICBjb25zdCBjYWNoZWQgPSBmYWxsYmFja0xvd2VyQ2FjaGUuZ2V0KG1zZylcbiAgaWYgKGNhY2hlZCAhPT0gdW5kZWZpbmVkKSByZXR1cm4gY2FjaGVkXG4gIGNvbnN0IGxvd2VyZWQgPSByZW5kZXJhYmxlU2VhcmNoVGV4dChtc2cpXG4gIGZhbGxiYWNrTG93ZXJDYWNoZS5zZXQobXNnLCBsb3dlcmVkKVxuICByZXR1cm4gbG93ZXJlZFxufVxuXG5leHBvcnQgdHlwZSBTdGlja3lQcm9tcHQgPVxuICB8IHsgdGV4dDogc3RyaW5nOyBzY3JvbGxUbzogKCkgPT4gdm9pZCB9XG4gIC8vIENsaWNrIHNldHMgdGhpcyDigJQgaGVhZGVyIEhJREVTIGJ1dCBwYWRkaW5nIHN0YXlzIGNvbGxhcHNlZCAoMCkgc29cbiAgLy8gdGhlIGNvbnRlbnQg4p2vIGxhbmRzIGF0IHNjcmVlbiByb3cgMCBpbnN0ZWFkIG9mIHJvdyAxLiBDbGVhcmVkIG9uXG4gIC8vIHRoZSBuZXh0IHN0aWNreS1wcm9tcHQgY29tcHV0ZSAodXNlciBzY3JvbGxzIGFnYWluKS5cbiAgfCAnY2xpY2tlZCdcblxuLyoqIEh1Z2UgcGFzdGVkIHByb21wdHMgKGNhdCBmaWxlIHwgY2xhdWRlKSBjYW4gYmUgTUJzLiBIZWFkZXIgd3JhcHMgaW50b1xuICogIDIgcm93cyB2aWEgb3ZlcmZsb3c6aGlkZGVuIOKAlCB0aGlzIGp1c3QgYm91bmRzIHRoZSBSZWFjdCBwcm9wIHNpemUuICovXG5jb25zdCBTVElDS1lfVEVYVF9DQVAgPSA1MDBcblxuLyoqIEltcGVyYXRpdmUgaGFuZGxlIGZvciB0cmFuc2NyaXB0IG5hdmlnYXRpb24uIE1ldGhvZHMgY29tcHV0ZSBtYXRjaGVzXG4gKiAgSEVSRSAocmVuZGVyYWJsZU1lc3NhZ2VzIGluZGljZXMgYXJlIG9ubHkgdmFsaWQgaW5zaWRlIHRoaXMgY29tcG9uZW50IOKAlFxuICogIE1lc3NhZ2VzLnRzeCBmaWx0ZXJzIGFuZCByZW9yZGVycywgUkVQTCBjYW4ndCBjb21wdXRlIGV4dGVybmFsbHkpLiAqL1xuZXhwb3J0IHR5cGUgSnVtcEhhbmRsZSA9IHtcbiAganVtcFRvSW5kZXg6IChpOiBudW1iZXIpID0+IHZvaWRcbiAgc2V0U2VhcmNoUXVlcnk6IChxOiBzdHJpbmcpID0+IHZvaWRcbiAgbmV4dE1hdGNoOiAoKSA9PiB2b2lkXG4gIHByZXZNYXRjaDogKCkgPT4gdm9pZFxuICAvKiogQ2FwdHVyZSBjdXJyZW50IHNjcm9sbFRvcCBhcyB0aGUgaW5jc2VhcmNoIGFuY2hvci4gVHlwaW5nIGp1bXBzXG4gICAqICBhcm91bmQgYXMgcHJldmlldzsgMC1tYXRjaGVzIHNuYXBzIGJhY2sgaGVyZS4gRW50ZXIvbi9OIG5ldmVyXG4gICAqICByZXN0b3JlICh0aGV5IGRvbid0IGNhbGwgc2V0U2VhcmNoUXVlcnkgd2l0aCBlbXB0eSkuIE5leHQgLyBjYWxsXG4gICAqICBvdmVyd3JpdGVzLiAqL1xuICBzZXRBbmNob3I6ICgpID0+IHZvaWRcbiAgLyoqIFdhcm0gdGhlIHNlYXJjaC10ZXh0IGNhY2hlIGJ5IGV4dHJhY3RpbmcgZXZlcnkgbWVzc2FnZSdzIHRleHQuXG4gICAqICBSZXR1cm5zIGVsYXBzZWQgbXMsIG9yIDAgaWYgYWxyZWFkeSB3YXJtIChzdWJzZXF1ZW50IC8gaW4gc2FtZVxuICAgKiAgdHJhbnNjcmlwdCBzZXNzaW9uKS4gWWllbGRzIGJlZm9yZSB3b3JrIHNvIHRoZSBjYWxsZXIgY2FuIHBhaW50XG4gICAqICBcImluZGV4aW5n4oCmXCIgZmlyc3QuIENhbGxlciBzaG93cyBcImluZGV4ZWQgaW4gWG1zXCIgb24gcmVzb2x2ZS4gKi9cbiAgd2FybVNlYXJjaEluZGV4OiAoKSA9PiBQcm9taXNlPG51bWJlcj5cbiAgLyoqIE1hbnVhbCBzY3JvbGwgKGovay9QZ1VwL3doZWVsKSBleGl0ZWQgdGhlIHNlYXJjaCBjb250ZXh0LiBDbGVhclxuICAgKiAgcG9zaXRpb25zICh5ZWxsb3cgZ29lcyBhd2F5LCBpbnZlcnNlIGhpZ2hsaWdodHMgc3RheSkuIE5leHQgbi9OXG4gICAqICByZS1lc3RhYmxpc2hlcyB2aWEgc3RlcCgp4oaSanVtcCgpLiBXaXJlZCBmcm9tIFNjcm9sbEtleWJpbmRpbmdIYW5kbGVyJ3NcbiAgICogIG9uU2Nyb2xsIOKAlCBvbmx5IGZpcmVzIGZvciBrZXlib2FyZC93aGVlbCwgbm90IHByb2dyYW1tYXRpYyBzY3JvbGxUby4gKi9cbiAgZGlzYXJtU2VhcmNoOiAoKSA9PiB2b2lkXG59XG5cbnR5cGUgUHJvcHMgPSB7XG4gIG1lc3NhZ2VzOiBSZW5kZXJhYmxlTWVzc2FnZVtdXG4gIHNjcm9sbFJlZjogUmVmT2JqZWN0PFNjcm9sbEJveEhhbmRsZSB8IG51bGw+XG4gIC8qKiBJbnZhbGlkYXRlcyBoZWlnaHRDYWNoZSBvbiBjaGFuZ2Ug4oCUIGNhY2hlZCBoZWlnaHRzIGZyb20gYSBkaWZmZXJlbnRcbiAgICogIHdpZHRoIGFyZSB3cm9uZyAodGV4dCByZXdyYXAg4oaSIGJsYWNrIHNjcmVlbiBvbiBzY3JvbGwtdXAgYWZ0ZXIgd2lkZW4pLiAqL1xuICBjb2x1bW5zOiBudW1iZXJcbiAgaXRlbUtleTogKG1zZzogUmVuZGVyYWJsZU1lc3NhZ2UpID0+IHN0cmluZ1xuICByZW5kZXJJdGVtOiAobXNnOiBSZW5kZXJhYmxlTWVzc2FnZSwgaW5kZXg6IG51bWJlcikgPT4gUmVhY3QuUmVhY3ROb2RlXG4gIC8qKiBGaXJlcyB3aGVuIGEgbWVzc2FnZSBCb3ggaXMgY2xpY2tlZCAodG9nZ2xlIHBlci1tZXNzYWdlIHZlcmJvc2UpLiAqL1xuICBvbkl0ZW1DbGljaz86IChtc2c6IFJlbmRlcmFibGVNZXNzYWdlKSA9PiB2b2lkXG4gIC8qKiBQZXItaXRlbSBmaWx0ZXIg4oCUIHN1cHByZXNzIGhvdmVyL2NsaWNrIGZvciBtZXNzYWdlcyB3aGVyZSB0aGUgdmVyYm9zZVxuICAgKiAgdG9nZ2xlIGRvZXMgbm90aGluZyAodGV4dCwgZmlsZSBlZGl0cywgZXRjKS4gRGVmYXVsdHMgdG8gYWxsLWNsaWNrYWJsZS4gKi9cbiAgaXNJdGVtQ2xpY2thYmxlPzogKG1zZzogUmVuZGVyYWJsZU1lc3NhZ2UpID0+IGJvb2xlYW5cbiAgLyoqIEV4cGFuZGVkIGl0ZW1zIGdldCBhIHBlcnNpc3RlbnQgZ3JleSBiZyAobm90IGp1c3Qgb24gaG92ZXIpLiAqL1xuICBpc0l0ZW1FeHBhbmRlZD86IChtc2c6IFJlbmRlcmFibGVNZXNzYWdlKSA9PiBib29sZWFuXG4gIC8qKiBQUkUtTE9XRVJFRCBzZWFyY2ggdGV4dC4gTWVzc2FnZXMudHN4IGNhY2hlcyB0aGUgbG93ZXJlZCByZXN1bHRcbiAgICogIG9uY2UgYXQgd2FybSB0aW1lIHNvIHNldFNlYXJjaFF1ZXJ5J3MgcGVyLWtleXN0cm9rZSBsb29wIGRvZXNcbiAgICogIG9ubHkgaW5kZXhPZiAoemVybyB0b0xvd2VyQ2FzZSBhbGxvYykuIEZhbGxzIGJhY2sgdG8gYSBsb3dlcmluZ1xuICAgKiAgd3JhcHBlciBvbiByZW5kZXJhYmxlU2VhcmNoVGV4dCBmb3IgY2FsbGVycyB3aXRob3V0IHRoZSBjYWNoZS4gKi9cbiAgZXh0cmFjdFNlYXJjaFRleHQ/OiAobXNnOiBSZW5kZXJhYmxlTWVzc2FnZSkgPT4gc3RyaW5nXG4gIC8qKiBFbmFibGUgdGhlIHN0aWNreS1wcm9tcHQgdHJhY2tlci4gU3RpY2t5VHJhY2tlciB3cml0ZXMgdmlhXG4gICAqICBTY3JvbGxDaHJvbWVDb250ZXh0IChub3QgYSBjYWxsYmFjayBwcm9wKSBzbyBzdGF0ZSBsaXZlcyBpblxuICAgKiAgRnVsbHNjcmVlbkxheW91dCBpbnN0ZWFkIG9mIFJFUEwuICovXG4gIHRyYWNrU3RpY2t5UHJvbXB0PzogYm9vbGVhblxuICBzZWxlY3RlZEluZGV4PzogbnVtYmVyXG4gIC8qKiBOYXYgaGFuZGxlIGxpdmVzIGhlcmUgYmVjYXVzZSBoZWlnaHQgbWVhc3VyZW1lbnQgbGl2ZXMgaGVyZS4gKi9cbiAgY3Vyc29yTmF2UmVmPzogUmVhY3QuUmVmPE1lc3NhZ2VBY3Rpb25zTmF2PlxuICBzZXRDdXJzb3I/OiAoYzogTWVzc2FnZUFjdGlvbnNTdGF0ZSB8IG51bGwpID0+IHZvaWRcbiAganVtcFJlZj86IFJlZk9iamVjdDxKdW1wSGFuZGxlIHwgbnVsbD5cbiAgLyoqIEZpcmVzIHdoZW4gc2VhcmNoIG1hdGNoZXMgY2hhbmdlIChxdWVyeSBlZGl0LCBuL04pLiBjdXJyZW50IGlzXG4gICAqICAxLWJhc2VkIGZvciBcIjMvNDdcIiBkaXNwbGF5OyAwIG1lYW5zIG5vIG1hdGNoZXMuICovXG4gIG9uU2VhcmNoTWF0Y2hlc0NoYW5nZT86IChjb3VudDogbnVtYmVyLCBjdXJyZW50OiBudW1iZXIpID0+IHZvaWRcbiAgLyoqIFBhaW50IGV4aXN0aW5nIERPTSBzdWJ0cmVlIHRvIGZyZXNoIFNjcmVlbiwgc2Nhbi4gRWxlbWVudCBmcm9tIHRoZVxuICAgKiAgbWFpbiB0cmVlIChhbGwgcHJvdmlkZXJzKS4gTWVzc2FnZS1yZWxhdGl2ZSBwb3NpdGlvbnMgKHJvdyAwID0gZWxcbiAgICogIHRvcCkuIFdvcmtzIGZvciBhbnkgaGVpZ2h0IOKAlCBjbG9zZXMgdGhlIHRhbGwtbWVzc2FnZSBnYXAuICovXG4gIHNjYW5FbGVtZW50PzogKGVsOiBET01FbGVtZW50KSA9PiBNYXRjaFBvc2l0aW9uW11cbiAgLyoqIFBvc2l0aW9uLWJhc2VkIENVUlJFTlQgaGlnaGxpZ2h0LiBQb3NpdGlvbnMga25vd24gdXBmcm9udCAoZnJvbVxuICAgKiAgc2NhbkVsZW1lbnQpLCBuYXZpZ2F0aW9uID0gaW5kZXggYXJpdGhtZXRpYyArIHNjcm9sbFRvLiByb3dPZmZzZXRcbiAgICogID0gbWVzc2FnZSdzIGN1cnJlbnQgc2NyZWVuLXRvcDsgcG9zaXRpb25zIHN0YXkgc3RhYmxlLiAqL1xuICBzZXRQb3NpdGlvbnM/OiAoXG4gICAgc3RhdGU6IHtcbiAgICAgIHBvc2l0aW9uczogTWF0Y2hQb3NpdGlvbltdXG4gICAgICByb3dPZmZzZXQ6IG51bWJlclxuICAgICAgY3VycmVudElkeDogbnVtYmVyXG4gICAgfSB8IG51bGwsXG4gICkgPT4gdm9pZFxufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIHRleHQgb2YgYSByZWFsIHVzZXIgcHJvbXB0LCBvciBudWxsIGZvciBhbnl0aGluZyBlbHNlLlxuICogXCJSZWFsXCIgPSB3aGF0IHRoZSBodW1hbiB0eXBlZDogbm90IHRvb2wgcmVzdWx0cywgbm90IFhNTC13cmFwcGVkIHBheWxvYWRzXG4gKiAoPGJhc2gtc3Rkb3V0PiwgPGNvbW1hbmQtbWVzc2FnZT4sIDx0ZWFtbWF0ZS1tZXNzYWdlPiwgZXRjLiksIG5vdCBtZXRhLlxuICpcbiAqIFR3byBzaGFwZXMgbGFuZCBoZXJlOiBOb3JtYWxpemVkVXNlck1lc3NhZ2UgKG5vcm1hbCBwcm9tcHRzKSBhbmRcbiAqIEF0dGFjaG1lbnRNZXNzYWdlIHdpdGggdHlwZT09PSdxdWV1ZWRfY29tbWFuZCcgKHByb21wdHMgc2VudCBtaWQtdHVyblxuICogd2hpbGUgYSB0b29sIHdhcyBleGVjdXRpbmcg4oCUIHRoZXkgZ2V0IGRyYWluZWQgYXMgYXR0YWNobWVudHMgb24gdGhlXG4gKiBuZXh0IHR1cm4sIHNlZSBxdWVyeS50czoxNDEwKS4gQm90aCByZW5kZXIgYXMg4p2vLXByZWZpeGVkIFVzZXJUZXh0TWVzc2FnZVxuICogaW4gdGhlIFVJIHNvIGJvdGggc2hvdWxkIHN0aWNrLlxuICpcbiAqIExlYWRpbmcgPHN5c3RlbS1yZW1pbmRlcj4gYmxvY2tzIGFyZSBzdHJpcHBlZCBiZWZvcmUgY2hlY2tpbmcg4oCUIHRoZXkgZ2V0XG4gKiBwcmVwZW5kZWQgdG8gdGhlIHN0b3JlZCB0ZXh0IGZvciBDbGF1ZGUncyBjb250ZXh0IChtZW1vcnkgdXBkYXRlcywgYXV0b1xuICogbW9kZSByZW1pbmRlcnMpIGJ1dCBhcmVuJ3Qgd2hhdCB0aGUgdXNlciB0eXBlZC4gV2l0aG91dCBzdHJpcHBpbmcsIGFueVxuICogcHJvbXB0IHRoYXQgaGFwcGVuZWQgdG8gZ2V0IGEgcmVtaW5kZXIgaXMgcmVqZWN0ZWQgYnkgdGhlIHN0YXJ0c1dpdGgoJzwnKVxuICogY2hlY2suIFNob3dzIHVwIG9uIGBjYyAtY2AgcmVzdW1lcyB3aGVyZSBtZW1vcnktdXBkYXRlIHJlbWluZGVycyBhcmUgZGVuc2UuXG4gKi9cbmNvbnN0IHByb21wdFRleHRDYWNoZSA9IG5ldyBXZWFrTWFwPFJlbmRlcmFibGVNZXNzYWdlLCBzdHJpbmcgfCBudWxsPigpXG5cbmZ1bmN0aW9uIHN0aWNreVByb21wdFRleHQobXNnOiBSZW5kZXJhYmxlTWVzc2FnZSk6IHN0cmluZyB8IG51bGwge1xuICAvLyBDYWNoZSBrZXllZCBvbiBtZXNzYWdlIG9iamVjdCDigJQgbWVzc2FnZXMgYXJlIGFwcGVuZC1vbmx5IGFuZCBkb24ndFxuICAvLyBtdXRhdGUsIHNvIGEgV2Vha01hcCBoaXQgaXMgYWx3YXlzIHZhbGlkLiBUaGUgd2FsayAoU3RpY2t5VHJhY2tlcixcbiAgLy8gcGVyLXNjcm9sbC10aWNrKSBjYWxscyB0aGlzIDUtNTArIHRpbWVzIHdpdGggdGhlIFNBTUUgbWVzc2FnZXMgZXZlcnlcbiAgLy8gdGljazsgdGhlIHN5c3RlbS1yZW1pbmRlciBzdHJpcCBhbGxvY2F0ZXMgYSBmcmVzaCBzdHJpbmcgb24gZWFjaFxuICAvLyBwYXJzZS4gV2Vha01hcCBzZWxmLUdDcyBvbiBjb21wYWN0aW9uL2NsZWFyIChtZXNzYWdlc1tdIHJlcGxhY2VkKS5cbiAgY29uc3QgY2FjaGVkID0gcHJvbXB0VGV4dENhY2hlLmdldChtc2cpXG4gIGlmIChjYWNoZWQgIT09IHVuZGVmaW5lZCkgcmV0dXJuIGNhY2hlZFxuICBjb25zdCByZXN1bHQgPSBjb21wdXRlU3RpY2t5UHJvbXB0VGV4dChtc2cpXG4gIHByb21wdFRleHRDYWNoZS5zZXQobXNnLCByZXN1bHQpXG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gY29tcHV0ZVN0aWNreVByb21wdFRleHQobXNnOiBSZW5kZXJhYmxlTWVzc2FnZSk6IHN0cmluZyB8IG51bGwge1xuICBsZXQgcmF3OiBzdHJpbmcgfCBudWxsID0gbnVsbFxuICBpZiAobXNnLnR5cGUgPT09ICd1c2VyJykge1xuICAgIGlmIChtc2cuaXNNZXRhIHx8IG1zZy5pc1Zpc2libGVJblRyYW5zY3JpcHRPbmx5KSByZXR1cm4gbnVsbFxuICAgIGNvbnN0IGJsb2NrID0gbXNnLm1lc3NhZ2UuY29udGVudFswXVxuICAgIGlmIChibG9jaz8udHlwZSAhPT0gJ3RleHQnKSByZXR1cm4gbnVsbFxuICAgIHJhdyA9IGJsb2NrLnRleHRcbiAgfSBlbHNlIGlmIChcbiAgICBtc2cudHlwZSA9PT0gJ2F0dGFjaG1lbnQnICYmXG4gICAgbXNnLmF0dGFjaG1lbnQudHlwZSA9PT0gJ3F1ZXVlZF9jb21tYW5kJyAmJlxuICAgIG1zZy5hdHRhY2htZW50LmNvbW1hbmRNb2RlICE9PSAndGFzay1ub3RpZmljYXRpb24nICYmXG4gICAgIW1zZy5hdHRhY2htZW50LmlzTWV0YVxuICApIHtcbiAgICBjb25zdCBwID0gbXNnLmF0dGFjaG1lbnQucHJvbXB0XG4gICAgcmF3ID1cbiAgICAgIHR5cGVvZiBwID09PSAnc3RyaW5nJ1xuICAgICAgICA/IHBcbiAgICAgICAgOiBwLmZsYXRNYXAoYiA9PiAoYi50eXBlID09PSAndGV4dCcgPyBbYi50ZXh0XSA6IFtdKSkuam9pbignXFxuJylcbiAgfVxuICBpZiAocmF3ID09PSBudWxsKSByZXR1cm4gbnVsbFxuXG4gIGNvbnN0IHQgPSBzdHJpcFN5c3RlbVJlbWluZGVycyhyYXcpXG4gIGlmICh0LnN0YXJ0c1dpdGgoJzwnKSB8fCB0ID09PSAnJykgcmV0dXJuIG51bGxcbiAgcmV0dXJuIHRcbn1cblxuLyoqXG4gKiBWaXJ0dWFsaXplZCBtZXNzYWdlIGxpc3QgZm9yIGZ1bGxzY3JlZW4gbW9kZS4gU3BsaXQgZnJvbSBNZXNzYWdlcy50c3ggc29cbiAqIHVzZVZpcnR1YWxTY3JvbGwgaXMgY2FsbGVkIHVuY29uZGl0aW9uYWxseSAocnVsZXMtb2YtaG9va3MpIOKAlCBNZXNzYWdlcy50c3hcbiAqIGNvbmRpdGlvbmFsbHkgcmVuZGVycyBlaXRoZXIgdGhpcyBvciBhIHBsYWluIC5tYXAoKS5cbiAqXG4gKiBUaGUgd3JhcHBpbmcgPEJveCByZWY+IGlzIHRoZSBtZWFzdXJlbWVudCBhbmNob3Ig4oCUIE1lc3NhZ2VSb3cgZG9lc24ndCB0YWtlXG4gKiBhIHJlZi4gU2luZ2xlLWNoaWxkIGNvbHVtbiBCb3ggcGFzc2VzIFlvZ2EgaGVpZ2h0IHRocm91Z2ggdW5jaGFuZ2VkLlxuICovXG50eXBlIFZpcnR1YWxJdGVtUHJvcHMgPSB7XG4gIGl0ZW1LZXk6IHN0cmluZ1xuICBtc2c6IFJlbmRlcmFibGVNZXNzYWdlXG4gIGlkeDogbnVtYmVyXG4gIG1lYXN1cmVSZWY6IChrZXk6IHN0cmluZykgPT4gKGVsOiBET01FbGVtZW50IHwgbnVsbCkgPT4gdm9pZFxuICBleHBhbmRlZDogYm9vbGVhbiB8IHVuZGVmaW5lZFxuICBob3ZlcmVkOiBib29sZWFuXG4gIGNsaWNrYWJsZTogYm9vbGVhblxuICBvbkNsaWNrSzogKG1zZzogUmVuZGVyYWJsZU1lc3NhZ2UsIGNlbGxJc0JsYW5rOiBib29sZWFuKSA9PiB2b2lkXG4gIG9uRW50ZXJLOiAoazogc3RyaW5nKSA9PiB2b2lkXG4gIG9uTGVhdmVLOiAoazogc3RyaW5nKSA9PiB2b2lkXG4gIHJlbmRlckl0ZW06IChtc2c6IFJlbmRlcmFibGVNZXNzYWdlLCBpZHg6IG51bWJlcikgPT4gUmVhY3QuUmVhY3ROb2RlXG59XG5cbi8vIEl0ZW0gd3JhcHBlciB3aXRoIHN0YWJsZSBjbGljayBoYW5kbGVycy4gVGhlIHBlci1pdGVtIGNsb3N1cmVzIHdlcmUgdGhlXG4vLyBgb3BlcmF0aW9uTmV3QXJyb3dGdW5jdGlvbmAgbGVhZnMg4oaSIGBGdW5jdGlvbkV4ZWN1dGFibGU6OmZpbmFsaXplVW5jb25kaXRpb25hbGx5YFxuLy8gR0MgY2xlYW51cCAoMTYlIG9mIEdDIHRpbWUgZHVyaW5nIGZhc3Qgc2Nyb2xsKS4gMyBjbG9zdXJlcyDDlyA2MCBtb3VudGVkIMOXXG4vLyAxMCBjb21taXRzL3NlYyA9IDE4MDAgY2xvc3VyZXMvc2VjLiBXaXRoIHN0YWJsZSBvbkNsaWNrSy9vbkVudGVySy9vbkxlYXZlS1xuLy8gdGhyZWFkZWQgdmlhIGl0ZW1LZXksIHRoZSBjbG9zdXJlcyBoZXJlIGFyZSBwZXItaXRlbS1wZXItcmVuZGVyIGJ1dCBDSEVBUFxuLy8gKGp1c3Qgd3JhcCB0aGUgc3RhYmxlIGNhbGxiYWNrIHdpdGggayBib3VuZCkgYW5kIGRvbid0IGNsb3NlIG92ZXIgbXNnL2lkeFxuLy8gd2hpY2ggbGV0cyBKSVQgaW5saW5lIHRoZW0uIFRoZSBiaWdnZXIgd2luIGlzIGluc2lkZTogTWVzc2FnZVJvdy5tZW1vXG4vLyBiYWlscyBmb3IgdW5jaGFuZ2VkIG1zZ3MsIHNraXBwaW5nIG1hcmtlZC5sZXhlciArIGZvcm1hdFRva2VuLlxuLy9cbi8vIE5PVCBSZWFjdC5tZW1vJ2Qg4oCUIHJlbmRlckl0ZW0gY2FwdHVyZXMgY2hhbmdpbmcgc3RhdGUgKGN1cnNvciwgc2VsZWN0ZWRJZHgsXG4vLyB2ZXJib3NlKS4gTWVtb2luZyB3aXRoIGEgY29tcGFyYXRvciB0aGF0IGlnbm9yZXMgcmVuZGVySXRlbSB3b3VsZCB1c2UgYVxuLy8gU1RBTEUgY2xvc3VyZSBvbiBiYWlsICh3cm9uZyBzZWxlY3Rpb24gaGlnaGxpZ2h0LCBzdGFsZSB2ZXJib3NlKS4gSW5jbHVkaW5nXG4vLyByZW5kZXJJdGVtIGluIHRoZSBjb21wYXJhdG9yIGRlZmVhdHMgbWVtbyBzaW5jZSBpdCdzIGZyZXNoIGVhY2ggcmVuZGVyLlxuZnVuY3Rpb24gVmlydHVhbEl0ZW0oe1xuICBpdGVtS2V5OiBrLFxuICBtc2csXG4gIGlkeCxcbiAgbWVhc3VyZVJlZixcbiAgZXhwYW5kZWQsXG4gIGhvdmVyZWQsXG4gIGNsaWNrYWJsZSxcbiAgb25DbGlja0ssXG4gIG9uRW50ZXJLLFxuICBvbkxlYXZlSyxcbiAgcmVuZGVySXRlbSxcbn06IFZpcnR1YWxJdGVtUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICByZXR1cm4gKFxuICAgIDxCb3hcbiAgICAgIHJlZj17bWVhc3VyZVJlZihrKX1cbiAgICAgIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIlxuICAgICAgYmFja2dyb3VuZENvbG9yPXtleHBhbmRlZCA/ICd1c2VyTWVzc2FnZUJhY2tncm91bmRIb3ZlcicgOiB1bmRlZmluZWR9XG4gICAgICAvLyBiZyBoZXJlIG1hc2tzIHVzZVZpcnR1YWxTY3JvbGwncyBvbmUtZnJhbWUgb2Zmc2V0IGxhZyBvbiBleHBhbmQg4oCUXG4gICAgICAvLyBkb24ndCBtb3ZlIHRvIHRoZSBtYXJnaW5lZCBCb3ggaW5zaWRlLiBwYWRkaW5nQm90dG9tIG1pcnJvcnMgdGhlXG4gICAgICAvLyB0aW50ZWQgbWFyZ2luVG9wLlxuICAgICAgcGFkZGluZ0JvdHRvbT17ZXhwYW5kZWQgPyAxIDogdW5kZWZpbmVkfVxuICAgICAgb25DbGljaz17Y2xpY2thYmxlID8gZSA9PiBvbkNsaWNrSyhtc2csIGUuY2VsbElzQmxhbmspIDogdW5kZWZpbmVkfVxuICAgICAgb25Nb3VzZUVudGVyPXtjbGlja2FibGUgPyAoKSA9PiBvbkVudGVySyhrKSA6IHVuZGVmaW5lZH1cbiAgICAgIG9uTW91c2VMZWF2ZT17Y2xpY2thYmxlID8gKCkgPT4gb25MZWF2ZUsoaykgOiB1bmRlZmluZWR9XG4gICAgPlxuICAgICAgPFRleHRIb3ZlckNvbG9yQ29udGV4dC5Qcm92aWRlclxuICAgICAgICB2YWx1ZT17aG92ZXJlZCAmJiAhZXhwYW5kZWQgPyAndGV4dCcgOiB1bmRlZmluZWR9XG4gICAgICA+XG4gICAgICAgIHtyZW5kZXJJdGVtKG1zZywgaWR4KX1cbiAgICAgIDwvVGV4dEhvdmVyQ29sb3JDb250ZXh0LlByb3ZpZGVyPlxuICAgIDwvQm94PlxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBWaXJ0dWFsTWVzc2FnZUxpc3Qoe1xuICBtZXNzYWdlcyxcbiAgc2Nyb2xsUmVmLFxuICBjb2x1bW5zLFxuICBpdGVtS2V5LFxuICByZW5kZXJJdGVtLFxuICBvbkl0ZW1DbGljayxcbiAgaXNJdGVtQ2xpY2thYmxlLFxuICBpc0l0ZW1FeHBhbmRlZCxcbiAgZXh0cmFjdFNlYXJjaFRleHQgPSBkZWZhdWx0RXh0cmFjdFNlYXJjaFRleHQsXG4gIHRyYWNrU3RpY2t5UHJvbXB0LFxuICBzZWxlY3RlZEluZGV4LFxuICBjdXJzb3JOYXZSZWYsXG4gIHNldEN1cnNvcixcbiAganVtcFJlZixcbiAgb25TZWFyY2hNYXRjaGVzQ2hhbmdlLFxuICBzY2FuRWxlbWVudCxcbiAgc2V0UG9zaXRpb25zLFxufTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICAvLyBJbmNyZW1lbnRhbCBrZXkgYXJyYXkuIFN0cmVhbWluZyBhcHBlbmRzIG9uZSBtZXNzYWdlIGF0IGEgdGltZTsgcmVidWlsZGluZ1xuICAvLyB0aGUgZnVsbCBzdHJpbmcgYXJyYXkgb24gZXZlcnkgY29tbWl0IGFsbG9jYXRlcyBPKG4pIHBlciBtZXNzYWdlICh+MU1CXG4gIC8vIGNodXJuIGF0IDI3ayBtZXNzYWdlcykuIEFwcGVuZC1vbmx5IGRlbHRhIHB1c2ggd2hlbiB0aGUgcHJlZml4IG1hdGNoZXM7XG4gIC8vIGZhbGwgYmFjayB0byBmdWxsIHJlYnVpbGQgb24gY29tcGFjdGlvbiwgL2NsZWFyLCBvciBpdGVtS2V5IGNoYW5nZS5cbiAgY29uc3Qga2V5c1JlZiA9IHVzZVJlZjxzdHJpbmdbXT4oW10pXG4gIGNvbnN0IHByZXZNZXNzYWdlc1JlZiA9IHVzZVJlZjx0eXBlb2YgbWVzc2FnZXM+KG1lc3NhZ2VzKVxuICBjb25zdCBwcmV2SXRlbUtleVJlZiA9IHVzZVJlZihpdGVtS2V5KVxuICBpZiAoXG4gICAgcHJldkl0ZW1LZXlSZWYuY3VycmVudCAhPT0gaXRlbUtleSB8fFxuICAgIG1lc3NhZ2VzLmxlbmd0aCA8IGtleXNSZWYuY3VycmVudC5sZW5ndGggfHxcbiAgICBtZXNzYWdlc1swXSAhPT0gcHJldk1lc3NhZ2VzUmVmLmN1cnJlbnRbMF1cbiAgKSB7XG4gICAga2V5c1JlZi5jdXJyZW50ID0gbWVzc2FnZXMubWFwKG0gPT4gaXRlbUtleShtKSlcbiAgfSBlbHNlIHtcbiAgICBmb3IgKGxldCBpID0ga2V5c1JlZi5jdXJyZW50Lmxlbmd0aDsgaSA8IG1lc3NhZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBrZXlzUmVmLmN1cnJlbnQucHVzaChpdGVtS2V5KG1lc3NhZ2VzW2ldISkpXG4gICAgfVxuICB9XG4gIHByZXZNZXNzYWdlc1JlZi5jdXJyZW50ID0gbWVzc2FnZXNcbiAgcHJldkl0ZW1LZXlSZWYuY3VycmVudCA9IGl0ZW1LZXlcbiAgY29uc3Qga2V5cyA9IGtleXNSZWYuY3VycmVudFxuICBjb25zdCB7XG4gICAgcmFuZ2UsXG4gICAgdG9wU3BhY2VyLFxuICAgIGJvdHRvbVNwYWNlcixcbiAgICBtZWFzdXJlUmVmLFxuICAgIHNwYWNlclJlZixcbiAgICBvZmZzZXRzLFxuICAgIGdldEl0ZW1Ub3AsXG4gICAgZ2V0SXRlbUVsZW1lbnQsXG4gICAgZ2V0SXRlbUhlaWdodCxcbiAgICBzY3JvbGxUb0luZGV4LFxuICB9ID0gdXNlVmlydHVhbFNjcm9sbChzY3JvbGxSZWYsIGtleXMsIGNvbHVtbnMpXG4gIGNvbnN0IFtzdGFydCwgZW5kXSA9IHJhbmdlXG5cbiAgLy8gVW5tZWFzdXJlZCAodW5kZWZpbmVkIGhlaWdodCkgZmFsbHMgdGhyb3VnaCDigJQgYXNzdW1lIHZpc2libGUuXG4gIGNvbnN0IGlzVmlzaWJsZSA9IHVzZUNhbGxiYWNrKFxuICAgIChpOiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IGggPSBnZXRJdGVtSGVpZ2h0KGkpXG4gICAgICBpZiAoaCA9PT0gMCkgcmV0dXJuIGZhbHNlXG4gICAgICByZXR1cm4gaXNOYXZpZ2FibGVNZXNzYWdlKG1lc3NhZ2VzW2ldISlcbiAgICB9LFxuICAgIFtnZXRJdGVtSGVpZ2h0LCBtZXNzYWdlc10sXG4gIClcbiAgdXNlSW1wZXJhdGl2ZUhhbmRsZShjdXJzb3JOYXZSZWYsICgpOiBNZXNzYWdlQWN0aW9uc05hdiA9PiB7XG4gICAgY29uc3Qgc2VsZWN0ID0gKG06IE5hdmlnYWJsZU1lc3NhZ2UpID0+XG4gICAgICBzZXRDdXJzb3I/Lih7XG4gICAgICAgIHV1aWQ6IG0udXVpZCxcbiAgICAgICAgbXNnVHlwZTogbS50eXBlLFxuICAgICAgICBleHBhbmRlZDogZmFsc2UsXG4gICAgICAgIHRvb2xOYW1lOiB0b29sQ2FsbE9mKG0pPy5uYW1lLFxuICAgICAgfSlcbiAgICBjb25zdCBzZWxJZHggPSBzZWxlY3RlZEluZGV4ID8/IC0xXG4gICAgY29uc3Qgc2NhbiA9IChcbiAgICAgIGZyb206IG51bWJlcixcbiAgICAgIGRpcjogMSB8IC0xLFxuICAgICAgcHJlZDogKGk6IG51bWJlcikgPT4gYm9vbGVhbiA9IGlzVmlzaWJsZSxcbiAgICApID0+IHtcbiAgICAgIGZvciAobGV0IGkgPSBmcm9tOyBpID49IDAgJiYgaSA8IG1lc3NhZ2VzLmxlbmd0aDsgaSArPSBkaXIpIHtcbiAgICAgICAgaWYgKHByZWQoaSkpIHtcbiAgICAgICAgICBzZWxlY3QobWVzc2FnZXNbaV0hKVxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBjb25zdCBpc1VzZXIgPSAoaTogbnVtYmVyKSA9PiBpc1Zpc2libGUoaSkgJiYgbWVzc2FnZXNbaV0hLnR5cGUgPT09ICd1c2VyJ1xuICAgIHJldHVybiB7XG4gICAgICAvLyBFbnRyeSB2aWEgc2hpZnQr4oaRID0gc2FtZSBzZW1hbnRpYyBhcyBpbi1jdXJzb3Igc2hpZnQr4oaRIChwcmV2VXNlcikuXG4gICAgICBlbnRlckN1cnNvcjogKCkgPT4gc2NhbihtZXNzYWdlcy5sZW5ndGggLSAxLCAtMSwgaXNVc2VyKSxcbiAgICAgIG5hdmlnYXRlUHJldjogKCkgPT4gc2NhbihzZWxJZHggLSAxLCAtMSksXG4gICAgICBuYXZpZ2F0ZU5leHQ6ICgpID0+IHtcbiAgICAgICAgaWYgKHNjYW4oc2VsSWR4ICsgMSwgMSkpIHJldHVyblxuICAgICAgICAvLyBQYXN0IGxhc3QgdmlzaWJsZSDihpIgZXhpdCArIHJlcGluLiBMYXN0IG1lc3NhZ2UncyBUT1AgaXMgYXQgdmlld3BvcnRcbiAgICAgICAgLy8gdG9wIChzZWxlY3Rpb24tc2Nyb2xsIGVmZmVjdCk7IGl0cyBCT1RUT00gbWF5IGJlIGJlbG93IHRoZSBmb2xkLlxuICAgICAgICBzY3JvbGxSZWYuY3VycmVudD8uc2Nyb2xsVG9Cb3R0b20oKVxuICAgICAgICBzZXRDdXJzb3I/LihudWxsKVxuICAgICAgfSxcbiAgICAgIC8vIHR5cGU6J3VzZXInIG9ubHkg4oCUIHF1ZXVlZF9jb21tYW5kIGF0dGFjaG1lbnRzIGxvb2sgbGlrZSBwcm9tcHRzIGJ1dCBoYXZlIG5vIHJhdyBVc2VyTWVzc2FnZSB0byByZXdpbmQgdG8uXG4gICAgICBuYXZpZ2F0ZVByZXZVc2VyOiAoKSA9PiBzY2FuKHNlbElkeCAtIDEsIC0xLCBpc1VzZXIpLFxuICAgICAgbmF2aWdhdGVOZXh0VXNlcjogKCkgPT4gc2NhbihzZWxJZHggKyAxLCAxLCBpc1VzZXIpLFxuICAgICAgbmF2aWdhdGVUb3A6ICgpID0+IHNjYW4oMCwgMSksXG4gICAgICBuYXZpZ2F0ZUJvdHRvbTogKCkgPT4gc2NhbihtZXNzYWdlcy5sZW5ndGggLSAxLCAtMSksXG4gICAgICBnZXRTZWxlY3RlZDogKCkgPT4gKHNlbElkeCA+PSAwID8gKG1lc3NhZ2VzW3NlbElkeF0gPz8gbnVsbCkgOiBudWxsKSxcbiAgICB9XG4gIH0sIFttZXNzYWdlcywgc2VsZWN0ZWRJbmRleCwgc2V0Q3Vyc29yLCBpc1Zpc2libGVdKVxuICAvLyBUd28tcGhhc2UganVtcCArIHNlYXJjaCBlbmdpbmUuIFJlYWQtdGhyb3VnaC1yZWYgc28gdGhlIGhhbmRsZSBzdGF5c1xuICAvLyBzdGFibGUgYWNyb3NzIHJlbmRlcnMg4oCUIG9mZnNldHMvbWVzc2FnZXMgaWRlbnRpdHkgY2hhbmdlcyBldmVyeSByZW5kZXIsXG4gIC8vIGNhbid0IGdvIGluIHVzZUltcGVyYXRpdmVIYW5kbGUgZGVwcyB3aXRob3V0IHJlY3JlYXRpbmcgdGhlIGhhbmRsZS5cbiAgY29uc3QganVtcFN0YXRlID0gdXNlUmVmKHtcbiAgICBvZmZzZXRzLFxuICAgIHN0YXJ0LFxuICAgIGdldEl0ZW1FbGVtZW50LFxuICAgIGdldEl0ZW1Ub3AsXG4gICAgbWVzc2FnZXMsXG4gICAgc2Nyb2xsVG9JbmRleCxcbiAgfSlcbiAganVtcFN0YXRlLmN1cnJlbnQgPSB7XG4gICAgb2Zmc2V0cyxcbiAgICBzdGFydCxcbiAgICBnZXRJdGVtRWxlbWVudCxcbiAgICBnZXRJdGVtVG9wLFxuICAgIG1lc3NhZ2VzLFxuICAgIHNjcm9sbFRvSW5kZXgsXG4gIH1cblxuICAvLyBLZWVwIGN1cnNvci1zZWxlY3RlZCBtZXNzYWdlIHZpc2libGUuIG9mZnNldHMgcmVidWlsZHMgZXZlcnkgcmVuZGVyXG4gIC8vIOKAlCBhcyBhIGJhcmUgZGVwIHRoaXMgcmUtcGlubmVkIG9uIGV2ZXJ5IG1vdXNld2hlZWwgdGljay4gUmVhZCB0aHJvdWdoXG4gIC8vIGp1bXBTdGF0ZSBpbnN0ZWFkOyBwYXN0LW92ZXJzY2FuIGp1bXBzIGxhbmQgdmlhIHNjcm9sbFRvSW5kZXgsIG5leHRcbiAgLy8gbmF2IGlzIHByZWNpc2UuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHNlbGVjdGVkSW5kZXggPT09IHVuZGVmaW5lZCkgcmV0dXJuXG4gICAgY29uc3QgcyA9IGp1bXBTdGF0ZS5jdXJyZW50XG4gICAgY29uc3QgZWwgPSBzLmdldEl0ZW1FbGVtZW50KHNlbGVjdGVkSW5kZXgpXG4gICAgaWYgKGVsKSB7XG4gICAgICBzY3JvbGxSZWYuY3VycmVudD8uc2Nyb2xsVG9FbGVtZW50KGVsLCAxKVxuICAgIH0gZWxzZSB7XG4gICAgICBzLnNjcm9sbFRvSW5kZXgoc2VsZWN0ZWRJbmRleClcbiAgICB9XG4gIH0sIFtzZWxlY3RlZEluZGV4LCBzY3JvbGxSZWZdKVxuXG4gIC8vIFBlbmRpbmcgc2VlayByZXF1ZXN0LiBqdW1wKCkgc2V0cyB0aGlzICsgYnVtcHMgc2Vla0dlbi4gVGhlIHNlZWtcbiAgLy8gZWZmZWN0IGZpcmVzIHBvc3QtcGFpbnQgKHBhc3NpdmUgZWZmZWN0IOKAlCBhZnRlciByZXNldEFmdGVyQ29tbWl0KSxcbiAgLy8gY2hlY2tzIGlmIHRhcmdldCBpcyBtb3VudGVkLiBZZXMg4oaSIHNjYW4raGlnaGxpZ2h0LiBObyDihpIgcmUtZXN0aW1hdGVcbiAgLy8gd2l0aCBhIGZyZXNoZXIgYW5jaG9yIChzdGFydCBtb3ZlZCB0b3dhcmQgaWR4KSBhbmQgc2Nyb2xsVG8gYWdhaW4uXG4gIGNvbnN0IHNjYW5SZXF1ZXN0UmVmID0gdXNlUmVmPHtcbiAgICBpZHg6IG51bWJlclxuICAgIHdhbnRMYXN0OiBib29sZWFuXG4gICAgdHJpZXM6IG51bWJlclxuICB9IHwgbnVsbD4obnVsbClcbiAgLy8gTWVzc2FnZS1yZWxhdGl2ZSBwb3NpdGlvbnMgZnJvbSBzY2FuRWxlbWVudC4gUm93IDAgPSBtZXNzYWdlIHRvcC5cbiAgLy8gU3RhYmxlIGFjcm9zcyBzY3JvbGwg4oCUIGhpZ2hsaWdodCBjb21wdXRlcyByb3dPZmZzZXQgZnJlc2guIG1zZ0lkeFxuICAvLyBmb3IgY29tcHV0aW5nIHJvd09mZnNldCA9IGdldEl0ZW1Ub3AobXNnSWR4KSAtIHNjcm9sbFRvcC5cbiAgY29uc3QgZWxlbWVudFBvc2l0aW9ucyA9IHVzZVJlZjx7XG4gICAgbXNnSWR4OiBudW1iZXJcbiAgICBwb3NpdGlvbnM6IE1hdGNoUG9zaXRpb25bXVxuICB9Pih7IG1zZ0lkeDogLTEsIHBvc2l0aW9uczogW10gfSlcbiAgLy8gV3JhcGFyb3VuZCBndWFyZC4gQXV0by1hZHZhbmNlIHN0b3BzIGlmIHB0ciB3cmFwcyBiYWNrIHRvIGhlcmUuXG4gIGNvbnN0IHN0YXJ0UHRyUmVmID0gdXNlUmVmKC0xKVxuICAvLyBQaGFudG9tLWJ1cnN0IGNhcC4gUmVzZXRzIG9uIHNjYW4gc3VjY2Vzcy5cbiAgY29uc3QgcGhhbnRvbUJ1cnN0UmVmID0gdXNlUmVmKDApXG4gIC8vIE9uZS1kZWVwIHF1ZXVlOiBuL04gYXJyaXZpbmcgbWlkLXNlZWsgZ2V0cyBzdG9yZWQgKG5vdCBkcm9wcGVkKSBhbmRcbiAgLy8gZmlyZXMgYWZ0ZXIgdGhlIHNlZWsgY29tcGxldGVzLiBIb2xkaW5nIG4gc3RheXMgc21vb3RoIHdpdGhvdXRcbiAgLy8gcXVldWVpbmcgMzAganVtcHMuIExhdGVzdCBwcmVzcyBvdmVyd3JpdGVzIOKAlCB3ZSB3YW50IHRoZSBkaXJlY3Rpb25cbiAgLy8gdGhlIHVzZXIgaXMgZ29pbmcgTk9XLCBub3Qgd2hlcmUgdGhleSB3ZXJlIDEwIGtleXByZXNzZXMgYWdvLlxuICBjb25zdCBwZW5kaW5nU3RlcFJlZiA9IHVzZVJlZjwxIHwgLTEgfCAwPigwKVxuICAvLyBzdGVwICsgaGlnaGxpZ2h0IHZpYSByZWYgc28gdGhlIHNlZWsgZWZmZWN0IHJlYWRzIGxhdGVzdCB3aXRob3V0XG4gIC8vIGNsb3N1cmUtY2FwdHVyZSBvciBkZXBzIGNodXJuLlxuICBjb25zdCBzdGVwUmVmID0gdXNlUmVmPChkOiAxIHwgLTEpID0+IHZvaWQ+KCgpID0+IHt9KVxuICBjb25zdCBoaWdobGlnaHRSZWYgPSB1c2VSZWY8KG9yZDogbnVtYmVyKSA9PiB2b2lkPigoKSA9PiB7fSlcbiAgY29uc3Qgc2VhcmNoU3RhdGUgPSB1c2VSZWYoe1xuICAgIG1hdGNoZXM6IFtdIGFzIG51bWJlcltdLCAvLyBkZWR1cGxpY2F0ZWQgbXNnIGluZGljZXNcbiAgICBwdHI6IDAsXG4gICAgc2NyZWVuT3JkOiAwLFxuICAgIC8vIEN1bXVsYXRpdmUgZW5naW5lLW9jY3VycmVuY2UgY291bnQgYmVmb3JlIGVhY2ggbWF0Y2hlc1trXS4gTGV0cyB1c1xuICAgIC8vIGNvbXB1dGUgYSBnbG9iYWwgY3VycmVudCBpbmRleDogcHJlZml4U3VtW3B0cl0gKyBzY3JlZW5PcmQgKyAxLlxuICAgIC8vIEVuZ2luZS1jb3VudGVkIChpbmRleE9mIG9uIGV4dHJhY3RTZWFyY2hUZXh0KSwgbm90IHJlbmRlci1jb3VudGVkIOKAlFxuICAgIC8vIGNsb3NlIGVub3VnaCBmb3IgdGhlIGJhZGdlOyBleGFjdCBjb3VudHMgd291bGQgbmVlZCBzY2FuRWxlbWVudCBvblxuICAgIC8vIGV2ZXJ5IG1hdGNoZWQgbWVzc2FnZSAofjEtM21zIMOXIE4pLiB0b3RhbCA9IHByZWZpeFN1bVttYXRjaGVzLmxlbmd0aF0uXG4gICAgcHJlZml4U3VtOiBbXSBhcyBudW1iZXJbXSxcbiAgfSlcbiAgLy8gc2Nyb2xsVG9wIGF0IHRoZSBtb21lbnQgLyB3YXMgcHJlc3NlZC4gSW5jc2VhcmNoIHByZXZpZXctanVtcHMgc25hcFxuICAvLyBiYWNrIGhlcmUgd2hlbiBtYXRjaGVzIGRyb3AgdG8gMC4gLTEgPSBubyBhbmNob3IgKGJlZm9yZSBmaXJzdCAvKS5cbiAgY29uc3Qgc2VhcmNoQW5jaG9yID0gdXNlUmVmKC0xKVxuICBjb25zdCBpbmRleFdhcm1lZCA9IHVzZVJlZihmYWxzZSlcblxuICAvLyBTY3JvbGwgdGFyZ2V0IGZvciBtZXNzYWdlIGk6IGxhbmQgYXQgTUVTU0FHRSBUT1AuIGVzdCA9IHRvcCAtIEhFQURST09NXG4gIC8vIHNvIGxvID0gdG9wIC0gZXN0ID0gSEVBRFJPT00g4omlIDAgKG9yIGxvID0gdG9wIGlmIGVzdCBjbGFtcGVkIHRvIDApLlxuICAvLyBQb3N0LWNsYW1wIHJlYWQtYmFjayBpbiBqdW1wKCkgaGFuZGxlcyB0aGUgc2Nyb2xsSGVpZ2h0IGJvdW5kYXJ5LlxuICAvLyBObyBmcmFjIChyZW5kZXIgdHJhbnNmb3JtIGRpZG4ndCByZXNwZWN0IGl0KSwgbm8gbW9ub3RvbmUgY2xhbXBcbiAgLy8gKHdhcyBhIHNhZmV0eSBuZXQgZm9yIGZyYWMgZ2FyYmFnZSDigJQgd2l0aG91dCBmcmFjLCBlc3QgSVMgdGhlIG5leHRcbiAgLy8gbWVzc2FnZSdzIHRvcCwgc3BhbS1uL04gY29udmVyZ2VzIGJlY2F1c2UgbWVzc2FnZSB0b3BzIGFyZSBvcmRlcmVkKS5cbiAgZnVuY3Rpb24gdGFyZ2V0Rm9yKGk6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3QgdG9wID0ganVtcFN0YXRlLmN1cnJlbnQuZ2V0SXRlbVRvcChpKVxuICAgIHJldHVybiBNYXRoLm1heCgwLCB0b3AgLSBIRUFEUk9PTSlcbiAgfVxuXG4gIC8vIEhpZ2hsaWdodCBwb3NpdGlvbnNbb3JkXS4gUG9zaXRpb25zIGFyZSBNRVNTQUdFLVJFTEFUSVZFIChyb3cgMCA9XG4gIC8vIGVsZW1lbnQgdG9wLCBmcm9tIHNjYW5FbGVtZW50KS4gQ29tcHV0ZSByb3dPZmZzZXQgPSBnZXRJdGVtVG9wIC1cbiAgLy8gc2Nyb2xsVG9wIGZyZXNoLiBJZiBvcmQncyBwb3NpdGlvbiBpcyBvZmYtdmlld3BvcnQsIHNjcm9sbCB0byBicmluZ1xuICAvLyBpdCBpbiwgcmVjb21wdXRlIHJvd09mZnNldC4gc2V0UG9zaXRpb25zIHRyaWdnZXJzIG92ZXJsYXkgd3JpdGUuXG4gIGZ1bmN0aW9uIGhpZ2hsaWdodChvcmQ6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHMgPSBzY3JvbGxSZWYuY3VycmVudFxuICAgIGNvbnN0IHsgbXNnSWR4LCBwb3NpdGlvbnMgfSA9IGVsZW1lbnRQb3NpdGlvbnMuY3VycmVudFxuICAgIGlmICghcyB8fCBwb3NpdGlvbnMubGVuZ3RoID09PSAwIHx8IG1zZ0lkeCA8IDApIHtcbiAgICAgIHNldFBvc2l0aW9ucz8uKG51bGwpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgY29uc3QgaWR4ID0gTWF0aC5tYXgoMCwgTWF0aC5taW4ob3JkLCBwb3NpdGlvbnMubGVuZ3RoIC0gMSkpXG4gICAgY29uc3QgcCA9IHBvc2l0aW9uc1tpZHhdIVxuICAgIGNvbnN0IHRvcCA9IGp1bXBTdGF0ZS5jdXJyZW50LmdldEl0ZW1Ub3AobXNnSWR4KVxuICAgIC8vIGxvID0gaXRlbSdzIHBvc2l0aW9uIHdpdGhpbiBzY3JvbGwgY29udGVudCAod3JhcHBlci1yZWxhdGl2ZSkuXG4gICAgLy8gdmlld3BvcnRUb3AgPSB3aGVyZSB0aGUgc2Nyb2xsIGNvbnRlbnQgc3RhcnRzIG9uIFNDUkVFTiAoYWZ0ZXJcbiAgICAvLyBTY3JvbGxCb3ggcGFkZGluZy9ib3JkZXIgKyBhbnkgY2hyb21lIGFib3ZlKS4gSGlnaGxpZ2h0IHdyaXRlcyB0b1xuICAgIC8vIHNjcmVlbi1hYnNvbHV0ZSwgc28gcm93T2Zmc2V0ID0gdmlld3BvcnRUb3AgKyBsby4gT2JzZXJ2ZWQ6IG9mZi1ieS1cbiAgICAvLyAxKyB3aXRob3V0IHZpZXdwb3J0VG9wIChGdWxsc2NyZWVuTGF5b3V0IGhhcyBwYWRkaW5nVG9wPTEgb24gdGhlXG4gICAgLy8gU2Nyb2xsQm94LCBwbHVzIGFueSBoZWFkZXIgYWJvdmUpLlxuICAgIGNvbnN0IHZwVG9wID0gcy5nZXRWaWV3cG9ydFRvcCgpXG4gICAgbGV0IGxvID0gdG9wIC0gcy5nZXRTY3JvbGxUb3AoKVxuICAgIGNvbnN0IHZwID0gcy5nZXRWaWV3cG9ydEhlaWdodCgpXG4gICAgbGV0IHNjcmVlblJvdyA9IHZwVG9wICsgbG8gKyBwLnJvd1xuICAgIC8vIE9mZiB2aWV3cG9ydCDihpIgc2Nyb2xsIHRvIGJyaW5nIGl0IGluIChIRUFEUk9PTSBmcm9tIHRvcCkuXG4gICAgLy8gc2Nyb2xsVG8gY29tbWl0cyBzeW5jOyByZWFkLWJhY2sgYWZ0ZXIgZ2l2ZXMgZnJlc2ggbG8uXG4gICAgaWYgKHNjcmVlblJvdyA8IHZwVG9wIHx8IHNjcmVlblJvdyA+PSB2cFRvcCArIHZwKSB7XG4gICAgICBzLnNjcm9sbFRvKE1hdGgubWF4KDAsIHRvcCArIHAucm93IC0gSEVBRFJPT00pKVxuICAgICAgbG8gPSB0b3AgLSBzLmdldFNjcm9sbFRvcCgpXG4gICAgICBzY3JlZW5Sb3cgPSB2cFRvcCArIGxvICsgcC5yb3dcbiAgICB9XG4gICAgc2V0UG9zaXRpb25zPy4oeyBwb3NpdGlvbnMsIHJvd09mZnNldDogdnBUb3AgKyBsbywgY3VycmVudElkeDogaWR4IH0pXG4gICAgLy8gQmFkZ2U6IGdsb2JhbCBjdXJyZW50ID0gc3VtIG9mIG9jY3VycmVuY2VzIGJlZm9yZSB0aGlzIG1zZyArIG9yZCsxLlxuICAgIC8vIHByZWZpeFN1bVtwdHJdIGlzIGVuZ2luZS1jb3VudGVkIChpbmRleE9mIG9uIGV4dHJhY3RTZWFyY2hUZXh0KTtcbiAgICAvLyBtYXkgZHJpZnQgZnJvbSByZW5kZXItY291bnQgZm9yIGdob3N0IG1lc3NhZ2VzIGJ1dCBjbG9zZSBlbm91Z2gg4oCUXG4gICAgLy8gYmFkZ2UgaXMgYSByb3VnaCBsb2NhdGlvbiBoaW50LCBub3QgYSBwcm9vZi5cbiAgICBjb25zdCBzdCA9IHNlYXJjaFN0YXRlLmN1cnJlbnRcbiAgICBjb25zdCB0b3RhbCA9IHN0LnByZWZpeFN1bS5hdCgtMSkgPz8gMFxuICAgIGNvbnN0IGN1cnJlbnQgPSAoc3QucHJlZml4U3VtW3N0LnB0cl0gPz8gMCkgKyBpZHggKyAxXG4gICAgb25TZWFyY2hNYXRjaGVzQ2hhbmdlPy4odG90YWwsIGN1cnJlbnQpXG4gICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgYGhpZ2hsaWdodChpPSR7bXNnSWR4fSwgb3JkPSR7aWR4fS8ke3Bvc2l0aW9ucy5sZW5ndGh9KTogYCArXG4gICAgICAgIGBwb3M9e3Jvdzoke3Aucm93fSxjb2w6JHtwLmNvbH19IGxvPSR7bG99IHNjcmVlblJvdz0ke3NjcmVlblJvd30gYCArXG4gICAgICAgIGBiYWRnZT0ke2N1cnJlbnR9LyR7dG90YWx9YCxcbiAgICApXG4gIH1cbiAgaGlnaGxpZ2h0UmVmLmN1cnJlbnQgPSBoaWdobGlnaHRcblxuICAvLyBTZWVrIGVmZmVjdC4ganVtcCgpIHNldHMgc2NhblJlcXVlc3RSZWYgKyBzY3JvbGxUb0luZGV4ICsgYnVtcC5cbiAgLy8gYnVtcCDihpIgcmUtcmVuZGVyIOKGkiB1c2VWaXJ0dWFsU2Nyb2xsIG1vdW50cyB0aGUgdGFyZ2V0IChzY3JvbGxUb0luZGV4XG4gIC8vIGd1YXJhbnRlZXMgdGhpcyDigJQgc2Nyb2xsVG9wIGFuZCB0b3BTcGFjZXIgYWdyZWUgdmlhIHRoZSBzYW1lXG4gIC8vIG9mZnNldHMgdmFsdWUpIOKGkiByZXNldEFmdGVyQ29tbWl0IHBhaW50cyDihpIgdGhpcyBwYXNzaXZlIGVmZmVjdFxuICAvLyBmaXJlcyBQT1NULVBBSU5UIHdpdGggdGhlIGVsZW1lbnQgbW91bnRlZC4gUHJlY2lzZSBzY3JvbGxUbyArIHNjYW4uXG4gIC8vXG4gIC8vIERlcCBpcyBPTkxZIHNlZWtHZW4g4oCUIGVmZmVjdCBkb2Vzbid0IHJlLXJ1biBvbiByYW5kb20gcmVuZGVyc1xuICAvLyAob25TZWFyY2hNYXRjaGVzQ2hhbmdlIGNodXJuIGR1cmluZyBpbmNzZWFyY2gpLlxuICBjb25zdCBbc2Vla0dlbiwgc2V0U2Vla0dlbl0gPSB1c2VTdGF0ZSgwKVxuICBjb25zdCBidW1wU2VlayA9IHVzZUNhbGxiYWNrKCgpID0+IHNldFNlZWtHZW4oZyA9PiBnICsgMSksIFtdKVxuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgcmVxID0gc2NhblJlcXVlc3RSZWYuY3VycmVudFxuICAgIGlmICghcmVxKSByZXR1cm5cbiAgICBjb25zdCB7IGlkeCwgd2FudExhc3QsIHRyaWVzIH0gPSByZXFcbiAgICBjb25zdCBzID0gc2Nyb2xsUmVmLmN1cnJlbnRcbiAgICBpZiAoIXMpIHJldHVyblxuICAgIGNvbnN0IHsgZ2V0SXRlbUVsZW1lbnQsIGdldEl0ZW1Ub3AsIHNjcm9sbFRvSW5kZXggfSA9IGp1bXBTdGF0ZS5jdXJyZW50XG4gICAgY29uc3QgZWwgPSBnZXRJdGVtRWxlbWVudChpZHgpXG4gICAgY29uc3QgaCA9IGVsPy55b2dhTm9kZT8uZ2V0Q29tcHV0ZWRIZWlnaHQoKSA/PyAwXG5cbiAgICBpZiAoIWVsIHx8IGggPT09IDApIHtcbiAgICAgIC8vIE5vdCBtb3VudGVkIGFmdGVyIHNjcm9sbFRvSW5kZXguIFNob3VsZG4ndCBoYXBwZW4g4oCUIHNjcm9sbFRvSW5kZXhcbiAgICAgIC8vIGd1YXJhbnRlZXMgbW91bnQgYnkgY29uc3RydWN0aW9uIChzY3JvbGxUb3AgYW5kIHRvcFNwYWNlciBhZ3JlZVxuICAgICAgLy8gdmlhIHRoZSBzYW1lIG9mZnNldHMgdmFsdWUpLiBTYW5pdHk6IHJldHJ5IG9uY2UsIHRoZW4gc2tpcC5cbiAgICAgIGlmICh0cmllcyA+IDEpIHtcbiAgICAgICAgc2NhblJlcXVlc3RSZWYuY3VycmVudCA9IG51bGxcbiAgICAgICAgbG9nRm9yRGVidWdnaW5nKGBzZWVrKGk9JHtpZHh9KTogbm8gbW91bnQgYWZ0ZXIgc2Nyb2xsVG9JbmRleCwgc2tpcGApXG4gICAgICAgIHN0ZXBSZWYuY3VycmVudCh3YW50TGFzdCA/IC0xIDogMSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBzY2FuUmVxdWVzdFJlZi5jdXJyZW50ID0geyBpZHgsIHdhbnRMYXN0LCB0cmllczogdHJpZXMgKyAxIH1cbiAgICAgIHNjcm9sbFRvSW5kZXgoaWR4KVxuICAgICAgYnVtcFNlZWsoKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgc2NhblJlcXVlc3RSZWYuY3VycmVudCA9IG51bGxcbiAgICAvLyBQcmVjaXNlIHNjcm9sbFRvIOKAlCBzY3JvbGxUb0luZGV4IGdvdCB1cyBpbiB0aGUgbmVpZ2hib3Job29kXG4gICAgLy8gKGl0ZW0gaXMgbW91bnRlZCwgbWF5YmUgYSBmZXctZG96ZW4gcm93cyBvZmYgZHVlIHRvIG92ZXJzY2FuXG4gICAgLy8gZXN0aW1hdGUgZHJpZnQpLiBOb3cgbGFuZCBpdCBhdCB0b3AtSEVBRFJPT00uXG4gICAgcy5zY3JvbGxUbyhNYXRoLm1heCgwLCBnZXRJdGVtVG9wKGlkeCkgLSBIRUFEUk9PTSkpXG4gICAgY29uc3QgcG9zaXRpb25zID0gc2NhbkVsZW1lbnQ/LihlbCkgPz8gW11cbiAgICBlbGVtZW50UG9zaXRpb25zLmN1cnJlbnQgPSB7IG1zZ0lkeDogaWR4LCBwb3NpdGlvbnMgfVxuICAgIGxvZ0ZvckRlYnVnZ2luZyhgc2VlayhpPSR7aWR4fSB0PSR7dHJpZXN9KTogJHtwb3NpdGlvbnMubGVuZ3RofSBwb3NpdGlvbnNgKVxuICAgIGlmIChwb3NpdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBQaGFudG9tIOKAlCBlbmdpbmUgbWF0Y2hlZCwgcmVuZGVyIGRpZG4ndC4gQXV0by1hZHZhbmNlLlxuICAgICAgaWYgKCsrcGhhbnRvbUJ1cnN0UmVmLmN1cnJlbnQgPiAyMCkge1xuICAgICAgICBwaGFudG9tQnVyc3RSZWYuY3VycmVudCA9IDBcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBzdGVwUmVmLmN1cnJlbnQod2FudExhc3QgPyAtMSA6IDEpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgcGhhbnRvbUJ1cnN0UmVmLmN1cnJlbnQgPSAwXG4gICAgY29uc3Qgb3JkID0gd2FudExhc3QgPyBwb3NpdGlvbnMubGVuZ3RoIC0gMSA6IDBcbiAgICBzZWFyY2hTdGF0ZS5jdXJyZW50LnNjcmVlbk9yZCA9IG9yZFxuICAgIHN0YXJ0UHRyUmVmLmN1cnJlbnQgPSAtMVxuICAgIGhpZ2hsaWdodFJlZi5jdXJyZW50KG9yZClcbiAgICBjb25zdCBwZW5kaW5nID0gcGVuZGluZ1N0ZXBSZWYuY3VycmVudFxuICAgIGlmIChwZW5kaW5nKSB7XG4gICAgICBwZW5kaW5nU3RlcFJlZi5jdXJyZW50ID0gMFxuICAgICAgc3RlcFJlZi5jdXJyZW50KHBlbmRpbmcpXG4gICAgfVxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHNcbiAgfSwgW3NlZWtHZW5dKVxuXG4gIC8vIFNjcm9sbCB0byBtZXNzYWdlIGkncyB0b3AsIGFybSBzY2FuUGVuZGluZy4gc2Nhbi1lZmZlY3QgcmVhZHMgZnJlc2hcbiAgLy8gc2NyZWVuIG5leHQgdGljay4gd2FudExhc3Q6IE4taW50by1tZXNzYWdlIOKAlCBzY3JlZW5PcmQgPSBsZW5ndGgtMS5cbiAgZnVuY3Rpb24ganVtcChpOiBudW1iZXIsIHdhbnRMYXN0OiBib29sZWFuKTogdm9pZCB7XG4gICAgY29uc3QgcyA9IHNjcm9sbFJlZi5jdXJyZW50XG4gICAgaWYgKCFzKSByZXR1cm5cbiAgICBjb25zdCBqcyA9IGp1bXBTdGF0ZS5jdXJyZW50XG4gICAgY29uc3QgeyBnZXRJdGVtRWxlbWVudCwgc2Nyb2xsVG9JbmRleCB9ID0ganNcbiAgICAvLyBvZmZzZXRzIGlzIGEgRmxvYXQ2NEFycmF5IHdob3NlIC5sZW5ndGggaXMgdGhlIGFsbG9jYXRlZCBidWZmZXIgKG9ubHlcbiAgICAvLyBncm93cykg4oCUIG1lc3NhZ2VzLmxlbmd0aCBpcyB0aGUgbG9naWNhbCBpdGVtIGNvdW50LlxuICAgIGlmIChpIDwgMCB8fCBpID49IGpzLm1lc3NhZ2VzLmxlbmd0aCkgcmV0dXJuXG4gICAgLy8gQ2xlYXIgc3RhbGUgaGlnaGxpZ2h0IGJlZm9yZSBzY3JvbGwuIEJldHdlZW4gbm93IGFuZCB0aGUgc2Vla1xuICAgIC8vIGVmZmVjdCdzIGhpZ2hsaWdodCwgaW52ZXJzZS1vbmx5IGZyb20gc2Nhbi1oaWdobGlnaHQgc2hvd3MuXG4gICAgc2V0UG9zaXRpb25zPy4obnVsbClcbiAgICBlbGVtZW50UG9zaXRpb25zLmN1cnJlbnQgPSB7IG1zZ0lkeDogLTEsIHBvc2l0aW9uczogW10gfVxuICAgIHNjYW5SZXF1ZXN0UmVmLmN1cnJlbnQgPSB7IGlkeDogaSwgd2FudExhc3QsIHRyaWVzOiAwIH1cbiAgICBjb25zdCBlbCA9IGdldEl0ZW1FbGVtZW50KGkpXG4gICAgY29uc3QgaCA9IGVsPy55b2dhTm9kZT8uZ2V0Q29tcHV0ZWRIZWlnaHQoKSA/PyAwXG4gICAgLy8gTW91bnRlZCDihpIgcHJlY2lzZSBzY3JvbGxUby4gVW5tb3VudGVkIOKGkiBzY3JvbGxUb0luZGV4IG1vdW50cyBpdFxuICAgIC8vIChzY3JvbGxUb3AgYW5kIHRvcFNwYWNlciBhZ3JlZSB2aWEgdGhlIHNhbWUgb2Zmc2V0cyB2YWx1ZSDigJQgZXhhY3RcbiAgICAvLyBieSBjb25zdHJ1Y3Rpb24sIG5vIGVzdGltYXRpb24pLiBTZWVrIGVmZmVjdCBkb2VzIHRoZSBwcmVjaXNlXG4gICAgLy8gc2Nyb2xsVG8gYWZ0ZXIgcGFpbnQgZWl0aGVyIHdheS5cbiAgICBpZiAoZWwgJiYgaCA+IDApIHtcbiAgICAgIHMuc2Nyb2xsVG8odGFyZ2V0Rm9yKGkpKVxuICAgIH0gZWxzZSB7XG4gICAgICBzY3JvbGxUb0luZGV4KGkpXG4gICAgfVxuICAgIGJ1bXBTZWVrKClcbiAgfVxuXG4gIC8vIEFkdmFuY2Ugc2NyZWVuT3JkIHdpdGhpbiBlbGVtZW50UG9zaXRpb25zLiBFeGhhdXN0ZWQg4oaSIHB0ciBhZHZhbmNlcyxcbiAgLy8ganVtcCB0byBuZXh0IG1hdGNoZXNbcHRyXSwgcmUtc2Nhbi4gUGhhbnRvbSAoc2NhbiBmb3VuZCAwIGFmdGVyXG4gIC8vIGp1bXApIHRyaWdnZXJzIGF1dG8tYWR2YW5jZSBmcm9tIHNjYW4tZWZmZWN0LiBXcmFwYXJvdW5kIGd1YXJkIHN0b3BzXG4gIC8vIGlmIGV2ZXJ5IG1lc3NhZ2UgaXMgYSBwaGFudG9tLlxuICBmdW5jdGlvbiBzdGVwKGRlbHRhOiAxIHwgLTEpOiB2b2lkIHtcbiAgICBjb25zdCBzdCA9IHNlYXJjaFN0YXRlLmN1cnJlbnRcbiAgICBjb25zdCB7IG1hdGNoZXMsIHByZWZpeFN1bSB9ID0gc3RcbiAgICBjb25zdCB0b3RhbCA9IHByZWZpeFN1bS5hdCgtMSkgPz8gMFxuICAgIGlmIChtYXRjaGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgICAvLyBTZWVrIGluLWZsaWdodCDigJQgcXVldWUgdGhpcyBwcmVzcyAob25lLWRlZXAsIGxhdGVzdCBvdmVyd3JpdGVzKS5cbiAgICAvLyBUaGUgc2VlayBlZmZlY3QgZmlyZXMgaXQgYWZ0ZXIgaGlnaGxpZ2h0LlxuICAgIGlmIChzY2FuUmVxdWVzdFJlZi5jdXJyZW50KSB7XG4gICAgICBwZW5kaW5nU3RlcFJlZi5jdXJyZW50ID0gZGVsdGFcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChzdGFydFB0clJlZi5jdXJyZW50IDwgMCkgc3RhcnRQdHJSZWYuY3VycmVudCA9IHN0LnB0clxuXG4gICAgY29uc3QgeyBwb3NpdGlvbnMgfSA9IGVsZW1lbnRQb3NpdGlvbnMuY3VycmVudFxuICAgIGNvbnN0IG5ld09yZCA9IHN0LnNjcmVlbk9yZCArIGRlbHRhXG4gICAgaWYgKG5ld09yZCA+PSAwICYmIG5ld09yZCA8IHBvc2l0aW9ucy5sZW5ndGgpIHtcbiAgICAgIHN0LnNjcmVlbk9yZCA9IG5ld09yZFxuICAgICAgaGlnaGxpZ2h0KG5ld09yZCkgLy8gdXBkYXRlcyBiYWRnZSBpbnRlcm5hbGx5XG4gICAgICBzdGFydFB0clJlZi5jdXJyZW50ID0gLTFcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIEV4aGF1c3RlZCB2aXNpYmxlLiBBZHZhbmNlIHB0ciDihpIganVtcCDihpIgcmUtc2Nhbi5cbiAgICBjb25zdCBwdHIgPSAoc3QucHRyICsgZGVsdGEgKyBtYXRjaGVzLmxlbmd0aCkgJSBtYXRjaGVzLmxlbmd0aFxuICAgIGlmIChwdHIgPT09IHN0YXJ0UHRyUmVmLmN1cnJlbnQpIHtcbiAgICAgIHNldFBvc2l0aW9ucz8uKG51bGwpXG4gICAgICBzdGFydFB0clJlZi5jdXJyZW50ID0gLTFcbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgYHN0ZXA6IHdyYXBhcm91bmQgYXQgcHRyPSR7cHRyfSwgYWxsICR7bWF0Y2hlcy5sZW5ndGh9IG1zZ3MgcGhhbnRvbXNgLFxuICAgICAgKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHN0LnB0ciA9IHB0clxuICAgIHN0LnNjcmVlbk9yZCA9IDAgLy8gcmVzb2x2ZWQgYWZ0ZXIgc2NhbiAod2FudExhc3Qg4oaSIGxlbmd0aC0xKVxuICAgIGp1bXAobWF0Y2hlc1twdHJdISwgZGVsdGEgPCAwKVxuICAgIC8vIHNjcmVlbk9yZCB3aWxsIHJlc29sdmUgYWZ0ZXIgc2Nhbi4gQmVzdC1lZmZvcnQ6IHByZWZpeFN1bVtwdHJdICsgMFxuICAgIC8vIGZvciBuIChmaXJzdCBwb3MpLCBwcmVmaXhTdW1bcHRyKzFdIGZvciBOIChsYXN0IHBvcyA9IGNvdW50LTEpLlxuICAgIC8vIFRoZSBzY2FuLWVmZmVjdCdzIGhpZ2hsaWdodCB3aWxsIGJlIHRoZSByZWFsIHZhbHVlOyB0aGlzIGlzIGFcbiAgICAvLyBwcmUtc2NhbiBwbGFjZWhvbGRlciBzbyB0aGUgYmFkZ2UgdXBkYXRlcyBpbW1lZGlhdGVseS5cbiAgICBjb25zdCBwbGFjZWhvbGRlciA9XG4gICAgICBkZWx0YSA8IDAgPyAocHJlZml4U3VtW3B0ciArIDFdID8/IHRvdGFsKSA6IHByZWZpeFN1bVtwdHJdISArIDFcbiAgICBvblNlYXJjaE1hdGNoZXNDaGFuZ2U/Lih0b3RhbCwgcGxhY2Vob2xkZXIpXG4gIH1cbiAgc3RlcFJlZi5jdXJyZW50ID0gc3RlcFxuXG4gIHVzZUltcGVyYXRpdmVIYW5kbGUoXG4gICAganVtcFJlZixcbiAgICAoKSA9PiAoe1xuICAgICAgLy8gTm9uLXNlYXJjaCBqdW1wIChzdGlja3kgaGVhZGVyIGNsaWNrLCBldGMpLiBObyBzY2FuLCBubyBwb3NpdGlvbnMuXG4gICAgICBqdW1wVG9JbmRleDogKGk6IG51bWJlcikgPT4ge1xuICAgICAgICBjb25zdCBzID0gc2Nyb2xsUmVmLmN1cnJlbnRcbiAgICAgICAgaWYgKHMpIHMuc2Nyb2xsVG8odGFyZ2V0Rm9yKGkpKVxuICAgICAgfSxcbiAgICAgIHNldFNlYXJjaFF1ZXJ5OiAocTogc3RyaW5nKSA9PiB7XG4gICAgICAgIC8vIE5ldyBzZWFyY2ggaW52YWxpZGF0ZXMgZXZlcnl0aGluZy5cbiAgICAgICAgc2NhblJlcXVlc3RSZWYuY3VycmVudCA9IG51bGxcbiAgICAgICAgZWxlbWVudFBvc2l0aW9ucy5jdXJyZW50ID0geyBtc2dJZHg6IC0xLCBwb3NpdGlvbnM6IFtdIH1cbiAgICAgICAgc3RhcnRQdHJSZWYuY3VycmVudCA9IC0xXG4gICAgICAgIHNldFBvc2l0aW9ucz8uKG51bGwpXG4gICAgICAgIGNvbnN0IGxxID0gcS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIC8vIE9uZSBlbnRyeSBwZXIgTUVTU0FHRSAoZGVkdXBsaWNhdGVkKS4gQm9vbGVhbiBcImRvZXMgdGhpcyBtc2dcbiAgICAgICAgLy8gY29udGFpbiB0aGUgcXVlcnlcIi4gfjEwbXMgZm9yIDlrIG1lc3NhZ2VzIHdpdGggY2FjaGVkIGxvd2VyZWQuXG4gICAgICAgIGNvbnN0IG1hdGNoZXM6IG51bWJlcltdID0gW11cbiAgICAgICAgLy8gUGVyLW1lc3NhZ2Ugb2NjdXJyZW5jZSBjb3VudCDihpIgcHJlZml4U3VtIGZvciBnbG9iYWwgY3VycmVudFxuICAgICAgICAvLyBpbmRleC4gRW5naW5lLWNvdW50ZWQgKGNoZWFwIGluZGV4T2YgbG9vcCk7IG1heSBkaWZmZXIgZnJvbVxuICAgICAgICAvLyByZW5kZXItY291bnQgKHNjYW5FbGVtZW50KSBmb3IgZ2hvc3QvcGhhbnRvbSBtZXNzYWdlcyBidXQgY2xvc2VcbiAgICAgICAgLy8gZW5vdWdoIGZvciB0aGUgYmFkZ2UuIFRoZSBiYWRnZSBpcyBhIHJvdWdoIGxvY2F0aW9uIGhpbnQuXG4gICAgICAgIGNvbnN0IHByZWZpeFN1bTogbnVtYmVyW10gPSBbMF1cbiAgICAgICAgaWYgKGxxKSB7XG4gICAgICAgICAgY29uc3QgbXNncyA9IGp1bXBTdGF0ZS5jdXJyZW50Lm1lc3NhZ2VzXG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtc2dzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0ID0gZXh0cmFjdFNlYXJjaFRleHQobXNnc1tpXSEpXG4gICAgICAgICAgICBsZXQgcG9zID0gdGV4dC5pbmRleE9mKGxxKVxuICAgICAgICAgICAgbGV0IGNudCA9IDBcbiAgICAgICAgICAgIHdoaWxlIChwb3MgPj0gMCkge1xuICAgICAgICAgICAgICBjbnQrK1xuICAgICAgICAgICAgICBwb3MgPSB0ZXh0LmluZGV4T2YobHEsIHBvcyArIGxxLmxlbmd0aClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjbnQgPiAwKSB7XG4gICAgICAgICAgICAgIG1hdGNoZXMucHVzaChpKVxuICAgICAgICAgICAgICBwcmVmaXhTdW0ucHVzaChwcmVmaXhTdW0uYXQoLTEpISArIGNudClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdG90YWwgPSBwcmVmaXhTdW0uYXQoLTEpIVxuICAgICAgICAvLyBOZWFyZXN0IE1FU1NBR0UgdG8gdGhlIGFuY2hvci4gPD0gc28gdGllcyBnbyB0byBsYXRlci5cbiAgICAgICAgbGV0IHB0ciA9IDBcbiAgICAgICAgY29uc3QgcyA9IHNjcm9sbFJlZi5jdXJyZW50XG4gICAgICAgIGNvbnN0IHsgb2Zmc2V0cywgc3RhcnQsIGdldEl0ZW1Ub3AgfSA9IGp1bXBTdGF0ZS5jdXJyZW50XG4gICAgICAgIGNvbnN0IGZpcnN0VG9wID0gZ2V0SXRlbVRvcChzdGFydClcbiAgICAgICAgY29uc3Qgb3JpZ2luID0gZmlyc3RUb3AgPj0gMCA/IGZpcnN0VG9wIC0gb2Zmc2V0c1tzdGFydF0hIDogMFxuICAgICAgICBpZiAobWF0Y2hlcy5sZW5ndGggPiAwICYmIHMpIHtcbiAgICAgICAgICBjb25zdCBjdXJUb3AgPVxuICAgICAgICAgICAgc2VhcmNoQW5jaG9yLmN1cnJlbnQgPj0gMCA/IHNlYXJjaEFuY2hvci5jdXJyZW50IDogcy5nZXRTY3JvbGxUb3AoKVxuICAgICAgICAgIGxldCBiZXN0ID0gSW5maW5pdHlcbiAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IG1hdGNoZXMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGQgPSBNYXRoLmFicyhvcmlnaW4gKyBvZmZzZXRzW21hdGNoZXNba10hXSEgLSBjdXJUb3ApXG4gICAgICAgICAgICBpZiAoZCA8PSBiZXN0KSB7XG4gICAgICAgICAgICAgIGJlc3QgPSBkXG4gICAgICAgICAgICAgIHB0ciA9IGtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgYHNldFNlYXJjaFF1ZXJ5KCcke3F9Jyk6ICR7bWF0Y2hlcy5sZW5ndGh9IG1zZ3MgwrcgcHRyPSR7cHRyfSBgICtcbiAgICAgICAgICAgICAgYG1zZ0lkeD0ke21hdGNoZXNbcHRyXX0gY3VyVG9wPSR7Y3VyVG9wfSBvcmlnaW49JHtvcmlnaW59YCxcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgICAgc2VhcmNoU3RhdGUuY3VycmVudCA9IHsgbWF0Y2hlcywgcHRyLCBzY3JlZW5PcmQ6IDAsIHByZWZpeFN1bSB9XG4gICAgICAgIGlmIChtYXRjaGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAvLyB3YW50TGFzdD10cnVlOiBwcmV2aWV3IHRoZSBMQVNUIG9jY3VycmVuY2UgaW4gdGhlIG5lYXJlc3RcbiAgICAgICAgICAvLyBtZXNzYWdlLiBBdCBzdGlja3ktYm90dG9tIChjb21tb24gLyBlbnRyeSksIG5lYXJlc3QgaXMgdGhlXG4gICAgICAgICAgLy8gbGFzdCBtc2c7IGl0cyBsYXN0IG9jY3VycmVuY2UgaXMgY2xvc2VzdCB0byB3aGVyZSB0aGUgdXNlclxuICAgICAgICAgIC8vIHdhcyDigJQgbWluaW1hbCB2aWV3IG1vdmVtZW50LiBuIGFkdmFuY2VzIGZvcndhcmQgZnJvbSB0aGVyZS5cbiAgICAgICAgICBqdW1wKG1hdGNoZXNbcHRyXSEsIHRydWUpXG4gICAgICAgIH0gZWxzZSBpZiAoc2VhcmNoQW5jaG9yLmN1cnJlbnQgPj0gMCAmJiBzKSB7XG4gICAgICAgICAgLy8gL2Zvb2Ig4oaSIDAgbWF0Y2hlcyDihpIgc25hcCBiYWNrIHRvIGFuY2hvci4gbGVzcy92aW0gaW5jc2VhcmNoLlxuICAgICAgICAgIHMuc2Nyb2xsVG8oc2VhcmNoQW5jaG9yLmN1cnJlbnQpXG4gICAgICAgIH1cbiAgICAgICAgLy8gR2xvYmFsIG9jY3VycmVuY2UgY291bnQgKyAxLWJhc2VkIGN1cnJlbnQuIHdhbnRMYXN0PXRydWUgc28gdGhlXG4gICAgICAgIC8vIHNjYW4gd2lsbCBsYW5kIG9uIHRoZSBsYXN0IG9jY3VycmVuY2UgaW4gbWF0Y2hlc1twdHJdLiBQbGFjZWhvbGRlclxuICAgICAgICAvLyA9IHByZWZpeFN1bVtwdHIrMV0gKGNvdW50IHRocm91Z2ggdGhpcyBtc2cpLiBoaWdobGlnaHQoKSB1cGRhdGVzXG4gICAgICAgIC8vIHRvIHRoZSBleGFjdCB2YWx1ZSBhZnRlciBzY2FuIGNvbXBsZXRlcy5cbiAgICAgICAgb25TZWFyY2hNYXRjaGVzQ2hhbmdlPy4oXG4gICAgICAgICAgdG90YWwsXG4gICAgICAgICAgbWF0Y2hlcy5sZW5ndGggPiAwID8gKHByZWZpeFN1bVtwdHIgKyAxXSA/PyB0b3RhbCkgOiAwLFxuICAgICAgICApXG4gICAgICB9LFxuICAgICAgbmV4dE1hdGNoOiAoKSA9PiBzdGVwKDEpLFxuICAgICAgcHJldk1hdGNoOiAoKSA9PiBzdGVwKC0xKSxcbiAgICAgIHNldEFuY2hvcjogKCkgPT4ge1xuICAgICAgICBjb25zdCBzID0gc2Nyb2xsUmVmLmN1cnJlbnRcbiAgICAgICAgaWYgKHMpIHNlYXJjaEFuY2hvci5jdXJyZW50ID0gcy5nZXRTY3JvbGxUb3AoKVxuICAgICAgfSxcbiAgICAgIGRpc2FybVNlYXJjaDogKCkgPT4ge1xuICAgICAgICAvLyBNYW51YWwgc2Nyb2xsIGludmFsaWRhdGVzIHNjcmVlbi1hYnNvbHV0ZSBwb3NpdGlvbnMuXG4gICAgICAgIHNldFBvc2l0aW9ucz8uKG51bGwpXG4gICAgICAgIHNjYW5SZXF1ZXN0UmVmLmN1cnJlbnQgPSBudWxsXG4gICAgICAgIGVsZW1lbnRQb3NpdGlvbnMuY3VycmVudCA9IHsgbXNnSWR4OiAtMSwgcG9zaXRpb25zOiBbXSB9XG4gICAgICAgIHN0YXJ0UHRyUmVmLmN1cnJlbnQgPSAtMVxuICAgICAgfSxcbiAgICAgIHdhcm1TZWFyY2hJbmRleDogYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoaW5kZXhXYXJtZWQuY3VycmVudCkgcmV0dXJuIDBcbiAgICAgICAgY29uc3QgbXNncyA9IGp1bXBTdGF0ZS5jdXJyZW50Lm1lc3NhZ2VzXG4gICAgICAgIGNvbnN0IENIVU5LID0gNTAwXG4gICAgICAgIGxldCB3b3JrTXMgPSAwXG4gICAgICAgIGNvbnN0IHdhbGxTdGFydCA9IHBlcmZvcm1hbmNlLm5vdygpXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbXNncy5sZW5ndGg7IGkgKz0gQ0hVTkspIHtcbiAgICAgICAgICBhd2FpdCBzbGVlcCgwKVxuICAgICAgICAgIGNvbnN0IHQwID0gcGVyZm9ybWFuY2Uubm93KClcbiAgICAgICAgICBjb25zdCBlbmQgPSBNYXRoLm1pbihpICsgQ0hVTkssIG1zZ3MubGVuZ3RoKVxuICAgICAgICAgIGZvciAobGV0IGogPSBpOyBqIDwgZW5kOyBqKyspIHtcbiAgICAgICAgICAgIGV4dHJhY3RTZWFyY2hUZXh0KG1zZ3Nbal0hKVxuICAgICAgICAgIH1cbiAgICAgICAgICB3b3JrTXMgKz0gcGVyZm9ybWFuY2Uubm93KCkgLSB0MFxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHdhbGxNcyA9IE1hdGgucm91bmQocGVyZm9ybWFuY2Uubm93KCkgLSB3YWxsU3RhcnQpXG4gICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICBgd2FybVNlYXJjaEluZGV4OiAke21zZ3MubGVuZ3RofSBtc2dzIMK3IHdvcms9JHtNYXRoLnJvdW5kKHdvcmtNcyl9bXMgd2FsbD0ke3dhbGxNc31tcyBjaHVua3M9JHtNYXRoLmNlaWwobXNncy5sZW5ndGggLyBDSFVOSyl9YCxcbiAgICAgICAgKVxuICAgICAgICBpbmRleFdhcm1lZC5jdXJyZW50ID0gdHJ1ZVxuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZCh3b3JrTXMpXG4gICAgICB9LFxuICAgIH0pLFxuICAgIC8vIENsb3N1cmVzIG92ZXIgcmVmcyArIGNhbGxiYWNrcy4gc2Nyb2xsUmVmIHN0YWJsZTsgb3RoZXJzIGFyZVxuICAgIC8vIHVzZUNhbGxiYWNrKFtdKSBvciBwcm9wLWRyaWxsZWQgZnJvbSBSRVBMIChzdGFibGUpLlxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHNcbiAgICBbc2Nyb2xsUmVmXSxcbiAgKVxuXG4gIC8vIFN0aWNreVRyYWNrZXIgZ29lcyBBRlRFUiB0aGUgbGlzdCBjb250ZW50LiBJdCByZXR1cm5zIG51bGwgKG5vIERPTSBub2RlKVxuICAvLyBzbyBvcmRlciBzaG91bGRuJ3QgbWF0dGVyIGZvciBsYXlvdXQg4oCUIGJ1dCBwdXR0aW5nIGl0IGZpcnN0IG1lYW5zIGV2ZXJ5XG4gIC8vIGZpbmUtZ3JhaW5lZCBjb21taXQgZnJvbSBpdHMgb3duIHNjcm9sbCBzdWJzY3JpcHRpb24gcmVjb25jaWxlcyBUSFJPVUdIXG4gIC8vIHRoZSBzaWJsaW5nIGl0ZW1zIChSZWFjdCB3YWxrcyBjaGlsZHJlbiBpbiBvcmRlcikuIEFmdGVyIHRoZSBpdGVtcywgaXQnc1xuICAvLyBhIGxlYWYgcmVjb25jaWxlLiBEZWZlbnNpdmU6IGFsc28gYXZvaWRzIGFueSBZb2dhIGNoaWxkLWluZGV4IHF1aXJrcyBpZlxuICAvLyB0aGUgSW5rIHJlY29uY2lsZXIgZXZlciBtYXRlcmlhbGl6ZXMgYSBwbGFjZWhvbGRlciBmb3IgbnVsbCByZXR1cm5zLlxuICBjb25zdCBbaG92ZXJlZEtleSwgc2V0SG92ZXJlZEtleV0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuICAvLyBTdGFibGUgY2xpY2svaG92ZXIgaGFuZGxlcnMg4oCUIGNhbGxlZCB3aXRoIGssIGRpc3BhdGNoIGZyb20gYSByZWYgc29cbiAgLy8gY2xvc3VyZSBpZGVudGl0eSBkb2Vzbid0IGNoYW5nZSBwZXIgcmVuZGVyLiBUaGUgcGVyLWl0ZW0gaGFuZGxlclxuICAvLyBjbG9zdXJlcyAoYGUgPT4gLi4uYCwgYCgpID0+IHNldEhvdmVyZWRLZXkoaylgKSB3ZXJlIHRoZVxuICAvLyBgb3BlcmF0aW9uTmV3QXJyb3dGdW5jdGlvbmAgbGVhZnMgaW4gdGhlIHNjcm9sbCBDUFUgcHJvZmlsZTsgdGhlaXJcbiAgLy8gY2xlYW51cCB3YXMgMTYlIG9mIEdDIHRpbWUgKGBGdW5jdGlvbkV4ZWN1dGFibGU6OmZpbmFsaXplVW5jb25kaXRpb25hbGx5YCkuXG4gIC8vIEFsbG9jYXRpbmcgMyBjbG9zdXJlcyDDlyA2MCBtb3VudGVkIGl0ZW1zIMOXIDEwIGNvbW1pdHMvc2VjIGR1cmluZyBmYXN0XG4gIC8vIHNjcm9sbCA9IDE4MDAgc2hvcnQtbGl2ZWQgY2xvc3VyZXMvc2VjLiBXaXRoIHN0YWJsZSByZWZzIHRoZSBpdGVtXG4gIC8vIHdyYXBwZXIgcHJvcHMgZG9uJ3QgY2hhbmdlIOKGkiBWaXJ0dWFsSXRlbS5tZW1vIGJhaWxzIGZvciB0aGUgfjM1XG4gIC8vIHVuY2hhbmdlZCBpdGVtcywgb25seSB+MjUgZnJlc2ggaXRlbXMgcGF5IGNyZWF0ZUVsZW1lbnQgY29zdC5cbiAgY29uc3QgaGFuZGxlcnNSZWYgPSB1c2VSZWYoeyBvbkl0ZW1DbGljaywgc2V0SG92ZXJlZEtleSB9KVxuICBoYW5kbGVyc1JlZi5jdXJyZW50ID0geyBvbkl0ZW1DbGljaywgc2V0SG92ZXJlZEtleSB9XG4gIGNvbnN0IG9uQ2xpY2tLID0gdXNlQ2FsbGJhY2soXG4gICAgKG1zZzogUmVuZGVyYWJsZU1lc3NhZ2UsIGNlbGxJc0JsYW5rOiBib29sZWFuKSA9PiB7XG4gICAgICBjb25zdCBoID0gaGFuZGxlcnNSZWYuY3VycmVudFxuICAgICAgaWYgKCFjZWxsSXNCbGFuayAmJiBoLm9uSXRlbUNsaWNrKSBoLm9uSXRlbUNsaWNrKG1zZylcbiAgICB9LFxuICAgIFtdLFxuICApXG4gIGNvbnN0IG9uRW50ZXJLID0gdXNlQ2FsbGJhY2soKGs6IHN0cmluZykgPT4ge1xuICAgIGhhbmRsZXJzUmVmLmN1cnJlbnQuc2V0SG92ZXJlZEtleShrKVxuICB9LCBbXSlcbiAgY29uc3Qgb25MZWF2ZUsgPSB1c2VDYWxsYmFjaygoazogc3RyaW5nKSA9PiB7XG4gICAgaGFuZGxlcnNSZWYuY3VycmVudC5zZXRIb3ZlcmVkS2V5KHByZXYgPT4gKHByZXYgPT09IGsgPyBudWxsIDogcHJldikpXG4gIH0sIFtdKVxuXG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIDxCb3ggcmVmPXtzcGFjZXJSZWZ9IGhlaWdodD17dG9wU3BhY2VyfSBmbGV4U2hyaW5rPXswfSAvPlxuICAgICAge21lc3NhZ2VzLnNsaWNlKHN0YXJ0LCBlbmQpLm1hcCgobXNnLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IGlkeCA9IHN0YXJ0ICsgaVxuICAgICAgICBjb25zdCBrID0ga2V5c1tpZHhdIVxuICAgICAgICBjb25zdCBjbGlja2FibGUgPSAhIW9uSXRlbUNsaWNrICYmIChpc0l0ZW1DbGlja2FibGU/Lihtc2cpID8/IHRydWUpXG4gICAgICAgIGNvbnN0IGhvdmVyZWQgPSBjbGlja2FibGUgJiYgaG92ZXJlZEtleSA9PT0ga1xuICAgICAgICBjb25zdCBleHBhbmRlZCA9IGlzSXRlbUV4cGFuZGVkPy4obXNnKVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxWaXJ0dWFsSXRlbVxuICAgICAgICAgICAga2V5PXtrfVxuICAgICAgICAgICAgaXRlbUtleT17a31cbiAgICAgICAgICAgIG1zZz17bXNnfVxuICAgICAgICAgICAgaWR4PXtpZHh9XG4gICAgICAgICAgICBtZWFzdXJlUmVmPXttZWFzdXJlUmVmfVxuICAgICAgICAgICAgZXhwYW5kZWQ9e2V4cGFuZGVkfVxuICAgICAgICAgICAgaG92ZXJlZD17aG92ZXJlZH1cbiAgICAgICAgICAgIGNsaWNrYWJsZT17Y2xpY2thYmxlfVxuICAgICAgICAgICAgb25DbGlja0s9e29uQ2xpY2tLfVxuICAgICAgICAgICAgb25FbnRlcks9e29uRW50ZXJLfVxuICAgICAgICAgICAgb25MZWF2ZUs9e29uTGVhdmVLfVxuICAgICAgICAgICAgcmVuZGVySXRlbT17cmVuZGVySXRlbX1cbiAgICAgICAgICAvPlxuICAgICAgICApXG4gICAgICB9KX1cbiAgICAgIHtib3R0b21TcGFjZXIgPiAwICYmIDxCb3ggaGVpZ2h0PXtib3R0b21TcGFjZXJ9IGZsZXhTaHJpbms9ezB9IC8+fVxuICAgICAge3RyYWNrU3RpY2t5UHJvbXB0ICYmIChcbiAgICAgICAgPFN0aWNreVRyYWNrZXJcbiAgICAgICAgICBtZXNzYWdlcz17bWVzc2FnZXN9XG4gICAgICAgICAgc3RhcnQ9e3N0YXJ0fVxuICAgICAgICAgIGVuZD17ZW5kfVxuICAgICAgICAgIG9mZnNldHM9e29mZnNldHN9XG4gICAgICAgICAgZ2V0SXRlbVRvcD17Z2V0SXRlbVRvcH1cbiAgICAgICAgICBnZXRJdGVtRWxlbWVudD17Z2V0SXRlbUVsZW1lbnR9XG4gICAgICAgICAgc2Nyb2xsUmVmPXtzY3JvbGxSZWZ9XG4gICAgICAgIC8+XG4gICAgICApfVxuICAgIDwvPlxuICApXG59XG5cbmNvbnN0IE5PT1BfVU5TVUIgPSAoKSA9PiB7fVxuXG4vKipcbiAqIEVmZmVjdC1vbmx5IGNoaWxkIHRoYXQgdHJhY2tzIHRoZSBsYXN0IHVzZXItcHJvbXB0IHNjcm9sbGVkIGFib3ZlIHRoZVxuICogdmlld3BvcnQgdG9wIGFuZCBmaXJlcyBvbkNoYW5nZSB3aGVuIGl0IGNoYW5nZXMuXG4gKlxuICogUmVuZGVyZWQgYXMgYSBzZXBhcmF0ZSBjb21wb25lbnQgKG5vdCBhIGhvb2sgaW4gVmlydHVhbE1lc3NhZ2VMaXN0KSBzbyBpdFxuICogY2FuIHN1YnNjcmliZSB0byBzY3JvbGwgYXQgRklORVIgZ3JhbnVsYXJpdHkgdGhhbiBTQ1JPTExfUVVBTlRVTT00MC4gVGhlXG4gKiBsaXN0IG5lZWRzIHRoZSBjb2Fyc2UgcXVhbnR1bSB0byBhdm9pZCBwZXItd2hlZWwtdGljayBZb2dhIHJlbGF5b3V0czsgdGhpc1xuICogdHJhY2tlciBpcyBqdXN0IGEgd2FsayArIGNvbXBhcmlzb24gYW5kIGNhbiBhZmZvcmQgdG8gcnVuIGV2ZXJ5IHRpY2suIFdoZW5cbiAqIGl0IHJlLXJlbmRlcnMgYWxvbmUsIHRoZSBsaXN0J3MgcmVjb25jaWxlZCBvdXRwdXQgaXMgdW5jaGFuZ2VkIChzYW1lIHByb3BzXG4gKiBmcm9tIHRoZSBwYXJlbnQncyBsYXN0IGNvbW1pdCkg4oCUIG5vIFlvZ2Egd29yay4gV2l0aG91dCB0aGlzIHNwbGl0LCB0aGVcbiAqIGhlYWRlciBsYWdzIGJ5IH5vbmUgY29udmVyc2F0aW9uIHR1cm4gKDQwIHJvd3Mg4omIIG9uZSBwcm9tcHQgKyByZXNwb25zZSkuXG4gKlxuICogZmlyc3RWaXNpYmxlIGRlcml2YXRpb246IGl0ZW0gQm94ZXMgYXJlIGRpcmVjdCBZb2dhIGNoaWxkcmVuIG9mIHRoZVxuICogU2Nyb2xsQm94IGNvbnRlbnQgd3JhcHBlciAoZnJhZ21lbnRzIGNvbGxhcHNlIGluIHRoZSBJbmsgRE9NKSwgc29cbiAqIHlvZ2EuZ2V0Q29tcHV0ZWRUb3AgaXMgY29udGVudC13cmFwcGVyLXJlbGF0aXZlIOKAlCBzYW1lIGNvb3JkaW5hdGUgc3BhY2UgYXNcbiAqIHNjcm9sbFRvcC4gQ29tcGFyZSBhZ2FpbnN0IHNjcm9sbFRvcCArIHBlbmRpbmdEZWx0YSAodGhlIHNjcm9sbCBUQVJHRVQg4oCUXG4gKiBzY3JvbGxCeSBvbmx5IHNldHMgcGVuZGluZ0RlbHRhLCBjb21taXR0ZWQgc2Nyb2xsVG9wIGxhZ3MpLiBXYWxrIGJhY2t3YXJkXG4gKiBmcm9tIHRoZSBtb3VudC1yYW5nZSBlbmQ7IGJyZWFrIHdoZW4gYW4gaXRlbSdzIHRvcCBpcyBhYm92ZSB0YXJnZXQuXG4gKi9cbmZ1bmN0aW9uIFN0aWNreVRyYWNrZXIoe1xuICBtZXNzYWdlcyxcbiAgc3RhcnQsXG4gIGVuZCxcbiAgb2Zmc2V0cyxcbiAgZ2V0SXRlbVRvcCxcbiAgZ2V0SXRlbUVsZW1lbnQsXG4gIHNjcm9sbFJlZixcbn06IHtcbiAgbWVzc2FnZXM6IFJlbmRlcmFibGVNZXNzYWdlW11cbiAgc3RhcnQ6IG51bWJlclxuICBlbmQ6IG51bWJlclxuICBvZmZzZXRzOiBBcnJheUxpa2U8bnVtYmVyPlxuICBnZXRJdGVtVG9wOiAoaW5kZXg6IG51bWJlcikgPT4gbnVtYmVyXG4gIGdldEl0ZW1FbGVtZW50OiAoaW5kZXg6IG51bWJlcikgPT4gRE9NRWxlbWVudCB8IG51bGxcbiAgc2Nyb2xsUmVmOiBSZWZPYmplY3Q8U2Nyb2xsQm94SGFuZGxlIHwgbnVsbD5cbn0pOiBudWxsIHtcbiAgY29uc3QgeyBzZXRTdGlja3lQcm9tcHQgfSA9IHVzZUNvbnRleHQoU2Nyb2xsQ2hyb21lQ29udGV4dClcbiAgLy8gRmluZS1ncmFpbmVkIHN1YnNjcmlwdGlvbiDigJQgc25hcHNob3QgaXMgdW5xdWFudGl6ZWQgc2Nyb2xsVG9wK2RlbHRhIHNvXG4gIC8vIGV2ZXJ5IHNjcm9sbCBhY3Rpb24gKHdoZWVsIHRpY2ssIFBnVXAsIGRyYWcpIHRyaWdnZXJzIGEgcmUtcmVuZGVyIG9mXG4gIC8vIFRISVMgY29tcG9uZW50IG9ubHkuIFN0aWNreSBiaXQgZm9sZGVkIGludG8gdGhlIHNpZ24gc28gc3RpY2t54oaSYnJva2VuXG4gIC8vIGFsc28gdHJpZ2dlcnMgKHNjcm9sbFRvQm90dG9tIHNldHMgc3RpY2t5IHdpdGhvdXQgbW92aW5nIHNjcm9sbFRvcCkuXG4gIGNvbnN0IHN1YnNjcmliZSA9IHVzZUNhbGxiYWNrKFxuICAgIChsaXN0ZW5lcjogKCkgPT4gdm9pZCkgPT5cbiAgICAgIHNjcm9sbFJlZi5jdXJyZW50Py5zdWJzY3JpYmUobGlzdGVuZXIpID8/IE5PT1BfVU5TVUIsXG4gICAgW3Njcm9sbFJlZl0sXG4gIClcbiAgdXNlU3luY0V4dGVybmFsU3RvcmUoc3Vic2NyaWJlLCAoKSA9PiB7XG4gICAgY29uc3QgcyA9IHNjcm9sbFJlZi5jdXJyZW50XG4gICAgaWYgKCFzKSByZXR1cm4gTmFOXG4gICAgY29uc3QgdCA9IHMuZ2V0U2Nyb2xsVG9wKCkgKyBzLmdldFBlbmRpbmdEZWx0YSgpXG4gICAgcmV0dXJuIHMuaXNTdGlja3koKSA/IC0xIC0gdCA6IHRcbiAgfSlcblxuICAvLyBSZWFkIGxpdmUgc2Nyb2xsIHN0YXRlIG9uIGV2ZXJ5IHJlbmRlci5cbiAgY29uc3QgaXNTdGlja3kgPSBzY3JvbGxSZWYuY3VycmVudD8uaXNTdGlja3koKSA/PyB0cnVlXG4gIGNvbnN0IHRhcmdldCA9IE1hdGgubWF4KFxuICAgIDAsXG4gICAgKHNjcm9sbFJlZi5jdXJyZW50Py5nZXRTY3JvbGxUb3AoKSA/PyAwKSArXG4gICAgICAoc2Nyb2xsUmVmLmN1cnJlbnQ/LmdldFBlbmRpbmdEZWx0YSgpID8/IDApLFxuICApXG5cbiAgLy8gV2FsayB0aGUgbW91bnRlZCByYW5nZSB0byBmaW5kIHRoZSBmaXJzdCBpdGVtIGF0LW9yLWJlbG93IHRoZSB2aWV3cG9ydFxuICAvLyB0b3AuIGByYW5nZWAgaXMgZnJvbSB0aGUgcGFyZW50J3MgY29hcnNlLXF1YW50dW0gcmVuZGVyIChtYXkgYmUgc2xpZ2h0bHlcbiAgLy8gc3RhbGUpIGJ1dCBvdmVyc2NhbiBndWFyYW50ZWVzIGl0IHNwYW5zIHdlbGwgcGFzdCB0aGUgdmlld3BvcnQgaW4gYm90aFxuICAvLyBkaXJlY3Rpb25zLiBJdGVtcyB3aXRob3V0IGEgWW9nYSBsYXlvdXQgeWV0IChuZXdseSBtb3VudGVkIHRoaXMgZnJhbWUpXG4gIC8vIGFyZSB0cmVhdGVkIGFzIGF0LW9yLWJlbG93IOKAlCB0aGV5J3JlIHNvbWV3aGVyZSBpbiB2aWV3LCBhbmQgYXNzdW1pbmdcbiAgLy8gb3RoZXJ3aXNlIHdvdWxkIHNob3cgYSBzdGlja3kgZm9yIGEgcHJvbXB0IHRoYXQncyBhY3R1YWxseSBvbiBzY3JlZW4uXG4gIGxldCBmaXJzdFZpc2libGUgPSBzdGFydFxuICBsZXQgZmlyc3RWaXNpYmxlVG9wID0gLTFcbiAgZm9yIChsZXQgaSA9IGVuZCAtIDE7IGkgPj0gc3RhcnQ7IGktLSkge1xuICAgIGNvbnN0IHRvcCA9IGdldEl0ZW1Ub3AoaSlcbiAgICBpZiAodG9wID49IDApIHtcbiAgICAgIGlmICh0b3AgPCB0YXJnZXQpIGJyZWFrXG4gICAgICBmaXJzdFZpc2libGVUb3AgPSB0b3BcbiAgICB9XG4gICAgZmlyc3RWaXNpYmxlID0gaVxuICB9XG5cbiAgbGV0IGlkeCA9IC0xXG4gIGxldCB0ZXh0OiBzdHJpbmcgfCBudWxsID0gbnVsbFxuICBpZiAoZmlyc3RWaXNpYmxlID4gMCAmJiAhaXNTdGlja3kpIHtcbiAgICBmb3IgKGxldCBpID0gZmlyc3RWaXNpYmxlIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IHQgPSBzdGlja3lQcm9tcHRUZXh0KG1lc3NhZ2VzW2ldISlcbiAgICAgIGlmICh0ID09PSBudWxsKSBjb250aW51ZVxuICAgICAgLy8gVGhlIHByb21wdCdzIHdyYXBwaW5nIEJveCB0b3AgaXMgYWJvdmUgdGFyZ2V0ICh0aGF0J3Mgd2h5IGl0J3MgaW5cbiAgICAgIC8vIHRoZSBbMCwgZmlyc3RWaXNpYmxlKSByYW5nZSksIGJ1dCBpdHMg4p2vIGlzIGF0IHRvcCsxIChtYXJnaW5Ub3A9MSkuXG4gICAgICAvLyBJZiB0aGUg4p2vIGlzIGF0LW9yLWJlbG93IHRhcmdldCwgaXQncyBWSVNJQkxFIGF0IHZpZXdwb3J0IHRvcCDigJRcbiAgICAgIC8vIHNob3dpbmcgdGhlIHNhbWUgdGV4dCBpbiB0aGUgaGVhZGVyIHdvdWxkIGR1cGxpY2F0ZSBpdC4gSGFwcGVuc1xuICAgICAgLy8gaW4gdGhlIDEtcm93IGdhcCBiZXR3ZWVuIEJveCB0b3Agc2Nyb2xsaW5nIHBhc3QgYW5kIOKdryBzY3JvbGxpbmdcbiAgICAgIC8vIHBhc3QuIFNraXAgdG8gdGhlIG5leHQtb2xkZXIgcHJvbXB0IChpdHMg4p2vIGlzIGRlZmluaXRlbHkgYWJvdmUpLlxuICAgICAgY29uc3QgdG9wID0gZ2V0SXRlbVRvcChpKVxuICAgICAgaWYgKHRvcCA+PSAwICYmIHRvcCArIDEgPj0gdGFyZ2V0KSBjb250aW51ZVxuICAgICAgaWR4ID0gaVxuICAgICAgdGV4dCA9IHRcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgY29uc3QgYmFzZU9mZnNldCA9XG4gICAgZmlyc3RWaXNpYmxlVG9wID49IDAgPyBmaXJzdFZpc2libGVUb3AgLSBvZmZzZXRzW2ZpcnN0VmlzaWJsZV0hIDogMFxuICBjb25zdCBlc3RpbWF0ZSA9IGlkeCA+PSAwID8gTWF0aC5tYXgoMCwgYmFzZU9mZnNldCArIG9mZnNldHNbaWR4XSEpIDogLTFcblxuICAvLyBGb3IgY2xpY2stanVtcHMgdG8gaXRlbXMgbm90IHlldCBtb3VudGVkICh1c2VyIHNjcm9sbGVkIGZhciBwYXN0LFxuICAvLyBwcm9tcHQgaXMgaW4gdGhlIHRvcFNwYWNlcikuIENsaWNrIGhhbmRsZXIgc2Nyb2xscyB0byB0aGUgZXN0aW1hdGVcbiAgLy8gdG8gbW91bnQgaXQ7IHRoaXMgYW5jaG9ycyBieSBlbGVtZW50IG9uY2UgaXQgYXBwZWFycy4gc2Nyb2xsVG9FbGVtZW50XG4gIC8vIGRlZmVycyB0aGUgWW9nYS1wb3NpdGlvbiByZWFkIHRvIHJlbmRlciB0aW1lIChyZW5kZXItbm9kZS10by1vdXRwdXRcbiAgLy8gcmVhZHMgZWwueW9nYU5vZGUuZ2V0Q29tcHV0ZWRUb3AoKSBpbiB0aGUgU0FNRSBjYWxjdWxhdGVMYXlvdXQgcGFzc1xuICAvLyB0aGF0IHByb2R1Y2VzIHNjcm9sbEhlaWdodCkg4oCUIG5vIHRocm90dGxlIHJhY2UuIENhcCByZXRyaWVzOiBhIC9jbGVhclxuICAvLyByYWNlIGNvdWxkIHVubW91bnQgdGhlIGl0ZW0gbWlkLXNlcXVlbmNlLlxuICBjb25zdCBwZW5kaW5nID0gdXNlUmVmKHsgaWR4OiAtMSwgdHJpZXM6IDAgfSlcbiAgLy8gU3VwcHJlc3Npb24gc3RhdGUgbWFjaGluZS4gVGhlIGNsaWNrIGhhbmRsZXIgYXJtczsgdGhlIG9uQ2hhbmdlIGVmZmVjdFxuICAvLyBjb25zdW1lcyAoYXJtZWTihpJmb3JjZSkgdGhlbiBmaXJlcy1hbmQtY2xlYXJzIG9uIHRoZSByZW5kZXIgQUZURVIgdGhhdFxuICAvLyAoZm9yY2XihpJub25lKS4gVGhlIGZvcmNlIHN0ZXAgcG9pc29ucyB0aGUgZGVkdXA6IGFmdGVyIGNsaWNrLCBpZHggb2Z0ZW5cbiAgLy8gcmVjb21wdXRlcyB0byB0aGUgU0FNRSBwcm9tcHQgKGl0cyB0b3AgaXMgc3RpbGwgYWJvdmUgdGFyZ2V0KSwgc29cbiAgLy8gd2l0aG91dCBmb3JjZSB0aGUgbGFzdC5pZHg9PT1pZHggZ3VhcmQgd291bGQgaG9sZCAnY2xpY2tlZCcgdW50aWwgdGhlXG4gIC8vIHVzZXIgY3Jvc3NlZCBhIHByb21wdCBib3VuZGFyeS4gUHJldmlvdXNseSBlbmNvZGVkIGluIGxhc3QuaWR4IGFzXG4gIC8vIC0xLy0yLy0zIHdoaWNoIG92ZXJsYXBwZWQgd2l0aCByZWFsIGluZGljZXMg4oCUIHRvbyBjbGV2ZXIuXG4gIHR5cGUgU3VwcHJlc3MgPSAnbm9uZScgfCAnYXJtZWQnIHwgJ2ZvcmNlJ1xuICBjb25zdCBzdXBwcmVzcyA9IHVzZVJlZjxTdXBwcmVzcz4oJ25vbmUnKVxuICAvLyBEZWR1cCBvbiBpZHggb25seSDigJQgZXN0aW1hdGUgZGVyaXZlcyBmcm9tIGZpcnN0VmlzaWJsZVRvcCB3aGljaCBzaGlmdHNcbiAgLy8gZXZlcnkgc2Nyb2xsIHRpY2ssIHNvIGluY2x1ZGluZyBpdCBpbiB0aGUga2V5IG1hZGUgdGhlIGd1YXJkIGRlYWRcbiAgLy8gKHNldFN0aWNreVByb21wdCBmaXJlZCBhIGZyZXNoIHt0ZXh0LHNjcm9sbFRvfSBwZXItZnJhbWUpLiBUaGUgc2Nyb2xsVG9cbiAgLy8gY2xvc3VyZSBzdGlsbCBjYXB0dXJlcyB0aGUgY3VycmVudCBlc3RpbWF0ZTsgaXQganVzdCBkb2Vzbid0IG5lZWQgdG9cbiAgLy8gcmUtZmlyZSB3aGVuIG9ubHkgZXN0aW1hdGUgbW92ZWQuXG4gIGNvbnN0IGxhc3RJZHggPSB1c2VSZWYoLTEpXG5cbiAgLy8gc2V0U3RpY2t5UHJvbXB0IGVmZmVjdCBGSVJTVCDigJQgbXVzdCBzZWUgcGVuZGluZy5pZHggYmVmb3JlIHRoZVxuICAvLyBjb3JyZWN0aW9uIGVmZmVjdCBiZWxvdyBjbGVhcnMgaXQuIE9uIHRoZSBlc3RpbWF0ZS1mYWxsYmFjayBwYXRoLCB0aGVcbiAgLy8gcmVuZGVyIHRoYXQgbW91bnRzIHRoZSBpdGVtIGlzIEFMU08gdGhlIHJlbmRlciB3aGVyZSBjb3JyZWN0aW9uIGNsZWFyc1xuICAvLyBwZW5kaW5nOyBpZiB0aGlzIHJhbiBzZWNvbmQsIHRoZSBwZW5kaW5nIGdhdGUgd291bGQgYmUgZGVhZCBhbmRcbiAgLy8gc2V0U3RpY2t5UHJvbXB0KHByZXZQcm9tcHQpIHdvdWxkIGZpcmUgbWlkLWp1bXAsIHJlLW1vdW50aW5nIHRoZVxuICAvLyBoZWFkZXIgb3ZlciAnY2xpY2tlZCcuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgLy8gSG9sZCB3aGlsZSB0d28tcGhhc2UgY29ycmVjdGlvbiBpcyBpbiBmbGlnaHQuXG4gICAgaWYgKHBlbmRpbmcuY3VycmVudC5pZHggPj0gMCkgcmV0dXJuXG4gICAgaWYgKHN1cHByZXNzLmN1cnJlbnQgPT09ICdhcm1lZCcpIHtcbiAgICAgIHN1cHByZXNzLmN1cnJlbnQgPSAnZm9yY2UnXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgY29uc3QgZm9yY2UgPSBzdXBwcmVzcy5jdXJyZW50ID09PSAnZm9yY2UnXG4gICAgc3VwcHJlc3MuY3VycmVudCA9ICdub25lJ1xuICAgIGlmICghZm9yY2UgJiYgbGFzdElkeC5jdXJyZW50ID09PSBpZHgpIHJldHVyblxuICAgIGxhc3RJZHguY3VycmVudCA9IGlkeFxuICAgIGlmICh0ZXh0ID09PSBudWxsKSB7XG4gICAgICBzZXRTdGlja3lQcm9tcHQobnVsbClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICAvLyBGaXJzdCBwYXJhZ3JhcGggb25seSAoc3BsaXQgb24gYmxhbmsgbGluZSkg4oCUIGEgcHJvbXB0IGxpa2VcbiAgICAvLyBcInN0aWxsIHNlZWluZyBidWdzOlxcblxcbjEuIGZvb1xcbjIuIGJhclwiIHByZXZpZXdzIGFzIGp1c3QgdGhlXG4gICAgLy8gbGVhZC1pbi4gdHJpbVN0YXJ0IHNvIGEgbGVhZGluZyBibGFuayBsaW5lIChxdWV1ZWRfY29tbWFuZCBtaWQtXG4gICAgLy8gdHVybiBtZXNzYWdlcyBzb21ldGltZXMgaGF2ZSBvbmUpIGRvZXNuJ3QgZmluZCBwYXJhRW5kIGF0IDAuXG4gICAgY29uc3QgdHJpbW1lZCA9IHRleHQudHJpbVN0YXJ0KClcbiAgICBjb25zdCBwYXJhRW5kID0gdHJpbW1lZC5zZWFyY2goL1xcblxccypcXG4vKVxuICAgIGNvbnN0IGNvbGxhcHNlZCA9IChwYXJhRW5kID49IDAgPyB0cmltbWVkLnNsaWNlKDAsIHBhcmFFbmQpIDogdHJpbW1lZClcbiAgICAgIC5zbGljZSgwLCBTVElDS1lfVEVYVF9DQVApXG4gICAgICAucmVwbGFjZSgvXFxzKy9nLCAnICcpXG4gICAgICAudHJpbSgpXG4gICAgaWYgKGNvbGxhcHNlZCA9PT0gJycpIHtcbiAgICAgIHNldFN0aWNreVByb21wdChudWxsKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGNvbnN0IGNhcHR1cmVkSWR4ID0gaWR4XG4gICAgY29uc3QgY2FwdHVyZWRFc3RpbWF0ZSA9IGVzdGltYXRlXG4gICAgc2V0U3RpY2t5UHJvbXB0KHtcbiAgICAgIHRleHQ6IGNvbGxhcHNlZCxcbiAgICAgIHNjcm9sbFRvOiAoKSA9PiB7XG4gICAgICAgIC8vIEhpZGUgaGVhZGVyLCBrZWVwIHBhZGRpbmcgY29sbGFwc2VkIOKAlCBGdWxsc2NyZWVuTGF5b3V0J3NcbiAgICAgICAgLy8gJ2NsaWNrZWQnIHNlbnRpbmVsIOKGkiBzY3JvbGxCb3hfeT0wICsgcGFkPTAg4oaSIHZpZXdwb3J0VG9wPTAuXG4gICAgICAgIHNldFN0aWNreVByb21wdCgnY2xpY2tlZCcpXG4gICAgICAgIHN1cHByZXNzLmN1cnJlbnQgPSAnYXJtZWQnXG4gICAgICAgIC8vIHNjcm9sbFRvRWxlbWVudCBhbmNob3JzIGJ5IERPTUVsZW1lbnQgcmVmLCBub3QgYSBudW1iZXI6XG4gICAgICAgIC8vIHJlbmRlci1ub2RlLXRvLW91dHB1dCByZWFkcyBlbC55b2dhTm9kZS5nZXRDb21wdXRlZFRvcCgpIGF0XG4gICAgICAgIC8vIHBhaW50IHRpbWUgKHNhbWUgWW9nYSBwYXNzIGFzIHNjcm9sbEhlaWdodCkuIE5vIHN0YWxlbmVzcyBmcm9tXG4gICAgICAgIC8vIHRoZSB0aHJvdHRsZWQgcmVuZGVyIOKAlCB0aGUgcmVmIGlzIHN0YWJsZSwgdGhlIHBvc2l0aW9uIHJlYWQgaXNcbiAgICAgICAgLy8gZGVmZXJyZWQuIG9mZnNldD0xID0gVXNlclByb21wdE1lc3NhZ2UgbWFyZ2luVG9wLlxuICAgICAgICBjb25zdCBlbCA9IGdldEl0ZW1FbGVtZW50KGNhcHR1cmVkSWR4KVxuICAgICAgICBpZiAoZWwpIHtcbiAgICAgICAgICBzY3JvbGxSZWYuY3VycmVudD8uc2Nyb2xsVG9FbGVtZW50KGVsLCAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE5vdCBtb3VudGVkIChzY3JvbGxlZCBmYXIgcGFzdCDigJQgaW4gdG9wU3BhY2VyKS4gSnVtcCB0b1xuICAgICAgICAgIC8vIGVzdGltYXRlIHRvIG1vdW50IGl0OyBjb3JyZWN0aW9uIGVmZmVjdCByZS1hbmNob3JzIG9uY2UgaXRcbiAgICAgICAgICAvLyBhcHBlYXJzLiBFc3RpbWF0ZSBpcyBERUZBVUxUX0VTVElNQVRFLWJhc2VkIOKAlCBsYW5kcyBzaG9ydC5cbiAgICAgICAgICBzY3JvbGxSZWYuY3VycmVudD8uc2Nyb2xsVG8oY2FwdHVyZWRFc3RpbWF0ZSlcbiAgICAgICAgICBwZW5kaW5nLmN1cnJlbnQgPSB7IGlkeDogY2FwdHVyZWRJZHgsIHRyaWVzOiAwIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KVxuICAgIC8vIE5vIGRlcHMg4oCUIG11c3QgcnVuIGV2ZXJ5IHJlbmRlci4gU3VwcHJlc3Npb24gc3RhdGUgbGl2ZXMgaW4gYSByZWZcbiAgICAvLyAobm90IGlkeC9lc3RpbWF0ZSksIHNvIGEgZGVwcy1nYXRlZCBlZmZlY3Qgd291bGQgbmV2ZXIgc2VlIGl0IHRpY2suXG4gICAgLy8gQm9keSdzIG93biBndWFyZHMgc2hvcnQtY2lyY3VpdCB3aGVuIG5vdGhpbmcgY2hhbmdlZC5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcmVhY3QtaG9va3MvZXhoYXVzdGl2ZS1kZXBzXG4gIH0pXG5cbiAgLy8gQ29ycmVjdGlvbjogZm9yIGNsaWNrLWp1bXBzIHRvIHVubW91bnRlZCBpdGVtcy4gQ2xpY2sgaGFuZGxlciBzY3JvbGxlZFxuICAvLyB0byB0aGUgZXN0aW1hdGU7IHRoaXMgcmUtYW5jaG9ycyBieSBlbGVtZW50IG9uY2UgdGhlIGl0ZW0gYXBwZWFycy5cbiAgLy8gc2Nyb2xsVG9FbGVtZW50IGRlZmVycyB0aGUgWW9nYSByZWFkIHRvIHBhaW50IHRpbWUg4oCUIGRldGVybWluaXN0aWMuXG4gIC8vIFNFQ09ORCBzbyBpdCBjbGVhcnMgcGVuZGluZyBBRlRFUiB0aGUgb25DaGFuZ2UgZ2F0ZSBhYm92ZSBoYXMgc2VlbiBpdC5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAocGVuZGluZy5jdXJyZW50LmlkeCA8IDApIHJldHVyblxuICAgIGNvbnN0IGVsID0gZ2V0SXRlbUVsZW1lbnQocGVuZGluZy5jdXJyZW50LmlkeClcbiAgICBpZiAoZWwpIHtcbiAgICAgIHNjcm9sbFJlZi5jdXJyZW50Py5zY3JvbGxUb0VsZW1lbnQoZWwsIDEpXG4gICAgICBwZW5kaW5nLmN1cnJlbnQgPSB7IGlkeDogLTEsIHRyaWVzOiAwIH1cbiAgICB9IGVsc2UgaWYgKCsrcGVuZGluZy5jdXJyZW50LnRyaWVzID4gNSkge1xuICAgICAgcGVuZGluZy5jdXJyZW50ID0geyBpZHg6IC0xLCB0cmllczogMCB9XG4gICAgfVxuICB9KVxuXG4gIHJldHVybiBudWxsXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxjQUFjQSxTQUFTLFFBQVEsT0FBTztBQUN0QyxPQUFPLEtBQUtDLEtB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