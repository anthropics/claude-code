import React, { type RefObject, useEffect, useRef } from 'react';
import { useNotifications } from '../context/notifications.js';
import { useCopyOnSelect, useSelectionBgColor } from '../hooks/useCopyOnSelect.js';
import type { ScrollBoxHandle } from '../ink/components/ScrollBox.js';
import { useSelection } from '../ink/hooks/use-selection.js';
import type { FocusMove, SelectionState } from '../ink/selection.js';
import { isXtermJs } from '../ink/terminal.js';
import { getClipboardPath } from '../ink/termio/osc.js';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- Esc needs conditional propagation based on selection state
import { type Key, useInput } from '../ink.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import { logForDebugging } from '../utils/debug.js';
type Props = {
  scrollRef: RefObject<ScrollBoxHandle | null>;
  isActive: boolean;
  /** Called after every scroll action with the resulting sticky state and
   *  the handle (for reading scrollTop/scrollHeight post-scroll). */
  onScroll?: (sticky: boolean, handle: ScrollBoxHandle) => void;
  /** Enables modal pager keys (g/G, ctrl+u/d/b/f). Only safe when there
   *  is no text input competing for those characters — i.e. transcript
   *  mode. Defaults to false. When true, G works regardless of editorMode
   *  and sticky state; ctrl+u/d/b/f don't conflict with kill-line/exit/
   *  task:background/kill-agents (none are mounted, or they mount after
   *  this component so stopImmediatePropagation wins). */
  isModal?: boolean;
};

// Terminals send one SGR wheel event per intended row (verified in Ghostty
// src/Surface.zig: `for (0..@abs(y.delta)) |_| { mouseReport(.four, ...) }`).
// Ghostty already 3×'s discrete wheel ticks before that loop; trackpad
// precision scroll is pixels/cell_size. 1 event = 1 row intended — use it
// as the base, and ramp a multiplier when events arrive rapidly. The
// pendingScrollDelta accumulator + proportional drain in
// render-node-to-output handles smooth catch-up on big bursts.
//
// xterm.js (VS Code/Cursor/Windsurf integrated terminals) sends exactly 1
// event per wheel notch — no pre-amplification. A separate exponential
// decay curve (below) compensates for the lower event rate, with burst
// detection and gap-dependent caps tuned to VS Code's event patterns.

// Native terminals: hard-window linear ramp. Events closer than the window
// ramp the multiplier; idle gaps reset to `base` (default 1). Some emulators
// pre-multiply at their layer (ghostty discrete=3 sends 3 SGR events/notch;
// iTerm2 "faster scroll" similar) — base=1 is correct there. Others send 1
// event/notch — users on those can set CLAUDE_CODE_SCROLL_SPEED=3 to match
// vim/nvim/opencode app-side defaults. We can't detect which, so knob it.
const WHEEL_ACCEL_WINDOW_MS = 40;
const WHEEL_ACCEL_STEP = 0.3;
const WHEEL_ACCEL_MAX = 6;

// Encoder bounce debounce + wheel-mode decay curve. Worn/cheap optical
// encoders emit spurious reverse-direction ticks during fast spins — measured
// 28% of events on Boris's mouse (2026-03-17, iTerm2). Pattern is always
// flip-then-flip-back; trackpads produce ZERO flips (0/458 in same recording).
// A confirmed bounce proves a physical wheel is attached — engage the same
// exponential-decay curve the xterm.js path uses (it's already tuned), with
// a higher cap to compensate for the lower event rate (~9/sec vs VS Code's
// ~30/sec). Trackpad can't reach this path.
//
// The decay curve gives: 1st click after idle = 1 row (precision), 2nd = 10,
// 3rd = cap. Slowing down decays smoothly toward 1 — no separate idle
// threshold needed, large gaps just have m≈0 → mult→1. Wheel mode is STICKY:
// once a bounce confirms it's a mouse, the decay curve applies until an idle
// gap or trackpad-flick-burst signals a possible device switch.
const WHEEL_BOUNCE_GAP_MAX_MS = 200; // flip-back must arrive within this
// Mouse is ~9 events/sec vs VS Code's ~30 — STEP is 3× xterm.js's 5 to
// compensate. At gap=100ms (m≈0.63): one click gives 1+15*0.63≈10.5.
const WHEEL_MODE_STEP = 15;
const WHEEL_MODE_CAP = 15;
// Max mult growth per event. Without this, the +STEP*m term jumps mult
// from 1→10 in one event when wheelMode engages mid-scroll (bounce
// detected after N events in trackpad mode at mult=1). User sees scroll
// suddenly go 10× faster. Cap=3 gives 1→4→7→10→13→15 over ~0.5s at
// 9 events/sec — smooth ramp instead of a jump. Decay is unaffected
// (target<mult wins the min).
const WHEEL_MODE_RAMP = 3;
// Device-switch disengage: mouse finger-repositions max at ~830ms (measured);
// trackpad between-gesture pauses are 2000ms+. An idle gap above this means
// the user stopped — might have switched devices. Disengage; the next mouse
// bounce re-engages. Trackpad slow swipe (no <5ms bursts, so the burst-count
// guard doesn't catch it) is what this protects against.
const WHEEL_MODE_IDLE_DISENGAGE_MS = 1500;

// xterm.js: exponential decay. momentum=0.5^(gap/hl) — slow click → m≈0
// → mult→1 (precision); fast → m≈1 → carries momentum. Steady-state
// = 1 + step×m/(1-m), capped. Measured event rates in VS Code (wheel.log):
// sustained scroll sends events at 20-50ms gaps (20-40 Hz), plus 0-2ms
// same-batch bursts on flicks. Cap is low (3–6, gap-dependent) because event
// frequency is high — at 40 Hz × 6 = 240 rows/sec max demand, which the
// adaptive drain at ~200fps (measured) handles. Higher cap → pending explosion.
// Tuned empirically (boris 2026-03). See docs/research/terminal-scroll-*.
const WHEEL_DECAY_HALFLIFE_MS = 150;
const WHEEL_DECAY_STEP = 5;
// Same-batch events (<BURST_MS) arrive in one stdin batch — the terminal
// is doing proportional reporting. Treat as 1 row/event like native.
const WHEEL_BURST_MS = 5;
// Cap boundary: slow events (≥GAP_MS) cap low for short smooth drains;
// fast events cap higher for throughput (adaptive drain handles backlog).
const WHEEL_DECAY_GAP_MS = 80;
const WHEEL_DECAY_CAP_SLOW = 3; // gap ≥ GAP_MS: precision
const WHEEL_DECAY_CAP_FAST = 6; // gap < GAP_MS: throughput
// Idle threshold: gaps beyond this reset to the kick value (2) so the
// first click after a pause feels responsive regardless of direction.
const WHEEL_DECAY_IDLE_MS = 500;

/**
 * Whether a keypress should clear the virtual text selection. Mimics
 * native terminal selection: any keystroke clears, EXCEPT modified nav
 * keys (shift/opt/cmd + arrow/home/end/page*). In native macOS contexts,
 * shift+nav extends selection, and cmd/opt+nav are often intercepted by
 * the terminal emulator for scrollback nav — neither disturbs selection.
 * Bare arrows DO clear (user's cursor moves, native deselects). Wheel is
 * excluded — scroll:lineUp/Down already clears via the keybinding path.
 */
export function shouldClearSelectionOnKey(key: Key): boolean {
  if (key.wheelUp || key.wheelDown) return false;
  const isNav = key.leftArrow || key.rightArrow || key.upArrow || key.downArrow || key.home || key.end || key.pageUp || key.pageDown;
  if (isNav && (key.shift || key.meta || key.super)) return false;
  return true;
}

/**
 * Map a keypress to a selection focus move (keyboard extension). Only
 * shift extends — that's the universal text-selection modifier. cmd
 * (super) only arrives via kitty keyboard protocol — in most terminals
 * cmd+arrow is intercepted by the emulator and never reaches the pty, so
 * no super branch. shift+home/end covers line-edge jumps (and fn+shift+
 * left/right on mac laptops = shift+home/end). shift+opt (word-jump) not
 * yet implemented — falls through to shouldClearSelectionOnKey which
 * preserves (modified nav). Returns null for non-extend keys.
 */
export function selectionFocusMoveForKey(key: Key): FocusMove | null {
  if (!key.shift || key.meta) return null;
  if (key.leftArrow) return 'left';
  if (key.rightArrow) return 'right';
  if (key.upArrow) return 'up';
  if (key.downArrow) return 'down';
  if (key.home) return 'lineStart';
  if (key.end) return 'lineEnd';
  return null;
}
export type WheelAccelState = {
  time: number;
  mult: number;
  dir: 0 | 1 | -1;
  xtermJs: boolean;
  /** Carried fractional scroll (xterm.js only). scrollBy floors, so without
   *  this a mult of 1.5 gives 1 row every time. Carrying the remainder gives
   *  1,2,1,2 on average for mult=1.5 — correct throughput over time. */
  frac: number;
  /** Native-path baseline rows/event. Reset value on idle/reversal; ramp
   *  builds on top. xterm.js path ignores this (own kick=2 tuning). */
  base: number;
  /** Deferred direction flip (native only). Might be encoder bounce or a
   *  real reversal — resolved by the NEXT event. Real reversal loses 1 row
   *  of latency; bounce is swallowed and triggers wheel mode. The flip's
   *  direction and timestamp are derivable (it's always -state.dir at
   *  state.time) so this is just a marker. */
  pendingFlip: boolean;
  /** Set true once a bounce is confirmed (flip-then-flip-back within
   *  BOUNCE_GAP_MAX). Sticky — but disengaged on idle gap >1500ms OR a
   *  trackpad-signature burst (see burstCount). State lives in a useRef so
   *  it persists across device switches; the disengages handle mouse→trackpad. */
  wheelMode: boolean;
  /** Consecutive <5ms events. Trackpad flick produces 100+ at <5ms; mouse
   *  produces ≤3 (verified in /tmp/wheel-tune.txt). 5+ in a row → trackpad
   *  signature → disengage wheel mode so device-switch doesn't leak mouse
   *  accel to trackpad. */
  burstCount: number;
};

/** Compute rows for one wheel event, mutating accel state. Returns 0 when
 *  a direction flip is deferred for bounce detection — call sites no-op on
 *  step=0 (scrollBy(0) is a no-op, onScroll(false) is idempotent). Exported
 *  for tests. */
export function computeWheelStep(state: WheelAccelState, dir: 1 | -1, now: number): number {
  if (!state.xtermJs) {
    // Device-switch guard ①: idle disengage. Runs BEFORE pendingFlip resolve
    // so a pending bounce (28% of last-mouse-events) doesn't bypass it via
    // the real-reversal early return. state.time is either the last committed
    // event OR the deferred flip — both count as "last activity".
    if (state.wheelMode && now - state.time > WHEEL_MODE_IDLE_DISENGAGE_MS) {
      state.wheelMode = false;
      state.burstCount = 0;
      state.mult = state.base;
    }

    // Resolve any deferred flip BEFORE touching state.time/dir — we need the
    // pre-flip state.dir to distinguish bounce (flip-back) from real reversal
    // (flip persisted), and state.time (= bounce timestamp) for the gap check.
    if (state.pendingFlip) {
      state.pendingFlip = false;
      if (dir !== state.dir || now - state.time > WHEEL_BOUNCE_GAP_MAX_MS) {
        // Real reversal: new dir persisted, OR flip-back arrived too late.
        // Commit. The deferred event's 1 row is lost (acceptable latency).
        state.dir = dir;
        state.time = now;
        state.mult = state.base;
        return Math.floor(state.mult);
      }
      // Bounce confirmed: flipped back to original dir within the window.
      // state.dir/mult unchanged from pre-bounce. state.time was advanced to
      // the bounce below, so gap here = flip-back interval — reflects the
      // user's actual click cadence (bounce IS a physical click, just noisy).
      state.wheelMode = true;
    }
    const gap = now - state.time;
    if (dir !== state.dir && state.dir !== 0) {
      // Flip. Defer — next event decides bounce vs. real reversal. Advance
      // time (but NOT dir/mult): if this turns out to be a bounce, the
      // confirm event's gap will be the flip-back interval, which reflects
      // the user's actual click rate. The bounce IS a physical wheel click,
      // just misread by the encoder — it should count toward cadence.
      state.pendingFlip = true;
      state.time = now;
      return 0;
    }
    state.dir = dir;
    state.time = now;

    // ─── MOUSE (wheel mode, sticky until device-switch signal) ───
    if (state.wheelMode) {
      if (gap < WHEEL_BURST_MS) {
        // Same-batch burst check (ported from xterm.js): iTerm2 proportional
        // reporting sends 2+ SGR events for one detent when macOS gives
        // delta>1. Without this, the 2nd event at gap<1ms has m≈1 → STEP*m=15
        // → one gentle click gives 1+15=16 rows.
        //
        // Device-switch guard ②: trackpad flick produces 100+ events at <5ms
        // (measured); mouse produces ≤3. 5+ consecutive → trackpad flick.
        if (++state.burstCount >= 5) {
          state.wheelMode = false;
          state.burstCount = 0;
          state.mult = state.base;
        } else {
          return 1;
        }
      } else {
        state.burstCount = 0;
      }
    }
    // Re-check: may have disengaged above.
    if (state.wheelMode) {
      // xterm.js decay curve with STEP×3, higher cap. No idle threshold —
      // the curve handles it (gap=1000ms → m≈0.01 → mult≈1). No frac —
      // rounding loss is minor at high mult, and frac persisting across idle
      // was causing off-by-one on the first click back.
      const m = Math.pow(0.5, gap / WHEEL_DECAY_HALFLIFE_MS);
      const cap = Math.max(WHEEL_MODE_CAP, state.base * 2);
      const next = 1 + (state.mult - 1) * m + WHEEL_MODE_STEP * m;
      state.mult = Math.min(cap, next, state.mult + WHEEL_MODE_RAMP);
      return Math.floor(state.mult);
    }

    // ─── TRACKPAD / HI-RES (native, non-wheel-mode) ───
    // Tight 40ms burst window: sub-40ms events ramp, anything slower resets.
    // Trackpad flick delivers 200+ events at <20ms gaps → rails to cap 6.
    // Trackpad slow swipe at 40-400ms gaps → resets every event → 1 row each.
    if (gap > WHEEL_ACCEL_WINDOW_MS) {
      state.mult = state.base;
    } else {
      const cap = Math.max(WHEEL_ACCEL_MAX, state.base * 2);
      state.mult = Math.min(cap, state.mult + WHEEL_ACCEL_STEP);
    }
    return Math.floor(state.mult);
  }

  // ─── VSCODE (xterm.js, browser wheel events) ───
  // Browser wheel events — no encoder bounce, no SGR bursts. Decay curve
  // unchanged from the original tuning. Same formula shape as wheel mode
  // above (keep in sync) but STEP=5 not 15 — higher event rate here.
  const gap = now - state.time;
  const sameDir = dir === state.dir;
  state.time = now;
  state.dir = dir;
  // xterm.js path. Debug log shows two patterns: (a) 20-50ms gaps during
  // sustained scroll (~30 Hz), (b) <5ms same-batch bursts on flicks. For
  // (b) give 1 row/event — the burst count IS the acceleration, same as
  // native. For (a) the decay curve gives 3-5 rows. For sparse events
  // (100ms+, slow deliberate scroll) the curve gives 1-3.
  if (sameDir && gap < WHEEL_BURST_MS) return 1;
  if (!sameDir || gap > WHEEL_DECAY_IDLE_MS) {
    // Direction reversal or long idle: start at 2 (not 1) so the first
    // click after a pause moves a visible amount. Without this, idle-
    // then-resume in the same direction decays to mult≈1 (1 row).
    state.mult = 2;
    state.frac = 0;
  } else {
    const m = Math.pow(0.5, gap / WHEEL_DECAY_HALFLIFE_MS);
    const cap = gap >= WHEEL_DECAY_GAP_MS ? WHEEL_DECAY_CAP_SLOW : WHEEL_DECAY_CAP_FAST;
    state.mult = Math.min(cap, 1 + (state.mult - 1) * m + WHEEL_DECAY_STEP * m);
  }
  const total = state.mult + state.frac;
  const rows = Math.floor(total);
  state.frac = total - rows;
  return rows;
}

/** Read CLAUDE_CODE_SCROLL_SPEED, default 1, clamp (0, 20].
 *  Some terminals pre-multiply wheel events (ghostty discrete=3, iTerm2
 *  "faster scroll") — base=1 is correct there. Others send 1 event/notch —
 *  set CLAUDE_CODE_SCROLL_SPEED=3 to match vim/nvim/opencode. We can't
 *  detect which kind of terminal we're in, hence the knob. Called lazily
 *  from initAndLogWheelAccel so globalSettings.env has loaded. */
export function readScrollSpeedBase(): number {
  const raw = process.env.CLAUDE_CODE_SCROLL_SPEED;
  if (!raw) return 1;
  const n = parseFloat(raw);
  return Number.isNaN(n) || n <= 0 ? 1 : Math.min(n, 20);
}

/** Initial wheel accel state. xtermJs=true selects the decay curve.
 *  base is the native-path baseline rows/event (default 1). */
export function initWheelAccel(xtermJs = false, base = 1): WheelAccelState {
  return {
    time: 0,
    mult: base,
    dir: 0,
    xtermJs,
    frac: 0,
    base,
    pendingFlip: false,
    wheelMode: false,
    burstCount: 0
  };
}

// Lazy-init helper. isXtermJs() combines the TERM_PROGRAM env check + async
// XTVERSION probe — the probe may not have resolved at render time, so this
// is called on the first wheel event (>>50ms after startup) when it's settled.
// Logs detected mode once so --debug users can verify SSH detection worked.
// The renderer also calls isXtermJsHost() (in render-node-to-output) to
// select the drain algorithm — no state to pass through.
function initAndLogWheelAccel(): WheelAccelState {
  const xtermJs = isXtermJs();
  const base = readScrollSpeedBase();
  logForDebugging(`wheel accel: ${xtermJs ? 'decay (xterm.js)' : 'window (native)'} · base=${base} · TERM_PROGRAM=${process.env.TERM_PROGRAM ?? 'unset'}`);
  return initWheelAccel(xtermJs, base);
}

// Drag-to-scroll: when dragging past the viewport edge, scroll by this many
// rows every AUTOSCROLL_INTERVAL_MS. Mode 1002 mouse tracking only fires on
// cell change, so a timer is needed to continue scrolling while stationary.
const AUTOSCROLL_LINES = 2;
const AUTOSCROLL_INTERVAL_MS = 50;
// Hard cap on consecutive auto-scroll ticks. If the release event is lost
// (mouse released outside terminal window — some emulators don't capture the
// pointer and drop the release), isDragging stays true and the timer would
// run until a scroll boundary. Cap bounds the damage; any new drag motion
// event restarts the count via check()→start().
const AUTOSCROLL_MAX_TICKS = 200; // 10s @ 50ms

/**
 * Keyboard scroll navigation for the fullscreen layout's message scroll box.
 * PgUp/PgDn scroll by half-viewport. Mouse wheel scrolls by a few lines.
 * Scrolling breaks sticky mode; Ctrl+End re-enables it. Wheeling down at
 * the bottom also re-enables sticky so new content follows naturally.
 */
export function ScrollKeybindingHandler({
  scrollRef,
  isActive,
  onScroll,
  isModal = false
}: Props): React.ReactNode {
  const selection = useSelection();
  const {
    addNotification
  } = useNotifications();
  // Lazy-inited on first wheel event so the XTVERSION probe (fired at
  // raw-mode-enable time) has resolved by then — initializing in useRef()
  // would read getWheelBase() before the probe reply arrives over SSH.
  const wheelAccel = useRef<WheelAccelState | null>(null);
  function showCopiedToast(text: string): void {
    // getClipboardPath reads env synchronously — predicts what setClipboard
    // did (native pbcopy / tmux load-buffer / raw OSC 52) so we can tell
    // the user whether paste will Just Work or needs prefix+].
    const path = getClipboardPath();
    const n = text.length;
    let msg: string;
    switch (path) {
      case 'native':
        msg = `copied ${n} chars to clipboard`;
        break;
      case 'tmux-buffer':
        msg = `copied ${n} chars to tmux buffer · paste with prefix + ]`;
        break;
      case 'osc52':
        msg = `sent ${n} chars via OSC 52 · check terminal clipboard settings if paste fails`;
        break;
    }
    addNotification({
      key: 'selection-copied',
      text: msg,
      color: 'suggestion',
      priority: 'immediate',
      timeoutMs: path === 'native' ? 2000 : 4000
    });
  }
  function copyAndToast(): void {
    const text_0 = selection.copySelection();
    if (text_0) showCopiedToast(text_0);
  }

  // Translate selection to track a keyboard page jump. Selection coords are
  // screen-buffer-local; a scrollTo that moves content by N rows must also
  // shift anchor+focus by N so the highlight stays on the same text (native
  // terminal behavior: selection moves with content, clips at viewport
  // edges). Rows that scroll out of the viewport are captured into
  // scrolledOffAbove/Below before the scroll so getSelectedText still
  // returns the full text. Wheel scroll (scroll:lineUp/Down via scrollBy)
  // still clears — its async pendingScrollDelta drain means the actual
  // delta isn't known synchronously (follow-up).
  function translateSelectionForJump(s: ScrollBoxHandle, delta: number): void {
    const sel = selection.getState();
    if (!sel?.anchor || !sel.focus) return;
    const top = s.getViewportTop();
    const bottom = top + s.getViewportHeight() - 1;
    // Only translate if the selection is ON scrollbox content. Selections
    // in the footer/prompt/StickyPromptHeader are on static text — the
    // scroll doesn't move what's under them. Same guard as ink.tsx's
    // auto-follow translate (commit 36a8d154).
    if (sel.anchor.row < top || sel.anchor.row > bottom) return;
    // Cross-boundary: anchor in scrollbox, focus in footer/header. Mirror
    // ink.tsx's Flag-3 guard — fall through without shifting OR capturing.
    // The static endpoint pins the selection; shifting would teleport it
    // into scrollbox content.
    if (sel.focus.row < top || sel.focus.row > bottom) return;
    const max = Math.max(0, s.getScrollHeight() - s.getViewportHeight());
    const cur = s.getScrollTop() + s.getPendingDelta();
    // Actual scroll distance after boundary clamp. jumpBy may call
    // scrollToBottom when target >= max but the view can't move past max,
    // so the selection shift is bounded here.
    const actual = Math.max(0, Math.min(max, cur + delta)) - cur;
    if (actual === 0) return;
    if (actual > 0) {
      // Scrolling down: content moves up. Rows at the TOP leave viewport.
      // Anchor+focus shift -actual so they track the content that moved up.
      selection.captureScrolledRows(top, top + actual - 1, 'above');
      selection.shiftSelection(-actual, top, bottom);
    } else {
      // Scrolling up: content moves down. Rows at the BOTTOM leave viewport.
      const a = -actual;
      selection.captureScrolledRows(bottom - a + 1, bottom, 'below');
      selection.shiftSelection(a, top, bottom);
    }
  }
  useKeybindings({
    'scroll:pageUp': () => {
      const s_0 = scrollRef.current;
      if (!s_0) return;
      const d = -Math.max(1, Math.floor(s_0.getViewportHeight() / 2));
      translateSelectionForJump(s_0, d);
      const sticky = jumpBy(s_0, d);
      onScroll?.(sticky, s_0);
    },
    'scroll:pageDown': () => {
      const s_1 = scrollRef.current;
      if (!s_1) return;
      const d_0 = Math.max(1, Math.floor(s_1.getViewportHeight() / 2));
      translateSelectionForJump(s_1, d_0);
      const sticky_0 = jumpBy(s_1, d_0);
      onScroll?.(sticky_0, s_1);
    },
    'scroll:lineUp': () => {
      // Wheel: scrollBy accumulates into pendingScrollDelta, drained async
      // by the renderer. captureScrolledRows can't read the outgoing rows
      // before they leave (drain is non-deterministic). Clear for now.
      selection.clearSelection();
      const s_2 = scrollRef.current;
      // Return false (not consumed) when the ScrollBox content fits —
      // scroll would be a no-op. Lets a child component's handler take
      // the wheel event instead (e.g. Settings Config's list navigation
      // inside the centered Modal, where the paginated slice always fits).
      if (!s_2 || s_2.getScrollHeight() <= s_2.getViewportHeight()) return false;
      wheelAccel.current ??= initAndLogWheelAccel();
      scrollUp(s_2, computeWheelStep(wheelAccel.current, -1, performance.now()));
      onScroll?.(false, s_2);
    },
    'scroll:lineDown': () => {
      selection.clearSelection();
      const s_3 = scrollRef.current;
      if (!s_3 || s_3.getScrollHeight() <= s_3.getViewportHeight()) return false;
      wheelAccel.current ??= initAndLogWheelAccel();
      const step = computeWheelStep(wheelAccel.current, 1, performance.now());
      const reachedBottom = scrollDown(s_3, step);
      onScroll?.(reachedBottom, s_3);
    },
    'scroll:top': () => {
      const s_4 = scrollRef.current;
      if (!s_4) return;
      translateSelectionForJump(s_4, -(s_4.getScrollTop() + s_4.getPendingDelta()));
      s_4.scrollTo(0);
      onScroll?.(false, s_4);
    },
    'scroll:bottom': () => {
      const s_5 = scrollRef.current;
      if (!s_5) return;
      const max_0 = Math.max(0, s_5.getScrollHeight() - s_5.getViewportHeight());
      translateSelectionForJump(s_5, max_0 - (s_5.getScrollTop() + s_5.getPendingDelta()));
      // scrollTo(max) eager-writes scrollTop so the render-phase sticky
      // follow computes followDelta=0. Without this, scrollToBottom()
      // alone leaves scrollTop stale → followDelta=max-stale →
      // shiftSelectionForFollow applies the SAME shift we already did
      // above, 2× offset. scrollToBottom() then re-enables sticky.
      s_5.scrollTo(max_0);
      s_5.scrollToBottom();
      onScroll?.(true, s_5);
    },
    'selection:copy': copyAndToast
  }, {
    context: 'Scroll',
    isActive
  });

  // scroll:halfPage*/fullPage* have no default key bindings — ctrl+u/d/b/f
  // all have real owners in normal mode (kill-line/exit/task:background/
  // kill-agents). Transcript mode gets them via the isModal raw useInput
  // below. These handlers stay for custom rebinds only.
  useKeybindings({
    'scroll:halfPageUp': () => {
      const s_6 = scrollRef.current;
      if (!s_6) return;
      const d_1 = -Math.max(1, Math.floor(s_6.getViewportHeight() / 2));
      translateSelectionForJump(s_6, d_1);
      const sticky_1 = jumpBy(s_6, d_1);
      onScroll?.(sticky_1, s_6);
    },
    'scroll:halfPageDown': () => {
      const s_7 = scrollRef.current;
      if (!s_7) return;
      const d_2 = Math.max(1, Math.floor(s_7.getViewportHeight() / 2));
      translateSelectionForJump(s_7, d_2);
      const sticky_2 = jumpBy(s_7, d_2);
      onScroll?.(sticky_2, s_7);
    },
    'scroll:fullPageUp': () => {
      const s_8 = scrollRef.current;
      if (!s_8) return;
      const d_3 = -Math.max(1, s_8.getViewportHeight());
      translateSelectionForJump(s_8, d_3);
      const sticky_3 = jumpBy(s_8, d_3);
      onScroll?.(sticky_3, s_8);
    },
    'scroll:fullPageDown': () => {
      const s_9 = scrollRef.current;
      if (!s_9) return;
      const d_4 = Math.max(1, s_9.getViewportHeight());
      translateSelectionForJump(s_9, d_4);
      const sticky_4 = jumpBy(s_9, d_4);
      onScroll?.(sticky_4, s_9);
    }
  }, {
    context: 'Scroll',
    isActive
  });

  // Modal pager keys — transcript mode only. less/tmux copy-mode lineage:
  // ctrl+u/d (half-page), ctrl+b/f (full-page), g/G (top/bottom). Tom's
  // resolution (2026-03-15): "In ctrl-o mode, ctrl-u, ctrl-d, etc. should
  // roughly just work!" — transcript is the copy-mode container.
  //
  // Safe because the conflicting handlers aren't reachable here:
  //   ctrl+u → kill-line, ctrl+d → exit: PromptInput not mounted
  //   ctrl+b → task:background: SessionBackgroundHint not mounted
  //   ctrl+f → chat:killAgents moved to ctrl+x ctrl+k; no conflict
  //   g/G → printable chars: no prompt to eat them, no vim/sticky gate needed
  //
  // TODO(search): `/`, n/N — build on Richard Kim's d94b07add4 (branch
  // claude/jump-recent-message-CEPcq). getItemY Yoga-walk + computeOrigin +
  // anchorY already solve scroll-to-index. jumpToPrevTurn is the n/N
  // template. Single-shot via OVERSCAN_ROWS=80; two-phase was tried and
  // abandoned (❯ oscillation). See team memory scroll-copy-mode-design.md.
  useInput((input, key, event) => {
    const s_10 = scrollRef.current;
    if (!s_10) return;
    const sticky_5 = applyModalPagerAction(s_10, modalPagerAction(input, key), d_5 => translateSelectionForJump(s_10, d_5));
    if (sticky_5 === null) return;
    onScroll?.(sticky_5, s_10);
    event.stopImmediatePropagation();
  }, {
    isActive: isActive && isModal
  });

  // Esc clears selection; any other keystroke also clears it (matches
  // native terminal behavior where selection disappears on input).
  // Ctrl+C copies when a selection exists — needed on legacy terminals
  // where ctrl+shift+c sends the same byte (\x03, shift is lost) and
  // cmd+c never reaches the pty (terminal intercepts it for Edit > Copy).
  // Handled via raw useInput so we can conditionally consume: Esc/Ctrl+C
  // only stop propagation when a selection exists, letting them still work
  // for cancel-request / interrupt otherwise. Other keys never stop
  // propagation — they're observed to clear selection as a side-effect.
  // The selection:copy keybinding (ctrl+shift+c / cmd+c) registers above
  // via useKeybindings and consumes its event before reaching here.
  useInput((input_0, key_0, event_0) => {
    if (!selection.hasSelection()) return;
    if (key_0.escape) {
      selection.clearSelection();
      event_0.stopImmediatePropagation();
      return;
    }
    if (key_0.ctrl && !key_0.shift && !key_0.meta && input_0 === 'c') {
      copyAndToast();
      event_0.stopImmediatePropagation();
      return;
    }
    const move = selectionFocusMoveForKey(key_0);
    if (move) {
      selection.moveFocus(move);
      event_0.stopImmediatePropagation();
      return;
    }
    if (shouldClearSelectionOnKey(key_0)) {
      selection.clearSelection();
    }
  }, {
    isActive
  });
  useDragToScroll(scrollRef, selection, isActive, onScroll);
  useCopyOnSelect(selection, isActive, showCopiedToast);
  useSelectionBgColor(selection);
  return null;
}

/**
 * Auto-scroll the ScrollBox when the user drags a selection past its top or
 * bottom edge. The anchor is shifted in the opposite direction so it stays
 * on the same content (content that was at viewport row N is now at row N±d
 * after scrolling by d). Focus stays at the mouse position (edge row).
 *
 * Selection coords are screen-buffer-local, so the anchor is clamped to the
 * viewport bounds once the original content scrolls out. To preserve the full
 * selection, rows about to scroll out are captured into scrolledOffAbove/
 * scrolledOffBelow before each scroll step and joined back in by
 * getSelectedText.
 */
function useDragToScroll(scrollRef: RefObject<ScrollBoxHandle | null>, selection: ReturnType<typeof useSelection>, isActive: boolean, onScroll: Props['onScroll']): void {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dirRef = useRef<-1 | 0 | 1>(0); // -1 scrolling up, +1 down, 0 idle
  // Survives stop() — reset only on drag-finish. See check() for semantics.
  const lastScrolledDirRef = useRef<-1 | 0 | 1>(0);
  const ticksRef = useRef(0);
  // onScroll may change identity every render (if not memoized by caller).
  // Read through a ref so the effect doesn't re-subscribe and kill the timer
  // on each scroll-induced re-render.
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;
  useEffect(() => {
    if (!isActive) return;
    function stop(): void {
      dirRef.current = 0;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    function tick(): void {
      const sel = selection.getState();
      const s = scrollRef.current;
      const dir = dirRef.current;
      // dir === 0 defends against a stale interval (start() may have set one
      // after the immediate tick already called stop() at a scroll boundary).
      // ticks cap defends against a lost release event (mouse released
      // outside terminal window) leaving isDragging stuck true.
      if (!sel?.isDragging || !sel.focus || !s || dir === 0 || ++ticksRef.current > AUTOSCROLL_MAX_TICKS) {
        stop();
        return;
      }
      // scrollBy accumulates into pendingScrollDelta; the screen buffer
      // doesn't update until the next render drains it. If a previous
      // tick's scroll hasn't drained yet, captureScrolledRows would read
      // stale content (same rows as last tick → duplicated in the
      // accumulator AND missing the rows that actually scrolled out).
      // Skip this tick; the 50ms interval will retry after Ink's 16ms
      // render catches up. Also prevents shiftAnchor from desyncing.
      if (s.getPendingDelta() !== 0) return;
      const top = s.getViewportTop();
      const bottom = top + s.getViewportHeight() - 1;
      // Clamp anchor within [top, bottom]. Not [0, bottom]: the ScrollBox
      // padding row at 0 would produce a blank line between scrolledOffAbove
      // and the on-screen content in getSelectedText. The padding-row
      // highlight was a minor visual nicety; text correctness wins.
      if (dir < 0) {
        if (s.getScrollTop() <= 0) {
          stop();
          return;
        }
        // Scrolling up: content moves down in viewport, so anchor row +N.
        // Clamp to actual scroll distance so anchor stays in sync when near
        // the top boundary (renderer clamps scrollTop to 0 on drain).
        const actual = Math.min(AUTOSCROLL_LINES, s.getScrollTop());
        // Capture rows about to scroll out the BOTTOM before scrollBy
        // overwrites them. Only rows inside the selection are captured
        // (captureScrolledRows intersects with selection bounds).
        selection.captureScrolledRows(bottom - actual + 1, bottom, 'below');
        selection.shiftAnchor(actual, 0, bottom);
        s.scrollBy(-AUTOSCROLL_LINES);
      } else {
        const max = Math.max(0, s.getScrollHeight() - s.getViewportHeight());
        if (s.getScrollTop() >= max) {
          stop();
          return;
        }
        // Scrolling down: content moves up in viewport, so anchor row -N.
        // Clamp to actual scroll distance so anchor stays in sync when near
        // the bottom boundary (renderer clamps scrollTop to max on drain).
        const actual_0 = Math.min(AUTOSCROLL_LINES, max - s.getScrollTop());
        // Capture rows about to scroll out the TOP.
        selection.captureScrolledRows(top, top + actual_0 - 1, 'above');
        selection.shiftAnchor(-actual_0, top, bottom);
        s.scrollBy(AUTOSCROLL_LINES);
      }
      onScrollRef.current?.(false, s);
    }
    function start(dir_0: -1 | 1): void {
      // Record BEFORE early-return: the empty-accumulator reset in check()
      // may have zeroed this during the pre-crossing phase (accumulators
      // empty until the anchor row enters the capture range). Re-record
      // on every call so the corruption is instantly healed.
      lastScrolledDirRef.current = dir_0;
      if (dirRef.current === dir_0) return; // already going this way
      stop();
      dirRef.current = dir_0;
      ticksRef.current = 0;
      tick();
      // tick() may have hit a scroll boundary and called stop() (dir reset to
      // 0). Only start the interval if we're still going — otherwise the
      // interval would run forever with dir === 0 doing nothing useful.
      if (dirRef.current === dir_0) {
        timerRef.current = setInterval(tick, AUTOSCROLL_INTERVAL_MS);
      }
    }

    // Re-evaluated on every selection change (start/drag/finish/clear).
    // Drives drag-to-scroll autoscroll when the drag leaves the viewport.
    // Prior versions broke sticky here on drag-start to prevent selection
    // drift during streaming — ink.tsx now translates selection coords by
    // the follow delta instead (native terminal behavior: view keeps
    // scrolling, highlight walks up with the text). Keeping sticky also
    // avoids useVirtualScroll's tail-walk → forward-walk phantom growth.
    function check(): void {
      const s_0 = scrollRef.current;
      if (!s_0) {
        stop();
        return;
      }
      const top_0 = s_0.getViewportTop();
      const bottom_0 = top_0 + s_0.getViewportHeight() - 1;
      const sel_0 = selection.getState();
      // Pass the LAST-scrolled direction (not dirRef) so the anchor guard is
      // bypassed after shiftAnchor has clamped anchor toward row 0. Using
      // lastScrolledDirRef (survives stop()) lets autoscroll resume after a
      // brief mouse dip into the viewport. Same-direction only — a mouse
      // jump from below-bottom to above-top must stop, since reversing while
      // the scrolledOffAbove/Below accumulators hold the prior direction's
      // rows would duplicate text in getSelectedText. Reset on drag-finish
      // OR when both accumulators are empty: startSelection clears them
      // (selection.ts), so a new drag after a lost-release (isDragging
      // stuck true, the reason AUTOSCROLL_MAX_TICKS exists) still resets.
      // Safe: start() below re-records lastScrolledDirRef before its
      // early-return, so a mid-scroll reset here is instantly undone.
      if (!sel_0?.isDragging || sel_0.scrolledOffAbove.length === 0 && sel_0.scrolledOffBelow.length === 0) {
        lastScrolledDirRef.current = 0;
      }
      const dir_1 = dragScrollDirection(sel_0, top_0, bottom_0, lastScrolledDirRef.current);
      if (dir_1 === 0) {
        // Blocked reversal: focus jumped to the opposite edge (off-window
        // drag return, fast flick). handleSelectionDrag already moved focus
        // past the anchor, flipping selectionBounds — the accumulator is
        // now orphaned (holds rows on the wrong side). Clear it so
        // getSelectedText matches the visible highlight.
        if (lastScrolledDirRef.current !== 0 && sel_0?.focus) {
          const want = sel_0.focus.row < top_0 ? -1 : sel_0.focus.row > bottom_0 ? 1 : 0;
          if (want !== 0 && want !== lastScrolledDirRef.current) {
            sel_0.scrolledOffAbove = [];
            sel_0.scrolledOffBelow = [];
            sel_0.scrolledOffAboveSW = [];
            sel_0.scrolledOffBelowSW = [];
            lastScrolledDirRef.current = 0;
          }
        }
        stop();
      } else start(dir_1);
    }
    const unsubscribe = selection.subscribe(check);
    return () => {
      unsubscribe();
      stop();
      lastScrolledDirRef.current = 0;
    };
  }, [isActive, scrollRef, selection]);
}

/**
 * Compute autoscroll direction for a drag selection relative to the ScrollBox
 * viewport. Returns 0 when not dragging, anchor/focus missing, or the anchor
 * is outside the viewport — a multi-click or drag that started in the input
 * area must not commandeer the message scroll (double-click in the input area
 * while scrolled up previously corrupted the anchor via shiftAnchor and
 * spuriously scrolled the message history every 50ms until release).
 *
 * alreadyScrollingDir bypasses the anchor-in-viewport guard once autoscroll
 * is active (shiftAnchor legitimately clamps the anchor toward row 0, below
 * `top`) but only allows SAME-direction continuation. If the focus jumps to
 * the opposite edge (below→above or above→below — possible with a fast flick
 * or off-window drag since mode 1002 reports on cell change, not per cell),
 * returns 0 to stop — reversing without clearing scrolledOffAbove/Below
 * would duplicate captured rows when they scroll back on-screen.
 */
export function dragScrollDirection(sel: SelectionState | null, top: number, bottom: number, alreadyScrollingDir: -1 | 0 | 1 = 0): -1 | 0 | 1 {
  if (!sel?.isDragging || !sel.anchor || !sel.focus) return 0;
  const row = sel.focus.row;
  const want: -1 | 0 | 1 = row < top ? -1 : row > bottom ? 1 : 0;
  if (alreadyScrollingDir !== 0) {
    // Same-direction only. Focus on the opposite side, or back inside the
    // viewport, stops the scroll — captured rows stay in scrolledOffAbove/
    // Below but never scroll back on-screen, so getSelectedText is correct.
    return want === alreadyScrollingDir ? want : 0;
  }
  // Anchor must be inside the viewport for us to own this drag. If the
  // user started selecting in the input box or header, autoscrolling the
  // message history is surprising and corrupts the anchor via shiftAnchor.
  if (sel.anchor.row < top || sel.anchor.row > bottom) return 0;
  return want;
}

// Keyboard page jumps: scrollTo() writes scrollTop directly and clears
// pendingScrollDelta — one frame, no drain. scrollBy() accumulates into
// pendingScrollDelta which the renderer drains over several frames
// (render-node-to-output.ts drainProportional/drainAdaptive) — correct for
// wheel smoothness, wrong for PgUp/ctrl+u where the user expects a snap.
// Target is relative to scrollTop+pendingDelta so a jump mid-wheel-burst
// lands where the wheel was heading.
export function jumpBy(s: ScrollBoxHandle, delta: number): boolean {
  const max = Math.max(0, s.getScrollHeight() - s.getViewportHeight());
  const target = s.getScrollTop() + s.getPendingDelta() + delta;
  if (target >= max) {
    // Eager-write scrollTop so follow-scroll sees followDelta=0. Callers
    // that ran translateSelectionForJump already shifted; scrollToBottom()
    // alone would double-shift via the render-phase sticky follow.
    s.scrollTo(max);
    s.scrollToBottom();
    return true;
  }
  s.scrollTo(Math.max(0, target));
  return false;
}

// Wheel-down past maxScroll re-enables sticky so wheeling at the bottom
// naturally re-pins (matches typical chat-app behavior). Returns the
// resulting sticky state so callers can propagate it.
function scrollDown(s: ScrollBoxHandle, amount: number): boolean {
  const max = Math.max(0, s.getScrollHeight() - s.getViewportHeight());
  // Include pendingDelta: scrollBy accumulates into pendingScrollDelta
  // without updating scrollTop, so getScrollTop() alone is stale within
  // a batch of wheel events. Without this, wheeling to the bottom never
  // re-enables sticky scroll.
  const effectiveTop = s.getScrollTop() + s.getPendingDelta();
  if (effectiveTop + amount >= max) {
    s.scrollToBottom();
    return true;
  }
  s.scrollBy(amount);
  return false;
}

// Wheel-up past scrollTop=0 clamps via scrollTo(0), clearing
// pendingScrollDelta so aggressive wheel bursts (e.g. MX Master free-spin)
// don't accumulate an unbounded negative delta. Without this clamp,
// useVirtualScroll's [effLo, effHi] span grows past what MAX_MOUNTED_ITEMS
// can cover and intermediate drain frames render at scrollTops with no
// mounted children — blank viewport.
export function scrollUp(s: ScrollBoxHandle, amount: number): void {
  // Include pendingDelta: scrollBy accumulates without updating scrollTop,
  // so getScrollTop() alone is stale within a batch of wheel events.
  const effectiveTop = s.getScrollTop() + s.getPendingDelta();
  if (effectiveTop - amount <= 0) {
    s.scrollTo(0);
    return;
  }
  s.scrollBy(-amount);
}
export type ModalPagerAction = 'lineUp' | 'lineDown' | 'halfPageUp' | 'halfPageDown' | 'fullPageUp' | 'fullPageDown' | 'top' | 'bottom';

/**
 * Maps a keystroke to a modal pager action. Exported for testing.
 * Returns null for keys the modal pager doesn't handle (they fall through).
 *
 * ctrl+u/d/b/f are the less-lineage bindings. g/G are bare letters (only
 * safe when no prompt is mounted). G arrives as input='G' shift=false on
 * legacy terminals, or input='g' shift=true on kitty-protocol terminals.
 * Lowercase g needs the !shift guard so it doesn't also match kitty-G.
 *
 * Key-repeat: stdin coalesces held-down printables into one multi-char
 * string (e.g. 'ggg'). Only uniform-char batches are handled — mixed input
 * like 'gG' isn't key-repeat. g/G are idempotent absolute jumps, so the
 * count is irrelevant (consuming the batch just prevents it from leaking
 * to the selection-clear-on-printable handler).
 */
export function modalPagerAction(input: string, key: Pick<Key, 'ctrl' | 'meta' | 'shift' | 'upArrow' | 'downArrow' | 'home' | 'end'>): ModalPagerAction | null {
  if (key.meta) return null;
  // Special keys first — arrows/home/end arrive with empty or junk input,
  // so these must be checked before any input-string logic. shift is
  // reserved for selection-extend (selectionFocusMoveForKey); ctrl+home/end
  // already has a useKeybindings route to scroll:top/bottom.
  if (!key.ctrl && !key.shift) {
    if (key.upArrow) return 'lineUp';
    if (key.downArrow) return 'lineDown';
    if (key.home) return 'top';
    if (key.end) return 'bottom';
  }
  if (key.ctrl) {
    if (key.shift) return null;
    switch (input) {
      case 'u':
        return 'halfPageUp';
      case 'd':
        return 'halfPageDown';
      case 'b':
        return 'fullPageUp';
      case 'f':
        return 'fullPageDown';
      // emacs-style line scroll (less accepts both ctrl+n/p and ctrl+e/y).
      // Works during search nav — fine-adjust after a jump without
      // leaving modal. No !searchOpen gate on this useInput's isActive.
      case 'n':
        return 'lineDown';
      case 'p':
        return 'lineUp';
      default:
        return null;
    }
  }
  // Bare letters. Key-repeat batches: only act on uniform runs.
  const c = input[0];
  if (!c || input !== c.repeat(input.length)) return null;
  // kitty sends G as input='g' shift=true; legacy as 'G' shift=false.
  // Check BEFORE the shift-gate so both hit 'bottom'.
  if (c === 'G' || c === 'g' && key.shift) return 'bottom';
  if (key.shift) return null;
  switch (c) {
    case 'g':
      return 'top';
    // j/k re-added per Tom Mar 18 — reversal of Mar 16 removal. Works
    // during search nav (fine-adjust after n/N lands) since isModal is
    // independent of searchOpen.
    case 'j':
      return 'lineDown';
    case 'k':
      return 'lineUp';
    // less: space = page down, b = page up. ctrl+b already maps above;
    // bare b is the less-native version.
    case ' ':
      return 'fullPageDown';
    case 'b':
      return 'fullPageUp';
    default:
      return null;
  }
}

/**
 * Applies a modal pager action to a ScrollBox. Returns the resulting sticky
 * state, or null if the action was null (nothing to do — caller should fall
 * through). Calls onBeforeJump(delta) before scrolling so the caller can
 * translate the text selection by the scroll delta (capture outgoing rows,
 * shift anchor+focus) instead of clearing it. Exported for testing.
 */
export function applyModalPagerAction(s: ScrollBoxHandle, act: ModalPagerAction | null, onBeforeJump: (delta: number) => void): boolean | null {
  switch (act) {
    case null:
      return null;
    case 'lineUp':
    case 'lineDown':
      {
        const d = act === 'lineDown' ? 1 : -1;
        onBeforeJump(d);
        return jumpBy(s, d);
      }
    case 'halfPageUp':
    case 'halfPageDown':
      {
        const half = Math.max(1, Math.floor(s.getViewportHeight() / 2));
        const d = act === 'halfPageDown' ? half : -half;
        onBeforeJump(d);
        return jumpBy(s, d);
      }
    case 'fullPageUp':
    case 'fullPageDown':
      {
        const page = Math.max(1, s.getViewportHeight());
        const d = act === 'fullPageDown' ? page : -page;
        onBeforeJump(d);
        return jumpBy(s, d);
      }
    case 'top':
      onBeforeJump(-(s.getScrollTop() + s.getPendingDelta()));
      s.scrollTo(0);
      return false;
    case 'bottom':
      {
        const max = Math.max(0, s.getScrollHeight() - s.getViewportHeight());
        onBeforeJump(max - (s.getScrollTop() + s.getPendingDelta()));
        // Eager-write scrollTop before scrollToBottom — same double-shift
        // fix as scroll:bottom and jumpBy's max branch.
        s.scrollTo(max);
        s.scrollToBottom();
        return true;
      }
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsIlJlZk9iamVjdCIsInVzZUVmZmVjdCIsInVzZVJlZiIsInVzZU5vdGlmaWNhdGlvbnMiLCJ1c2VDb3B5T25TZWxlY3QiLCJ1c2VTZWxlY3Rpb25CZ0NvbG9yIiwiU2Nyb2xsQm94SGFuZGxlIiwidXNlU2VsZWN0aW9uIiwiRm9jdXNNb3ZlIiwiU2VsZWN0aW9uU3RhdGUiLCJpc1h0ZXJtSnMiLCJnZXRDbGlwYm9hcmRQYXRoIiwiS2V5IiwidXNlSW5wdXQiLCJ1c2VLZXliaW5kaW5ncyIsImxvZ0ZvckRlYnVnZ2luZyIsIlByb3BzIiwic2Nyb2xsUmVmIiwiaXNBY3RpdmUiLCJvblNjcm9sbCIsInN0aWNreSIsImhhbmRsZSIsImlzTW9kYWwiLCJXSEVFTF9BQ0NFTF9XSU5ET1dfTVMiLCJXSEVFTF9BQ0NFTF9TVEVQIiwiV0hFRUxfQUNDRUxfTUFYIiwiV0hFRUxfQk9VTkNFX0dBUF9NQVhfTVMiLCJXSEVFTF9NT0RFX1NURVAiLCJXSEVFTF9NT0RFX0NBUCIsIldIRUVMX01PREVfUkFNUCIsIldIRUVMX01PREVfSURMRV9ESVNFTkdBR0VfTVMiLCJXSEVFTF9ERUNBWV9IQUxGTElGRV9NUyIsIldIRUVMX0RFQ0FZX1NURVAiLCJXSEVFTF9CVVJTVF9NUyIsIldIRUVMX0RFQ0FZX0dBUF9NUyIsIldIRUVMX0RFQ0FZX0NBUF9TTE9XIiwiV0hFRUxfREVDQVlfQ0FQX0ZBU1QiLCJXSEVFTF9ERUNBWV9JRExFX01TIiwic2hvdWxkQ2xlYXJTZWxlY3Rpb25PbktleSIsImtleSIsIndoZWVsVXAiLCJ3aGVlbERvd24iLCJpc05hdiIsImxlZnRBcnJvdyIsInJpZ2h0QXJyb3ciLCJ1cEFycm93IiwiZG93bkFycm93IiwiaG9tZSIsImVuZCIsInBhZ2VVcCIsInBhZ2VEb3duIiwic2hpZnQiLCJtZXRhIiwic3VwZXIiLCJzZWxlY3Rpb25Gb2N1c01vdmVGb3JLZXkiLCJXaGVlbEFjY2VsU3RhdGUiLCJ0aW1lIiwibXVsdCIsImRpciIsInh0ZXJtSnMiLCJmcmFjIiwiYmFzZSIsInBlbmRpbmdGbGlwIiwid2hlZWxNb2RlIiwiYnVyc3RDb3VudCIsImNvbXB1dGVXaGVlbFN0ZXAiLCJzdGF0ZSIsIm5vdyIsIk1hdGgiLCJmbG9vciIsImdhcCIsIm0iLCJwb3ciLCJjYXAiLCJtYXgiLCJuZXh0IiwibWluIiwic2FtZURpciIsInRvdGFsIiwicm93cyIsInJlYWRTY3JvbGxTcGVlZEJhc2UiLCJyYXciLCJwcm9jZXNzIiwiZW52IiwiQ0xBVURFX0NPREVfU0NST0xMX1NQRUVEIiwibiIsInBhcnNlRmxvYXQiLCJOdW1iZXIiLCJpc05hTiIsImluaXRXaGVlbEFjY2VsIiwiaW5pdEFuZExvZ1doZWVsQWNjZWwiLCJURVJNX1BST0dSQU0iLCJBVVRPU0NST0xMX0xJTkVTIiwiQVVUT1NDUk9MTF9JTlRFUlZBTF9NUyIsIkFVVE9TQ1JPTExfTUFYX1RJQ0tTIiwiU2Nyb2xsS2V5YmluZGluZ0hhbmRsZXIiLCJSZWFjdE5vZGUiLCJzZWxlY3Rpb24iLCJhZGROb3RpZmljYXRpb24iLCJ3aGVlbEFjY2VsIiwic2hvd0NvcGllZFRvYXN0IiwidGV4dCIsInBhdGgiLCJsZW5ndGgiLCJtc2ciLCJjb2xvciIsInByaW9yaXR5IiwidGltZW91dE1zIiwiY29weUFuZFRvYXN0IiwiY29weVNlbGVjdGlvbiIsInRyYW5zbGF0ZVNlbGVjdGlvbkZvckp1bXAiLCJzIiwiZGVsdGEiLCJzZWwiLCJnZXRTdGF0ZSIsImFuY2hvciIsImZvY3VzIiwidG9wIiwiZ2V0Vmlld3BvcnRUb3AiLCJib3R0b20iLCJnZXRWaWV3cG9ydEhlaWdodCIsInJvdyIsImdldFNjcm9sbEhlaWdodCIsImN1ciIsImdldFNjcm9sbFRvcCIsImdldFBlbmRpbmdEZWx0YSIsImFjdHVhbCIsImNhcHR1cmVTY3JvbGxlZFJvd3MiLCJzaGlmdFNlbGVjdGlvbiIsImEiLCJzY3JvbGw6cGFnZVVwIiwiY3VycmVudCIsImQiLCJqdW1wQnkiLCJzY3JvbGw6cGFnZURvd24iLCJzY3JvbGw6bGluZVVwIiwiY2xlYXJTZWxlY3Rpb24iLCJzY3JvbGxVcCIsInBlcmZvcm1hbmNlIiwic2Nyb2xsOmxpbmVEb3duIiwic3RlcCIsInJlYWNoZWRCb3R0b20iLCJzY3JvbGxEb3duIiwic2Nyb2xsOnRvcCIsInNjcm9sbFRvIiwic2Nyb2xsOmJvdHRvbSIsInNjcm9sbFRvQm90dG9tIiwiY29udGV4dCIsInNjcm9sbDpoYWxmUGFnZVVwIiwic2Nyb2xsOmhhbGZQYWdlRG93biIsInNjcm9sbDpmdWxsUGFnZVVwIiwic2Nyb2xsOmZ1bGxQYWdlRG93biIsImlucHV0IiwiZXZlbnQiLCJhcHBseU1vZGFsUGFnZXJBY3Rpb24iLCJtb2RhbFBhZ2VyQWN0aW9uIiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwiaGFzU2VsZWN0aW9uIiwiZXNjYXBlIiwiY3RybCIsIm1vdmUiLCJtb3ZlRm9jdXMiLCJ1c2VEcmFnVG9TY3JvbGwiLCJSZXR1cm5UeXBlIiwidGltZXJSZWYiLCJOb2RlSlMiLCJUaW1lb3V0IiwiZGlyUmVmIiwibGFzdFNjcm9sbGVkRGlyUmVmIiwidGlja3NSZWYiLCJvblNjcm9sbFJlZiIsInN0b3AiLCJjbGVhckludGVydmFsIiwidGljayIsImlzRHJhZ2dpbmciLCJzaGlmdEFuY2hvciIsInNjcm9sbEJ5Iiwic3RhcnQiLCJzZXRJbnRlcnZhbCIsImNoZWNrIiwic2Nyb2xsZWRPZmZBYm92ZSIsInNjcm9sbGVkT2ZmQmVsb3ciLCJkcmFnU2Nyb2xsRGlyZWN0aW9uIiwid2FudCIsInNjcm9sbGVkT2ZmQWJvdmVTVyIsInNjcm9sbGVkT2ZmQmVsb3dTVyIsInVuc3Vic2NyaWJlIiwic3Vic2NyaWJlIiwiYWxyZWFkeVNjcm9sbGluZ0RpciIsInRhcmdldCIsImFtb3VudCIsImVmZmVjdGl2ZVRvcCIsIk1vZGFsUGFnZXJBY3Rpb24iLCJQaWNrIiwiYyIsInJlcGVhdCIsImFjdCIsIm9uQmVmb3JlSnVtcCIsImhhbGYiLCJwYWdlIl0sInNvdXJjZXMiOlsiU2Nyb2xsS2V5YmluZGluZ0hhbmRsZXIudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBSZWFjdCwgeyB0eXBlIFJlZk9iamVjdCwgdXNlRWZmZWN0LCB1c2VSZWYgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHVzZU5vdGlmaWNhdGlvbnMgfSBmcm9tICcuLi9jb250ZXh0L25vdGlmaWNhdGlvbnMuanMnXG5pbXBvcnQge1xuICB1c2VDb3B5T25TZWxlY3QsXG4gIHVzZVNlbGVjdGlvbkJnQ29sb3IsXG59IGZyb20gJy4uL2hvb2tzL3VzZUNvcHlPblNlbGVjdC5qcydcbmltcG9ydCB0eXBlIHsgU2Nyb2xsQm94SGFuZGxlIH0gZnJvbSAnLi4vaW5rL2NvbXBvbmVudHMvU2Nyb2xsQm94LmpzJ1xuaW1wb3J0IHsgdXNlU2VsZWN0aW9uIH0gZnJvbSAnLi4vaW5rL2hvb2tzL3VzZS1zZWxlY3Rpb24uanMnXG5pbXBvcnQgdHlwZSB7IEZvY3VzTW92ZSwgU2VsZWN0aW9uU3RhdGUgfSBmcm9tICcuLi9pbmsvc2VsZWN0aW9uLmpzJ1xuaW1wb3J0IHsgaXNYdGVybUpzIH0gZnJvbSAnLi4vaW5rL3Rlcm1pbmFsLmpzJ1xuaW1wb3J0IHsgZ2V0Q2xpcGJvYXJkUGF0aCB9IGZyb20gJy4uL2luay90ZXJtaW8vb3NjLmpzJ1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9wcmVmZXItdXNlLWtleWJpbmRpbmdzIC0tIEVzYyBuZWVkcyBjb25kaXRpb25hbCBwcm9wYWdhdGlvbiBiYXNlZCBvbiBzZWxlY3Rpb24gc3RhdGVcbmltcG9ydCB7IHR5cGUgS2V5LCB1c2VJbnB1dCB9IGZyb20gJy4uL2luay5qcydcbmltcG9ydCB7IHVzZUtleWJpbmRpbmdzIH0gZnJvbSAnLi4va2V5YmluZGluZ3MvdXNlS2V5YmluZGluZy5qcydcbmltcG9ydCB7IGxvZ0ZvckRlYnVnZ2luZyB9IGZyb20gJy4uL3V0aWxzL2RlYnVnLmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICBzY3JvbGxSZWY6IFJlZk9iamVjdDxTY3JvbGxCb3hIYW5kbGUgfCBudWxsPlxuICBpc0FjdGl2ZTogYm9vbGVhblxuICAvKiogQ2FsbGVkIGFmdGVyIGV2ZXJ5IHNjcm9sbCBhY3Rpb24gd2l0aCB0aGUgcmVzdWx0aW5nIHN0aWNreSBzdGF0ZSBhbmRcbiAgICogIHRoZSBoYW5kbGUgKGZvciByZWFkaW5nIHNjcm9sbFRvcC9zY3JvbGxIZWlnaHQgcG9zdC1zY3JvbGwpLiAqL1xuICBvblNjcm9sbD86IChzdGlja3k6IGJvb2xlYW4sIGhhbmRsZTogU2Nyb2xsQm94SGFuZGxlKSA9PiB2b2lkXG4gIC8qKiBFbmFibGVzIG1vZGFsIHBhZ2VyIGtleXMgKGcvRywgY3RybCt1L2QvYi9mKS4gT25seSBzYWZlIHdoZW4gdGhlcmVcbiAgICogIGlzIG5vIHRleHQgaW5wdXQgY29tcGV0aW5nIGZvciB0aG9zZSBjaGFyYWN0ZXJzIOKAlCBpLmUuIHRyYW5zY3JpcHRcbiAgICogIG1vZGUuIERlZmF1bHRzIHRvIGZhbHNlLiBXaGVuIHRydWUsIEcgd29ya3MgcmVnYXJkbGVzcyBvZiBlZGl0b3JNb2RlXG4gICAqICBhbmQgc3RpY2t5IHN0YXRlOyBjdHJsK3UvZC9iL2YgZG9uJ3QgY29uZmxpY3Qgd2l0aCBraWxsLWxpbmUvZXhpdC9cbiAgICogIHRhc2s6YmFja2dyb3VuZC9raWxsLWFnZW50cyAobm9uZSBhcmUgbW91bnRlZCwgb3IgdGhleSBtb3VudCBhZnRlclxuICAgKiAgdGhpcyBjb21wb25lbnQgc28gc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIHdpbnMpLiAqL1xuICBpc01vZGFsPzogYm9vbGVhblxufVxuXG4vLyBUZXJtaW5hbHMgc2VuZCBvbmUgU0dSIHdoZWVsIGV2ZW50IHBlciBpbnRlbmRlZCByb3cgKHZlcmlmaWVkIGluIEdob3N0dHlcbi8vIHNyYy9TdXJmYWNlLnppZzogYGZvciAoMC4uQGFicyh5LmRlbHRhKSkgfF98IHsgbW91c2VSZXBvcnQoLmZvdXIsIC4uLikgfWApLlxuLy8gR2hvc3R0eSBhbHJlYWR5IDPDlydzIGRpc2NyZXRlIHdoZWVsIHRpY2tzIGJlZm9yZSB0aGF0IGxvb3A7IHRyYWNrcGFkXG4vLyBwcmVjaXNpb24gc2Nyb2xsIGlzIHBpeGVscy9jZWxsX3NpemUuIDEgZXZlbnQgPSAxIHJvdyBpbnRlbmRlZCDigJQgdXNlIGl0XG4vLyBhcyB0aGUgYmFzZSwgYW5kIHJhbXAgYSBtdWx0aXBsaWVyIHdoZW4gZXZlbnRzIGFycml2ZSByYXBpZGx5LiBUaGVcbi8vIHBlbmRpbmdTY3JvbGxEZWx0YSBhY2N1bXVsYXRvciArIHByb3BvcnRpb25hbCBkcmFpbiBpblxuLy8gcmVuZGVyLW5vZGUtdG8tb3V0cHV0IGhhbmRsZXMgc21vb3RoIGNhdGNoLXVwIG9uIGJpZyBidXJzdHMuXG4vL1xuLy8geHRlcm0uanMgKFZTIENvZGUvQ3Vyc29yL1dpbmRzdXJmIGludGVncmF0ZWQgdGVybWluYWxzKSBzZW5kcyBleGFjdGx5IDFcbi8vIGV2ZW50IHBlciB3aGVlbCBub3RjaCDigJQgbm8gcHJlLWFtcGxpZmljYXRpb24uIEEgc2VwYXJhdGUgZXhwb25lbnRpYWxcbi8vIGRlY2F5IGN1cnZlIChiZWxvdykgY29tcGVuc2F0ZXMgZm9yIHRoZSBsb3dlciBldmVudCByYXRlLCB3aXRoIGJ1cnN0XG4vLyBkZXRlY3Rpb24gYW5kIGdhcC1kZXBlbmRlbnQgY2FwcyB0dW5lZCB0byBWUyBDb2RlJ3MgZXZlbnQgcGF0dGVybnMuXG5cbi8vIE5hdGl2ZSB0ZXJtaW5hbHM6IGhhcmQtd2luZG93IGxpbmVhciByYW1wLiBFdmVudHMgY2xvc2VyIHRoYW4gdGhlIHdpbmRvd1xuLy8gcmFtcCB0aGUgbXVsdGlwbGllcjsgaWRsZSBnYXBzIHJlc2V0IHRvIGBiYXNlYCAoZGVmYXVsdCAxKS4gU29tZSBlbXVsYXRvcnNcbi8vIHByZS1tdWx0aXBseSBhdCB0aGVpciBsYXllciAoZ2hvc3R0eSBkaXNjcmV0ZT0zIHNlbmRzIDMgU0dSIGV2ZW50cy9ub3RjaDtcbi8vIGlUZXJtMiBcImZhc3RlciBzY3JvbGxcIiBzaW1pbGFyKSDigJQgYmFzZT0xIGlzIGNvcnJlY3QgdGhlcmUuIE90aGVycyBzZW5kIDFcbi8vIGV2ZW50L25vdGNoIOKAlCB1c2VycyBvbiB0aG9zZSBjYW4gc2V0IENMQVVERV9DT0RFX1NDUk9MTF9TUEVFRD0zIHRvIG1hdGNoXG4vLyB2aW0vbnZpbS9vcGVuY29kZSBhcHAtc2lkZSBkZWZhdWx0cy4gV2UgY2FuJ3QgZGV0ZWN0IHdoaWNoLCBzbyBrbm9iIGl0LlxuY29uc3QgV0hFRUxfQUNDRUxfV0lORE9XX01TID0gNDBcbmNvbnN0IFdIRUVMX0FDQ0VMX1NURVAgPSAwLjNcbmNvbnN0IFdIRUVMX0FDQ0VMX01BWCA9IDZcblxuLy8gRW5jb2RlciBib3VuY2UgZGVib3VuY2UgKyB3aGVlbC1tb2RlIGRlY2F5IGN1cnZlLiBXb3JuL2NoZWFwIG9wdGljYWxcbi8vIGVuY29kZXJzIGVtaXQgc3B1cmlvdXMgcmV2ZXJzZS1kaXJlY3Rpb24gdGlja3MgZHVyaW5nIGZhc3Qgc3BpbnMg4oCUIG1lYXN1cmVkXG4vLyAyOCUgb2YgZXZlbnRzIG9uIEJvcmlzJ3MgbW91c2UgKDIwMjYtMDMtMTcsIGlUZXJtMikuIFBhdHRlcm4gaXMgYWx3YXlzXG4vLyBmbGlwLXRoZW4tZmxpcC1iYWNrOyB0cmFja3BhZHMgcHJvZHVjZSBaRVJPIGZsaXBzICgwLzQ1OCBpbiBzYW1lIHJlY29yZGluZykuXG4vLyBBIGNvbmZpcm1lZCBib3VuY2UgcHJvdmVzIGEgcGh5c2ljYWwgd2hlZWwgaXMgYXR0YWNoZWQg4oCUIGVuZ2FnZSB0aGUgc2FtZVxuLy8gZXhwb25lbnRpYWwtZGVjYXkgY3VydmUgdGhlIHh0ZXJtLmpzIHBhdGggdXNlcyAoaXQncyBhbHJlYWR5IHR1bmVkKSwgd2l0aFxuLy8gYSBoaWdoZXIgY2FwIHRvIGNvbXBlbnNhdGUgZm9yIHRoZSBsb3dlciBldmVudCByYXRlICh+OS9zZWMgdnMgVlMgQ29kZSdzXG4vLyB+MzAvc2VjKS4gVHJhY2twYWQgY2FuJ3QgcmVhY2ggdGhpcyBwYXRoLlxuLy9cbi8vIFRoZSBkZWNheSBjdXJ2ZSBnaXZlczogMXN0IGNsaWNrIGFmdGVyIGlkbGUgPSAxIHJvdyAocHJlY2lzaW9uKSwgMm5kID0gMTAsXG4vLyAzcmQgPSBjYXAuIFNsb3dpbmcgZG93biBkZWNheXMgc21vb3RobHkgdG93YXJkIDEg4oCUIG5vIHNlcGFyYXRlIGlkbGVcbi8vIHRocmVzaG9sZCBuZWVkZWQsIGxhcmdlIGdhcHMganVzdCBoYXZlIG3iiYgwIOKGkiBtdWx04oaSMS4gV2hlZWwgbW9kZSBpcyBTVElDS1k6XG4vLyBvbmNlIGEgYm91bmNlIGNvbmZpcm1zIGl0J3MgYSBtb3VzZSwgdGhlIGRlY2F5IGN1cnZlIGFwcGxpZXMgdW50aWwgYW4gaWRsZVxuLy8gZ2FwIG9yIHRyYWNrcGFkLWZsaWNrLWJ1cnN0IHNpZ25hbHMgYSBwb3NzaWJsZSBkZXZpY2Ugc3dpdGNoLlxuY29uc3QgV0hFRUxfQk9VTkNFX0dBUF9NQVhfTVMgPSAyMDAgLy8gZmxpcC1iYWNrIG11c3QgYXJyaXZlIHdpdGhpbiB0aGlzXG4vLyBNb3VzZSBpcyB+OSBldmVudHMvc2VjIHZzIFZTIENvZGUncyB+MzAg4oCUIFNURVAgaXMgM8OXIHh0ZXJtLmpzJ3MgNSB0b1xuLy8gY29tcGVuc2F0ZS4gQXQgZ2FwPTEwMG1zICht4omIMC42Myk6IG9uZSBjbGljayBnaXZlcyAxKzE1KjAuNjPiiYgxMC41LlxuY29uc3QgV0hFRUxfTU9ERV9TVEVQID0gMTVcbmNvbnN0IFdIRUVMX01PREVfQ0FQID0gMTVcbi8vIE1heCBtdWx0IGdyb3d0aCBwZXIgZXZlbnQuIFdpdGhvdXQgdGhpcywgdGhlICtTVEVQKm0gdGVybSBqdW1wcyBtdWx0XG4vLyBmcm9tIDHihpIxMCBpbiBvbmUgZXZlbnQgd2hlbiB3aGVlbE1vZGUgZW5nYWdlcyBtaWQtc2Nyb2xsIChib3VuY2Vcbi8vIGRldGVjdGVkIGFmdGVyIE4gZXZlbnRzIGluIHRyYWNrcGFkIG1vZGUgYXQgbXVsdD0xKS4gVXNlciBzZWVzIHNjcm9sbFxuLy8gc3VkZGVubHkgZ28gMTDDlyBmYXN0ZXIuIENhcD0zIGdpdmVzIDHihpI04oaSN+KGkjEw4oaSMTPihpIxNSBvdmVyIH4wLjVzIGF0XG4vLyA5IGV2ZW50cy9zZWMg4oCUIHNtb290aCByYW1wIGluc3RlYWQgb2YgYSBqdW1wLiBEZWNheSBpcyB1bmFmZmVjdGVkXG4vLyAodGFyZ2V0PG11bHQgd2lucyB0aGUgbWluKS5cbmNvbnN0IFdIRUVMX01PREVfUkFNUCA9IDNcbi8vIERldmljZS1zd2l0Y2ggZGlzZW5nYWdlOiBtb3VzZSBmaW5nZXItcmVwb3NpdGlvbnMgbWF4IGF0IH44MzBtcyAobWVhc3VyZWQpO1xuLy8gdHJhY2twYWQgYmV0d2Vlbi1nZXN0dXJlIHBhdXNlcyBhcmUgMjAwMG1zKy4gQW4gaWRsZSBnYXAgYWJvdmUgdGhpcyBtZWFuc1xuLy8gdGhlIHVzZXIgc3RvcHBlZCDigJQgbWlnaHQgaGF2ZSBzd2l0Y2hlZCBkZXZpY2VzLiBEaXNlbmdhZ2U7IHRoZSBuZXh0IG1vdXNlXG4vLyBib3VuY2UgcmUtZW5nYWdlcy4gVHJhY2twYWQgc2xvdyBzd2lwZSAobm8gPDVtcyBidXJzdHMsIHNvIHRoZSBidXJzdC1jb3VudFxuLy8gZ3VhcmQgZG9lc24ndCBjYXRjaCBpdCkgaXMgd2hhdCB0aGlzIHByb3RlY3RzIGFnYWluc3QuXG5jb25zdCBXSEVFTF9NT0RFX0lETEVfRElTRU5HQUdFX01TID0gMTUwMFxuXG4vLyB4dGVybS5qczogZXhwb25lbnRpYWwgZGVjYXkuIG1vbWVudHVtPTAuNV4oZ2FwL2hsKSDigJQgc2xvdyBjbGljayDihpIgbeKJiDBcbi8vIOKGkiBtdWx04oaSMSAocHJlY2lzaW9uKTsgZmFzdCDihpIgbeKJiDEg4oaSIGNhcnJpZXMgbW9tZW50dW0uIFN0ZWFkeS1zdGF0ZVxuLy8gPSAxICsgc3RlcMOXbS8oMS1tKSwgY2FwcGVkLiBNZWFzdXJlZCBldmVudCByYXRlcyBpbiBWUyBDb2RlICh3aGVlbC5sb2cpOlxuLy8gc3VzdGFpbmVkIHNjcm9sbCBzZW5kcyBldmVudHMgYXQgMjAtNTBtcyBnYXBzICgyMC00MCBIeiksIHBsdXMgMC0ybXNcbi8vIHNhbWUtYmF0Y2ggYnVyc3RzIG9uIGZsaWNrcy4gQ2FwIGlzIGxvdyAoM+KAkzYsIGdhcC1kZXBlbmRlbnQpIGJlY2F1c2UgZXZlbnRcbi8vIGZyZXF1ZW5jeSBpcyBoaWdoIOKAlCBhdCA0MCBIeiDDlyA2ID0gMjQwIHJvd3Mvc2VjIG1heCBkZW1hbmQsIHdoaWNoIHRoZVxuLy8gYWRhcHRpdmUgZHJhaW4gYXQgfjIwMGZwcyAobWVhc3VyZWQpIGhhbmRsZXMuIEhpZ2hlciBjYXAg4oaSIHBlbmRpbmcgZXhwbG9zaW9uLlxuLy8gVHVuZWQgZW1waXJpY2FsbHkgKGJvcmlzIDIwMjYtMDMpLiBTZWUgZG9jcy9yZXNlYXJjaC90ZXJtaW5hbC1zY3JvbGwtKi5cbmNvbnN0IFdIRUVMX0RFQ0FZX0hBTEZMSUZFX01TID0gMTUwXG5jb25zdCBXSEVFTF9ERUNBWV9TVEVQID0gNVxuLy8gU2FtZS1iYXRjaCBldmVudHMgKDxCVVJTVF9NUykgYXJyaXZlIGluIG9uZSBzdGRpbiBiYXRjaCDigJQgdGhlIHRlcm1pbmFsXG4vLyBpcyBkb2luZyBwcm9wb3J0aW9uYWwgcmVwb3J0aW5nLiBUcmVhdCBhcyAxIHJvdy9ldmVudCBsaWtlIG5hdGl2ZS5cbmNvbnN0IFdIRUVMX0JVUlNUX01TID0gNVxuLy8gQ2FwIGJvdW5kYXJ5OiBzbG93IGV2ZW50cyAo4omlR0FQX01TKSBjYXAgbG93IGZvciBzaG9ydCBzbW9vdGggZHJhaW5zO1xuLy8gZmFzdCBldmVudHMgY2FwIGhpZ2hlciBmb3IgdGhyb3VnaHB1dCAoYWRhcHRpdmUgZHJhaW4gaGFuZGxlcyBiYWNrbG9nKS5cbmNvbnN0IFdIRUVMX0RFQ0FZX0dBUF9NUyA9IDgwXG5jb25zdCBXSEVFTF9ERUNBWV9DQVBfU0xPVyA9IDMgLy8gZ2FwIOKJpSBHQVBfTVM6IHByZWNpc2lvblxuY29uc3QgV0hFRUxfREVDQVlfQ0FQX0ZBU1QgPSA2IC8vIGdhcCA8IEdBUF9NUzogdGhyb3VnaHB1dFxuLy8gSWRsZSB0aHJlc2hvbGQ6IGdhcHMgYmV5b25kIHRoaXMgcmVzZXQgdG8gdGhlIGtpY2sgdmFsdWUgKDIpIHNvIHRoZVxuLy8gZmlyc3QgY2xpY2sgYWZ0ZXIgYSBwYXVzZSBmZWVscyByZXNwb25zaXZlIHJlZ2FyZGxlc3Mgb2YgZGlyZWN0aW9uLlxuY29uc3QgV0hFRUxfREVDQVlfSURMRV9NUyA9IDUwMFxuXG4vKipcbiAqIFdoZXRoZXIgYSBrZXlwcmVzcyBzaG91bGQgY2xlYXIgdGhlIHZpcnR1YWwgdGV4dCBzZWxlY3Rpb24uIE1pbWljc1xuICogbmF0aXZlIHRlcm1pbmFsIHNlbGVjdGlvbjogYW55IGtleXN0cm9rZSBjbGVhcnMsIEVYQ0VQVCBtb2RpZmllZCBuYXZcbiAqIGtleXMgKHNoaWZ0L29wdC9jbWQgKyBhcnJvdy9ob21lL2VuZC9wYWdlKikuIEluIG5hdGl2ZSBtYWNPUyBjb250ZXh0cyxcbiAqIHNoaWZ0K25hdiBleHRlbmRzIHNlbGVjdGlvbiwgYW5kIGNtZC9vcHQrbmF2IGFyZSBvZnRlbiBpbnRlcmNlcHRlZCBieVxuICogdGhlIHRlcm1pbmFsIGVtdWxhdG9yIGZvciBzY3JvbGxiYWNrIG5hdiDigJQgbmVpdGhlciBkaXN0dXJicyBzZWxlY3Rpb24uXG4gKiBCYXJlIGFycm93cyBETyBjbGVhciAodXNlcidzIGN1cnNvciBtb3ZlcywgbmF0aXZlIGRlc2VsZWN0cykuIFdoZWVsIGlzXG4gKiBleGNsdWRlZCDigJQgc2Nyb2xsOmxpbmVVcC9Eb3duIGFscmVhZHkgY2xlYXJzIHZpYSB0aGUga2V5YmluZGluZyBwYXRoLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkQ2xlYXJTZWxlY3Rpb25PbktleShrZXk6IEtleSk6IGJvb2xlYW4ge1xuICBpZiAoa2V5LndoZWVsVXAgfHwga2V5LndoZWVsRG93bikgcmV0dXJuIGZhbHNlXG4gIGNvbnN0IGlzTmF2ID1cbiAgICBrZXkubGVmdEFycm93IHx8XG4gICAga2V5LnJpZ2h0QXJyb3cgfHxcbiAgICBrZXkudXBBcnJvdyB8fFxuICAgIGtleS5kb3duQXJyb3cgfHxcbiAgICBrZXkuaG9tZSB8fFxuICAgIGtleS5lbmQgfHxcbiAgICBrZXkucGFnZVVwIHx8XG4gICAga2V5LnBhZ2VEb3duXG4gIGlmIChpc05hdiAmJiAoa2V5LnNoaWZ0IHx8IGtleS5tZXRhIHx8IGtleS5zdXBlcikpIHJldHVybiBmYWxzZVxuICByZXR1cm4gdHJ1ZVxufVxuXG4vKipcbiAqIE1hcCBhIGtleXByZXNzIHRvIGEgc2VsZWN0aW9uIGZvY3VzIG1vdmUgKGtleWJvYXJkIGV4dGVuc2lvbikuIE9ubHlcbiAqIHNoaWZ0IGV4dGVuZHMg4oCUIHRoYXQncyB0aGUgdW5pdmVyc2FsIHRleHQtc2VsZWN0aW9uIG1vZGlmaWVyLiBjbWRcbiAqIChzdXBlcikgb25seSBhcnJpdmVzIHZpYSBraXR0eSBrZXlib2FyZCBwcm90b2NvbCDigJQgaW4gbW9zdCB0ZXJtaW5hbHNcbiAqIGNtZCthcnJvdyBpcyBpbnRlcmNlcHRlZCBieSB0aGUgZW11bGF0b3IgYW5kIG5ldmVyIHJlYWNoZXMgdGhlIHB0eSwgc29cbiAqIG5vIHN1cGVyIGJyYW5jaC4gc2hpZnQraG9tZS9lbmQgY292ZXJzIGxpbmUtZWRnZSBqdW1wcyAoYW5kIGZuK3NoaWZ0K1xuICogbGVmdC9yaWdodCBvbiBtYWMgbGFwdG9wcyA9IHNoaWZ0K2hvbWUvZW5kKS4gc2hpZnQrb3B0ICh3b3JkLWp1bXApIG5vdFxuICogeWV0IGltcGxlbWVudGVkIOKAlCBmYWxscyB0aHJvdWdoIHRvIHNob3VsZENsZWFyU2VsZWN0aW9uT25LZXkgd2hpY2hcbiAqIHByZXNlcnZlcyAobW9kaWZpZWQgbmF2KS4gUmV0dXJucyBudWxsIGZvciBub24tZXh0ZW5kIGtleXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZWxlY3Rpb25Gb2N1c01vdmVGb3JLZXkoa2V5OiBLZXkpOiBGb2N1c01vdmUgfCBudWxsIHtcbiAgaWYgKCFrZXkuc2hpZnQgfHwga2V5Lm1ldGEpIHJldHVybiBudWxsXG4gIGlmIChrZXkubGVmdEFycm93KSByZXR1cm4gJ2xlZnQnXG4gIGlmIChrZXkucmlnaHRBcnJvdykgcmV0dXJuICdyaWdodCdcbiAgaWYgKGtleS51cEFycm93KSByZXR1cm4gJ3VwJ1xuICBpZiAoa2V5LmRvd25BcnJvdykgcmV0dXJuICdkb3duJ1xuICBpZiAoa2V5LmhvbWUpIHJldHVybiAnbGluZVN0YXJ0J1xuICBpZiAoa2V5LmVuZCkgcmV0dXJuICdsaW5lRW5kJ1xuICByZXR1cm4gbnVsbFxufVxuXG5leHBvcnQgdHlwZSBXaGVlbEFjY2VsU3RhdGUgPSB7XG4gIHRpbWU6IG51bWJlclxuICBtdWx0OiBudW1iZXJcbiAgZGlyOiAwIHwgMSB8IC0xXG4gIHh0ZXJtSnM6IGJvb2xlYW5cbiAgLyoqIENhcnJpZWQgZnJhY3Rpb25hbCBzY3JvbGwgKHh0ZXJtLmpzIG9ubHkpLiBzY3JvbGxCeSBmbG9vcnMsIHNvIHdpdGhvdXRcbiAgICogIHRoaXMgYSBtdWx0IG9mIDEuNSBnaXZlcyAxIHJvdyBldmVyeSB0aW1lLiBDYXJyeWluZyB0aGUgcmVtYWluZGVyIGdpdmVzXG4gICAqICAxLDIsMSwyIG9uIGF2ZXJhZ2UgZm9yIG11bHQ9MS41IOKAlCBjb3JyZWN0IHRocm91Z2hwdXQgb3ZlciB0aW1lLiAqL1xuICBmcmFjOiBudW1iZXJcbiAgLyoqIE5hdGl2ZS1wYXRoIGJhc2VsaW5lIHJvd3MvZXZlbnQuIFJlc2V0IHZhbHVlIG9uIGlkbGUvcmV2ZXJzYWw7IHJhbXBcbiAgICogIGJ1aWxkcyBvbiB0b3AuIHh0ZXJtLmpzIHBhdGggaWdub3JlcyB0aGlzIChvd24ga2ljaz0yIHR1bmluZykuICovXG4gIGJhc2U6IG51bWJlclxuICAvKiogRGVmZXJyZWQgZGlyZWN0aW9uIGZsaXAgKG5hdGl2ZSBvbmx5KS4gTWlnaHQgYmUgZW5jb2RlciBib3VuY2Ugb3IgYVxuICAgKiAgcmVhbCByZXZlcnNhbCDigJQgcmVzb2x2ZWQgYnkgdGhlIE5FWFQgZXZlbnQuIFJlYWwgcmV2ZXJzYWwgbG9zZXMgMSByb3dcbiAgICogIG9mIGxhdGVuY3k7IGJvdW5jZSBpcyBzd2FsbG93ZWQgYW5kIHRyaWdnZXJzIHdoZWVsIG1vZGUuIFRoZSBmbGlwJ3NcbiAgICogIGRpcmVjdGlvbiBhbmQgdGltZXN0YW1wIGFyZSBkZXJpdmFibGUgKGl0J3MgYWx3YXlzIC1zdGF0ZS5kaXIgYXRcbiAgICogIHN0YXRlLnRpbWUpIHNvIHRoaXMgaXMganVzdCBhIG1hcmtlci4gKi9cbiAgcGVuZGluZ0ZsaXA6IGJvb2xlYW5cbiAgLyoqIFNldCB0cnVlIG9uY2UgYSBib3VuY2UgaXMgY29uZmlybWVkIChmbGlwLXRoZW4tZmxpcC1iYWNrIHdpdGhpblxuICAgKiAgQk9VTkNFX0dBUF9NQVgpLiBTdGlja3kg4oCUIGJ1dCBkaXNlbmdhZ2VkIG9uIGlkbGUgZ2FwID4xNTAwbXMgT1IgYVxuICAgKiAgdHJhY2twYWQtc2lnbmF0dXJlIGJ1cnN0IChzZWUgYnVyc3RDb3VudCkuIFN0YXRlIGxpdmVzIGluIGEgdXNlUmVmIHNvXG4gICAqICBpdCBwZXJzaXN0cyBhY3Jvc3MgZGV2aWNlIHN3aXRjaGVzOyB0aGUgZGlzZW5nYWdlcyBoYW5kbGUgbW91c2XihpJ0cmFja3BhZC4gKi9cbiAgd2hlZWxNb2RlOiBib29sZWFuXG4gIC8qKiBDb25zZWN1dGl2ZSA8NW1zIGV2ZW50cy4gVHJhY2twYWQgZmxpY2sgcHJvZHVjZXMgMTAwKyBhdCA8NW1zOyBtb3VzZVxuICAgKiAgcHJvZHVjZXMg4omkMyAodmVyaWZpZWQgaW4gL3RtcC93aGVlbC10dW5lLnR4dCkuIDUrIGluIGEgcm93IOKGkiB0cmFja3BhZFxuICAgKiAgc2lnbmF0dXJlIOKGkiBkaXNlbmdhZ2Ugd2hlZWwgbW9kZSBzbyBkZXZpY2Utc3dpdGNoIGRvZXNuJ3QgbGVhayBtb3VzZVxuICAgKiAgYWNjZWwgdG8gdHJhY2twYWQuICovXG4gIGJ1cnN0Q291bnQ6IG51bWJlclxufVxuXG4vKiogQ29tcHV0ZSByb3dzIGZvciBvbmUgd2hlZWwgZXZlbnQsIG11dGF0aW5nIGFjY2VsIHN0YXRlLiBSZXR1cm5zIDAgd2hlblxuICogIGEgZGlyZWN0aW9uIGZsaXAgaXMgZGVmZXJyZWQgZm9yIGJvdW5jZSBkZXRlY3Rpb24g4oCUIGNhbGwgc2l0ZXMgbm8tb3Agb25cbiAqICBzdGVwPTAgKHNjcm9sbEJ5KDApIGlzIGEgbm8tb3AsIG9uU2Nyb2xsKGZhbHNlKSBpcyBpZGVtcG90ZW50KS4gRXhwb3J0ZWRcbiAqICBmb3IgdGVzdHMuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcHV0ZVdoZWVsU3RlcChcbiAgc3RhdGU6IFdoZWVsQWNjZWxTdGF0ZSxcbiAgZGlyOiAxIHwgLTEsXG4gIG5vdzogbnVtYmVyLFxuKTogbnVtYmVyIHtcbiAgaWYgKCFzdGF0ZS54dGVybUpzKSB7XG4gICAgLy8gRGV2aWNlLXN3aXRjaCBndWFyZCDikaA6IGlkbGUgZGlzZW5nYWdlLiBSdW5zIEJFRk9SRSBwZW5kaW5nRmxpcCByZXNvbHZlXG4gICAgLy8gc28gYSBwZW5kaW5nIGJvdW5jZSAoMjglIG9mIGxhc3QtbW91c2UtZXZlbnRzKSBkb2Vzbid0IGJ5cGFzcyBpdCB2aWFcbiAgICAvLyB0aGUgcmVhbC1yZXZlcnNhbCBlYXJseSByZXR1cm4uIHN0YXRlLnRpbWUgaXMgZWl0aGVyIHRoZSBsYXN0IGNvbW1pdHRlZFxuICAgIC8vIGV2ZW50IE9SIHRoZSBkZWZlcnJlZCBmbGlwIOKAlCBib3RoIGNvdW50IGFzIFwibGFzdCBhY3Rpdml0eVwiLlxuICAgIGlmIChzdGF0ZS53aGVlbE1vZGUgJiYgbm93IC0gc3RhdGUudGltZSA+IFdIRUVMX01PREVfSURMRV9ESVNFTkdBR0VfTVMpIHtcbiAgICAgIHN0YXRlLndoZWVsTW9kZSA9IGZhbHNlXG4gICAgICBzdGF0ZS5idXJzdENvdW50ID0gMFxuICAgICAgc3RhdGUubXVsdCA9IHN0YXRlLmJhc2VcbiAgICB9XG5cbiAgICAvLyBSZXNvbHZlIGFueSBkZWZlcnJlZCBmbGlwIEJFRk9SRSB0b3VjaGluZyBzdGF0ZS50aW1lL2RpciDigJQgd2UgbmVlZCB0aGVcbiAgICAvLyBwcmUtZmxpcCBzdGF0ZS5kaXIgdG8gZGlzdGluZ3Vpc2ggYm91bmNlIChmbGlwLWJhY2spIGZyb20gcmVhbCByZXZlcnNhbFxuICAgIC8vIChmbGlwIHBlcnNpc3RlZCksIGFuZCBzdGF0ZS50aW1lICg9IGJvdW5jZSB0aW1lc3RhbXApIGZvciB0aGUgZ2FwIGNoZWNrLlxuICAgIGlmIChzdGF0ZS5wZW5kaW5nRmxpcCkge1xuICAgICAgc3RhdGUucGVuZGluZ0ZsaXAgPSBmYWxzZVxuICAgICAgaWYgKGRpciAhPT0gc3RhdGUuZGlyIHx8IG5vdyAtIHN0YXRlLnRpbWUgPiBXSEVFTF9CT1VOQ0VfR0FQX01BWF9NUykge1xuICAgICAgICAvLyBSZWFsIHJldmVyc2FsOiBuZXcgZGlyIHBlcnNpc3RlZCwgT1IgZmxpcC1iYWNrIGFycml2ZWQgdG9vIGxhdGUuXG4gICAgICAgIC8vIENvbW1pdC4gVGhlIGRlZmVycmVkIGV2ZW50J3MgMSByb3cgaXMgbG9zdCAoYWNjZXB0YWJsZSBsYXRlbmN5KS5cbiAgICAgICAgc3RhdGUuZGlyID0gZGlyXG4gICAgICAgIHN0YXRlLnRpbWUgPSBub3dcbiAgICAgICAgc3RhdGUubXVsdCA9IHN0YXRlLmJhc2VcbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3Ioc3RhdGUubXVsdClcbiAgICAgIH1cbiAgICAgIC8vIEJvdW5jZSBjb25maXJtZWQ6IGZsaXBwZWQgYmFjayB0byBvcmlnaW5hbCBkaXIgd2l0aGluIHRoZSB3aW5kb3cuXG4gICAgICAvLyBzdGF0ZS5kaXIvbXVsdCB1bmNoYW5nZWQgZnJvbSBwcmUtYm91bmNlLiBzdGF0ZS50aW1lIHdhcyBhZHZhbmNlZCB0b1xuICAgICAgLy8gdGhlIGJvdW5jZSBiZWxvdywgc28gZ2FwIGhlcmUgPSBmbGlwLWJhY2sgaW50ZXJ2YWwg4oCUIHJlZmxlY3RzIHRoZVxuICAgICAgLy8gdXNlcidzIGFjdHVhbCBjbGljayBjYWRlbmNlIChib3VuY2UgSVMgYSBwaHlzaWNhbCBjbGljaywganVzdCBub2lzeSkuXG4gICAgICBzdGF0ZS53aGVlbE1vZGUgPSB0cnVlXG4gICAgfVxuXG4gICAgY29uc3QgZ2FwID0gbm93IC0gc3RhdGUudGltZVxuICAgIGlmIChkaXIgIT09IHN0YXRlLmRpciAmJiBzdGF0ZS5kaXIgIT09IDApIHtcbiAgICAgIC8vIEZsaXAuIERlZmVyIOKAlCBuZXh0IGV2ZW50IGRlY2lkZXMgYm91bmNlIHZzLiByZWFsIHJldmVyc2FsLiBBZHZhbmNlXG4gICAgICAvLyB0aW1lIChidXQgTk9UIGRpci9tdWx0KTogaWYgdGhpcyB0dXJucyBvdXQgdG8gYmUgYSBib3VuY2UsIHRoZVxuICAgICAgLy8gY29uZmlybSBldmVudCdzIGdhcCB3aWxsIGJlIHRoZSBmbGlwLWJhY2sgaW50ZXJ2YWwsIHdoaWNoIHJlZmxlY3RzXG4gICAgICAvLyB0aGUgdXNlcidzIGFjdHVhbCBjbGljayByYXRlLiBUaGUgYm91bmNlIElTIGEgcGh5c2ljYWwgd2hlZWwgY2xpY2ssXG4gICAgICAvLyBqdXN0IG1pc3JlYWQgYnkgdGhlIGVuY29kZXIg4oCUIGl0IHNob3VsZCBjb3VudCB0b3dhcmQgY2FkZW5jZS5cbiAgICAgIHN0YXRlLnBlbmRpbmdGbGlwID0gdHJ1ZVxuICAgICAgc3RhdGUudGltZSA9IG5vd1xuICAgICAgcmV0dXJuIDBcbiAgICB9XG4gICAgc3RhdGUuZGlyID0gZGlyXG4gICAgc3RhdGUudGltZSA9IG5vd1xuXG4gICAgLy8g4pSA4pSA4pSAIE1PVVNFICh3aGVlbCBtb2RlLCBzdGlja3kgdW50aWwgZGV2aWNlLXN3aXRjaCBzaWduYWwpIOKUgOKUgOKUgFxuICAgIGlmIChzdGF0ZS53aGVlbE1vZGUpIHtcbiAgICAgIGlmIChnYXAgPCBXSEVFTF9CVVJTVF9NUykge1xuICAgICAgICAvLyBTYW1lLWJhdGNoIGJ1cnN0IGNoZWNrIChwb3J0ZWQgZnJvbSB4dGVybS5qcyk6IGlUZXJtMiBwcm9wb3J0aW9uYWxcbiAgICAgICAgLy8gcmVwb3J0aW5nIHNlbmRzIDIrIFNHUiBldmVudHMgZm9yIG9uZSBkZXRlbnQgd2hlbiBtYWNPUyBnaXZlc1xuICAgICAgICAvLyBkZWx0YT4xLiBXaXRob3V0IHRoaXMsIHRoZSAybmQgZXZlbnQgYXQgZ2FwPDFtcyBoYXMgbeKJiDEg4oaSIFNURVAqbT0xNVxuICAgICAgICAvLyDihpIgb25lIGdlbnRsZSBjbGljayBnaXZlcyAxKzE1PTE2IHJvd3MuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIERldmljZS1zd2l0Y2ggZ3VhcmQg4pGhOiB0cmFja3BhZCBmbGljayBwcm9kdWNlcyAxMDArIGV2ZW50cyBhdCA8NW1zXG4gICAgICAgIC8vIChtZWFzdXJlZCk7IG1vdXNlIHByb2R1Y2VzIOKJpDMuIDUrIGNvbnNlY3V0aXZlIOKGkiB0cmFja3BhZCBmbGljay5cbiAgICAgICAgaWYgKCsrc3RhdGUuYnVyc3RDb3VudCA+PSA1KSB7XG4gICAgICAgICAgc3RhdGUud2hlZWxNb2RlID0gZmFsc2VcbiAgICAgICAgICBzdGF0ZS5idXJzdENvdW50ID0gMFxuICAgICAgICAgIHN0YXRlLm11bHQgPSBzdGF0ZS5iYXNlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIDFcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdGUuYnVyc3RDb3VudCA9IDBcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gUmUtY2hlY2s6IG1heSBoYXZlIGRpc2VuZ2FnZWQgYWJvdmUuXG4gICAgaWYgKHN0YXRlLndoZWVsTW9kZSkge1xuICAgICAgLy8geHRlcm0uanMgZGVjYXkgY3VydmUgd2l0aCBTVEVQw5czLCBoaWdoZXIgY2FwLiBObyBpZGxlIHRocmVzaG9sZCDigJRcbiAgICAgIC8vIHRoZSBjdXJ2ZSBoYW5kbGVzIGl0IChnYXA9MTAwMG1zIOKGkiBt4omIMC4wMSDihpIgbXVsdOKJiDEpLiBObyBmcmFjIOKAlFxuICAgICAgLy8gcm91bmRpbmcgbG9zcyBpcyBtaW5vciBhdCBoaWdoIG11bHQsIGFuZCBmcmFjIHBlcnNpc3RpbmcgYWNyb3NzIGlkbGVcbiAgICAgIC8vIHdhcyBjYXVzaW5nIG9mZi1ieS1vbmUgb24gdGhlIGZpcnN0IGNsaWNrIGJhY2suXG4gICAgICBjb25zdCBtID0gTWF0aC5wb3coMC41LCBnYXAgLyBXSEVFTF9ERUNBWV9IQUxGTElGRV9NUylcbiAgICAgIGNvbnN0IGNhcCA9IE1hdGgubWF4KFdIRUVMX01PREVfQ0FQLCBzdGF0ZS5iYXNlICogMilcbiAgICAgIGNvbnN0IG5leHQgPSAxICsgKHN0YXRlLm11bHQgLSAxKSAqIG0gKyBXSEVFTF9NT0RFX1NURVAgKiBtXG4gICAgICBzdGF0ZS5tdWx0ID0gTWF0aC5taW4oY2FwLCBuZXh0LCBzdGF0ZS5tdWx0ICsgV0hFRUxfTU9ERV9SQU1QKVxuICAgICAgcmV0dXJuIE1hdGguZmxvb3Ioc3RhdGUubXVsdClcbiAgICB9XG5cbiAgICAvLyDilIDilIDilIAgVFJBQ0tQQUQgLyBISS1SRVMgKG5hdGl2ZSwgbm9uLXdoZWVsLW1vZGUpIOKUgOKUgOKUgFxuICAgIC8vIFRpZ2h0IDQwbXMgYnVyc3Qgd2luZG93OiBzdWItNDBtcyBldmVudHMgcmFtcCwgYW55dGhpbmcgc2xvd2VyIHJlc2V0cy5cbiAgICAvLyBUcmFja3BhZCBmbGljayBkZWxpdmVycyAyMDArIGV2ZW50cyBhdCA8MjBtcyBnYXBzIOKGkiByYWlscyB0byBjYXAgNi5cbiAgICAvLyBUcmFja3BhZCBzbG93IHN3aXBlIGF0IDQwLTQwMG1zIGdhcHMg4oaSIHJlc2V0cyBldmVyeSBldmVudCDihpIgMSByb3cgZWFjaC5cbiAgICBpZiAoZ2FwID4gV0hFRUxfQUNDRUxfV0lORE9XX01TKSB7XG4gICAgICBzdGF0ZS5tdWx0ID0gc3RhdGUuYmFzZVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBjYXAgPSBNYXRoLm1heChXSEVFTF9BQ0NFTF9NQVgsIHN0YXRlLmJhc2UgKiAyKVxuICAgICAgc3RhdGUubXVsdCA9IE1hdGgubWluKGNhcCwgc3RhdGUubXVsdCArIFdIRUVMX0FDQ0VMX1NURVApXG4gICAgfVxuICAgIHJldHVybiBNYXRoLmZsb29yKHN0YXRlLm11bHQpXG4gIH1cblxuICAvLyDilIDilIDilIAgVlNDT0RFICh4dGVybS5qcywgYnJvd3NlciB3aGVlbCBldmVudHMpIOKUgOKUgOKUgFxuICAvLyBCcm93c2VyIHdoZWVsIGV2ZW50cyDigJQgbm8gZW5jb2RlciBib3VuY2UsIG5vIFNHUiBidXJzdHMuIERlY2F5IGN1cnZlXG4gIC8vIHVuY2hhbmdlZCBmcm9tIHRoZSBvcmlnaW5hbCB0dW5pbmcuIFNhbWUgZm9ybXVsYSBzaGFwZSBhcyB3aGVlbCBtb2RlXG4gIC8vIGFib3ZlIChrZWVwIGluIHN5bmMpIGJ1dCBTVEVQPTUgbm90IDE1IOKAlCBoaWdoZXIgZXZlbnQgcmF0ZSBoZXJlLlxuICBjb25zdCBnYXAgPSBub3cgLSBzdGF0ZS50aW1lXG4gIGNvbnN0IHNhbWVEaXIgPSBkaXIgPT09IHN0YXRlLmRpclxuICBzdGF0ZS50aW1lID0gbm93XG4gIHN0YXRlLmRpciA9IGRpclxuICAvLyB4dGVybS5qcyBwYXRoLiBEZWJ1ZyBsb2cgc2hvd3MgdHdvIHBhdHRlcm5zOiAoYSkgMjAtNTBtcyBnYXBzIGR1cmluZ1xuICAvLyBzdXN0YWluZWQgc2Nyb2xsICh+MzAgSHopLCAoYikgPDVtcyBzYW1lLWJhdGNoIGJ1cnN0cyBvbiBmbGlja3MuIEZvclxuICAvLyAoYikgZ2l2ZSAxIHJvdy9ldmVudCDigJQgdGhlIGJ1cnN0IGNvdW50IElTIHRoZSBhY2NlbGVyYXRpb24sIHNhbWUgYXNcbiAgLy8gbmF0aXZlLiBGb3IgKGEpIHRoZSBkZWNheSBjdXJ2ZSBnaXZlcyAzLTUgcm93cy4gRm9yIHNwYXJzZSBldmVudHNcbiAgLy8gKDEwMG1zKywgc2xvdyBkZWxpYmVyYXRlIHNjcm9sbCkgdGhlIGN1cnZlIGdpdmVzIDEtMy5cbiAgaWYgKHNhbWVEaXIgJiYgZ2FwIDwgV0hFRUxfQlVSU1RfTVMpIHJldHVybiAxXG4gIGlmICghc2FtZURpciB8fCBnYXAgPiBXSEVFTF9ERUNBWV9JRExFX01TKSB7XG4gICAgLy8gRGlyZWN0aW9uIHJldmVyc2FsIG9yIGxvbmcgaWRsZTogc3RhcnQgYXQgMiAobm90IDEpIHNvIHRoZSBmaXJzdFxuICAgIC8vIGNsaWNrIGFmdGVyIGEgcGF1c2UgbW92ZXMgYSB2aXNpYmxlIGFtb3VudC4gV2l0aG91dCB0aGlzLCBpZGxlLVxuICAgIC8vIHRoZW4tcmVzdW1lIGluIHRoZSBzYW1lIGRpcmVjdGlvbiBkZWNheXMgdG8gbXVsdOKJiDEgKDEgcm93KS5cbiAgICBzdGF0ZS5tdWx0ID0gMlxuICAgIHN0YXRlLmZyYWMgPSAwXG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbSA9IE1hdGgucG93KDAuNSwgZ2FwIC8gV0hFRUxfREVDQVlfSEFMRkxJRkVfTVMpXG4gICAgY29uc3QgY2FwID1cbiAgICAgIGdhcCA+PSBXSEVFTF9ERUNBWV9HQVBfTVMgPyBXSEVFTF9ERUNBWV9DQVBfU0xPVyA6IFdIRUVMX0RFQ0FZX0NBUF9GQVNUXG4gICAgc3RhdGUubXVsdCA9IE1hdGgubWluKGNhcCwgMSArIChzdGF0ZS5tdWx0IC0gMSkgKiBtICsgV0hFRUxfREVDQVlfU1RFUCAqIG0pXG4gIH1cbiAgY29uc3QgdG90YWwgPSBzdGF0ZS5tdWx0ICsgc3RhdGUuZnJhY1xuICBjb25zdCByb3dzID0gTWF0aC5mbG9vcih0b3RhbClcbiAgc3RhdGUuZnJhYyA9IHRvdGFsIC0gcm93c1xuICByZXR1cm4gcm93c1xufVxuXG4vKiogUmVhZCBDTEFVREVfQ09ERV9TQ1JPTExfU1BFRUQsIGRlZmF1bHQgMSwgY2xhbXAgKDAsIDIwXS5cbiAqICBTb21lIHRlcm1pbmFscyBwcmUtbXVsdGlwbHkgd2hlZWwgZXZlbnRzIChnaG9zdHR5IGRpc2NyZXRlPTMsIGlUZXJtMlxuICogIFwiZmFzdGVyIHNjcm9sbFwiKSDigJQgYmFzZT0xIGlzIGNvcnJlY3QgdGhlcmUuIE90aGVycyBzZW5kIDEgZXZlbnQvbm90Y2gg4oCUXG4gKiAgc2V0IENMQVVERV9DT0RFX1NDUk9MTF9TUEVFRD0zIHRvIG1hdGNoIHZpbS9udmltL29wZW5jb2RlLiBXZSBjYW4ndFxuICogIGRldGVjdCB3aGljaCBraW5kIG9mIHRlcm1pbmFsIHdlJ3JlIGluLCBoZW5jZSB0aGUga25vYi4gQ2FsbGVkIGxhemlseVxuICogIGZyb20gaW5pdEFuZExvZ1doZWVsQWNjZWwgc28gZ2xvYmFsU2V0dGluZ3MuZW52IGhhcyBsb2FkZWQuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZFNjcm9sbFNwZWVkQmFzZSgpOiBudW1iZXIge1xuICBjb25zdCByYXcgPSBwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9TQ1JPTExfU1BFRURcbiAgaWYgKCFyYXcpIHJldHVybiAxXG4gIGNvbnN0IG4gPSBwYXJzZUZsb2F0KHJhdylcbiAgcmV0dXJuIE51bWJlci5pc05hTihuKSB8fCBuIDw9IDAgPyAxIDogTWF0aC5taW4obiwgMjApXG59XG5cbi8qKiBJbml0aWFsIHdoZWVsIGFjY2VsIHN0YXRlLiB4dGVybUpzPXRydWUgc2VsZWN0cyB0aGUgZGVjYXkgY3VydmUuXG4gKiAgYmFzZSBpcyB0aGUgbmF0aXZlLXBhdGggYmFzZWxpbmUgcm93cy9ldmVudCAoZGVmYXVsdCAxKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbml0V2hlZWxBY2NlbCh4dGVybUpzID0gZmFsc2UsIGJhc2UgPSAxKTogV2hlZWxBY2NlbFN0YXRlIHtcbiAgcmV0dXJuIHtcbiAgICB0aW1lOiAwLFxuICAgIG11bHQ6IGJhc2UsXG4gICAgZGlyOiAwLFxuICAgIHh0ZXJtSnMsXG4gICAgZnJhYzogMCxcbiAgICBiYXNlLFxuICAgIHBlbmRpbmdGbGlwOiBmYWxzZSxcbiAgICB3aGVlbE1vZGU6IGZhbHNlLFxuICAgIGJ1cnN0Q291bnQ6IDAsXG4gIH1cbn1cblxuLy8gTGF6eS1pbml0IGhlbHBlci4gaXNYdGVybUpzKCkgY29tYmluZXMgdGhlIFRFUk1fUFJPR1JBTSBlbnYgY2hlY2sgKyBhc3luY1xuLy8gWFRWRVJTSU9OIHByb2JlIOKAlCB0aGUgcHJvYmUgbWF5IG5vdCBoYXZlIHJlc29sdmVkIGF0IHJlbmRlciB0aW1lLCBzbyB0aGlzXG4vLyBpcyBjYWxsZWQgb24gdGhlIGZpcnN0IHdoZWVsIGV2ZW50ICg+PjUwbXMgYWZ0ZXIgc3RhcnR1cCkgd2hlbiBpdCdzIHNldHRsZWQuXG4vLyBMb2dzIGRldGVjdGVkIG1vZGUgb25jZSBzbyAtLWRlYnVnIHVzZXJzIGNhbiB2ZXJpZnkgU1NIIGRldGVjdGlvbiB3b3JrZWQuXG4vLyBUaGUgcmVuZGVyZXIgYWxzbyBjYWxscyBpc1h0ZXJtSnNIb3N0KCkgKGluIHJlbmRlci1ub2RlLXRvLW91dHB1dCkgdG9cbi8vIHNlbGVjdCB0aGUgZHJhaW4gYWxnb3JpdGhtIOKAlCBubyBzdGF0ZSB0byBwYXNzIHRocm91Z2guXG5mdW5jdGlvbiBpbml0QW5kTG9nV2hlZWxBY2NlbCgpOiBXaGVlbEFjY2VsU3RhdGUge1xuICBjb25zdCB4dGVybUpzID0gaXNYdGVybUpzKClcbiAgY29uc3QgYmFzZSA9IHJlYWRTY3JvbGxTcGVlZEJhc2UoKVxuICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgYHdoZWVsIGFjY2VsOiAke3h0ZXJtSnMgPyAnZGVjYXkgKHh0ZXJtLmpzKScgOiAnd2luZG93IChuYXRpdmUpJ30gwrcgYmFzZT0ke2Jhc2V9IMK3IFRFUk1fUFJPR1JBTT0ke3Byb2Nlc3MuZW52LlRFUk1fUFJPR1JBTSA/PyAndW5zZXQnfWAsXG4gIClcbiAgcmV0dXJuIGluaXRXaGVlbEFjY2VsKHh0ZXJtSnMsIGJhc2UpXG59XG5cbi8vIERyYWctdG8tc2Nyb2xsOiB3aGVuIGRyYWdnaW5nIHBhc3QgdGhlIHZpZXdwb3J0IGVkZ2UsIHNjcm9sbCBieSB0aGlzIG1hbnlcbi8vIHJvd3MgZXZlcnkgQVVUT1NDUk9MTF9JTlRFUlZBTF9NUy4gTW9kZSAxMDAyIG1vdXNlIHRyYWNraW5nIG9ubHkgZmlyZXMgb25cbi8vIGNlbGwgY2hhbmdlLCBzbyBhIHRpbWVyIGlzIG5lZWRlZCB0byBjb250aW51ZSBzY3JvbGxpbmcgd2hpbGUgc3RhdGlvbmFyeS5cbmNvbnN0IEFVVE9TQ1JPTExfTElORVMgPSAyXG5jb25zdCBBVVRPU0NST0xMX0lOVEVSVkFMX01TID0gNTBcbi8vIEhhcmQgY2FwIG9uIGNvbnNlY3V0aXZlIGF1dG8tc2Nyb2xsIHRpY2tzLiBJZiB0aGUgcmVsZWFzZSBldmVudCBpcyBsb3N0XG4vLyAobW91c2UgcmVsZWFzZWQgb3V0c2lkZSB0ZXJtaW5hbCB3aW5kb3cg4oCUIHNvbWUgZW11bGF0b3JzIGRvbid0IGNhcHR1cmUgdGhlXG4vLyBwb2ludGVyIGFuZCBkcm9wIHRoZSByZWxlYXNlKSwgaXNEcmFnZ2luZyBzdGF5cyB0cnVlIGFuZCB0aGUgdGltZXIgd291bGRcbi8vIHJ1biB1bnRpbCBhIHNjcm9sbCBib3VuZGFyeS4gQ2FwIGJvdW5kcyB0aGUgZGFtYWdlOyBhbnkgbmV3IGRyYWcgbW90aW9uXG4vLyBldmVudCByZXN0YXJ0cyB0aGUgY291bnQgdmlhIGNoZWNrKCnihpJzdGFydCgpLlxuY29uc3QgQVVUT1NDUk9MTF9NQVhfVElDS1MgPSAyMDAgLy8gMTBzIEAgNTBtc1xuXG4vKipcbiAqIEtleWJvYXJkIHNjcm9sbCBuYXZpZ2F0aW9uIGZvciB0aGUgZnVsbHNjcmVlbiBsYXlvdXQncyBtZXNzYWdlIHNjcm9sbCBib3guXG4gKiBQZ1VwL1BnRG4gc2Nyb2xsIGJ5IGhhbGYtdmlld3BvcnQuIE1vdXNlIHdoZWVsIHNjcm9sbHMgYnkgYSBmZXcgbGluZXMuXG4gKiBTY3JvbGxpbmcgYnJlYWtzIHN0aWNreSBtb2RlOyBDdHJsK0VuZCByZS1lbmFibGVzIGl0LiBXaGVlbGluZyBkb3duIGF0XG4gKiB0aGUgYm90dG9tIGFsc28gcmUtZW5hYmxlcyBzdGlja3kgc28gbmV3IGNvbnRlbnQgZm9sbG93cyBuYXR1cmFsbHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBTY3JvbGxLZXliaW5kaW5nSGFuZGxlcih7XG4gIHNjcm9sbFJlZixcbiAgaXNBY3RpdmUsXG4gIG9uU2Nyb2xsLFxuICBpc01vZGFsID0gZmFsc2UsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHNlbGVjdGlvbiA9IHVzZVNlbGVjdGlvbigpXG4gIGNvbnN0IHsgYWRkTm90aWZpY2F0aW9uIH0gPSB1c2VOb3RpZmljYXRpb25zKClcbiAgLy8gTGF6eS1pbml0ZWQgb24gZmlyc3Qgd2hlZWwgZXZlbnQgc28gdGhlIFhUVkVSU0lPTiBwcm9iZSAoZmlyZWQgYXRcbiAgLy8gcmF3LW1vZGUtZW5hYmxlIHRpbWUpIGhhcyByZXNvbHZlZCBieSB0aGVuIOKAlCBpbml0aWFsaXppbmcgaW4gdXNlUmVmKClcbiAgLy8gd291bGQgcmVhZCBnZXRXaGVlbEJhc2UoKSBiZWZvcmUgdGhlIHByb2JlIHJlcGx5IGFycml2ZXMgb3ZlciBTU0guXG4gIGNvbnN0IHdoZWVsQWNjZWwgPSB1c2VSZWY8V2hlZWxBY2NlbFN0YXRlIHwgbnVsbD4obnVsbClcblxuICBmdW5jdGlvbiBzaG93Q29waWVkVG9hc3QodGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gZ2V0Q2xpcGJvYXJkUGF0aCByZWFkcyBlbnYgc3luY2hyb25vdXNseSDigJQgcHJlZGljdHMgd2hhdCBzZXRDbGlwYm9hcmRcbiAgICAvLyBkaWQgKG5hdGl2ZSBwYmNvcHkgLyB0bXV4IGxvYWQtYnVmZmVyIC8gcmF3IE9TQyA1Mikgc28gd2UgY2FuIHRlbGxcbiAgICAvLyB0aGUgdXNlciB3aGV0aGVyIHBhc3RlIHdpbGwgSnVzdCBXb3JrIG9yIG5lZWRzIHByZWZpeCtdLlxuICAgIGNvbnN0IHBhdGggPSBnZXRDbGlwYm9hcmRQYXRoKClcbiAgICBjb25zdCBuID0gdGV4dC5sZW5ndGhcbiAgICBsZXQgbXNnOiBzdHJpbmdcbiAgICBzd2l0Y2ggKHBhdGgpIHtcbiAgICAgIGNhc2UgJ25hdGl2ZSc6XG4gICAgICAgIG1zZyA9IGBjb3BpZWQgJHtufSBjaGFycyB0byBjbGlwYm9hcmRgXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICd0bXV4LWJ1ZmZlcic6XG4gICAgICAgIG1zZyA9IGBjb3BpZWQgJHtufSBjaGFycyB0byB0bXV4IGJ1ZmZlciDCtyBwYXN0ZSB3aXRoIHByZWZpeCArIF1gXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdvc2M1Mic6XG4gICAgICAgIG1zZyA9IGBzZW50ICR7bn0gY2hhcnMgdmlhIE9TQyA1MiDCtyBjaGVjayB0ZXJtaW5hbCBjbGlwYm9hcmQgc2V0dGluZ3MgaWYgcGFzdGUgZmFpbHNgXG4gICAgICAgIGJyZWFrXG4gICAgfVxuICAgIGFkZE5vdGlmaWNhdGlvbih7XG4gICAgICBrZXk6ICdzZWxlY3Rpb24tY29waWVkJyxcbiAgICAgIHRleHQ6IG1zZyxcbiAgICAgIGNvbG9yOiAnc3VnZ2VzdGlvbicsXG4gICAgICBwcmlvcml0eTogJ2ltbWVkaWF0ZScsXG4gICAgICB0aW1lb3V0TXM6IHBhdGggPT09ICduYXRpdmUnID8gMjAwMCA6IDQwMDAsXG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvcHlBbmRUb2FzdCgpOiB2b2lkIHtcbiAgICBjb25zdCB0ZXh0ID0gc2VsZWN0aW9uLmNvcHlTZWxlY3Rpb24oKVxuICAgIGlmICh0ZXh0KSBzaG93Q29waWVkVG9hc3QodGV4dClcbiAgfVxuXG4gIC8vIFRyYW5zbGF0ZSBzZWxlY3Rpb24gdG8gdHJhY2sgYSBrZXlib2FyZCBwYWdlIGp1bXAuIFNlbGVjdGlvbiBjb29yZHMgYXJlXG4gIC8vIHNjcmVlbi1idWZmZXItbG9jYWw7IGEgc2Nyb2xsVG8gdGhhdCBtb3ZlcyBjb250ZW50IGJ5IE4gcm93cyBtdXN0IGFsc29cbiAgLy8gc2hpZnQgYW5jaG9yK2ZvY3VzIGJ5IE4gc28gdGhlIGhpZ2hsaWdodCBzdGF5cyBvbiB0aGUgc2FtZSB0ZXh0IChuYXRpdmVcbiAgLy8gdGVybWluYWwgYmVoYXZpb3I6IHNlbGVjdGlvbiBtb3ZlcyB3aXRoIGNvbnRlbnQsIGNsaXBzIGF0IHZpZXdwb3J0XG4gIC8vIGVkZ2VzKS4gUm93cyB0aGF0IHNjcm9sbCBvdXQgb2YgdGhlIHZpZXdwb3J0IGFyZSBjYXB0dXJlZCBpbnRvXG4gIC8vIHNjcm9sbGVkT2ZmQWJvdmUvQmVsb3cgYmVmb3JlIHRoZSBzY3JvbGwgc28gZ2V0U2VsZWN0ZWRUZXh0IHN0aWxsXG4gIC8vIHJldHVybnMgdGhlIGZ1bGwgdGV4dC4gV2hlZWwgc2Nyb2xsIChzY3JvbGw6bGluZVVwL0Rvd24gdmlhIHNjcm9sbEJ5KVxuICAvLyBzdGlsbCBjbGVhcnMg4oCUIGl0cyBhc3luYyBwZW5kaW5nU2Nyb2xsRGVsdGEgZHJhaW4gbWVhbnMgdGhlIGFjdHVhbFxuICAvLyBkZWx0YSBpc24ndCBrbm93biBzeW5jaHJvbm91c2x5IChmb2xsb3ctdXApLlxuICBmdW5jdGlvbiB0cmFuc2xhdGVTZWxlY3Rpb25Gb3JKdW1wKHM6IFNjcm9sbEJveEhhbmRsZSwgZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHNlbCA9IHNlbGVjdGlvbi5nZXRTdGF0ZSgpXG4gICAgaWYgKCFzZWw/LmFuY2hvciB8fCAhc2VsLmZvY3VzKSByZXR1cm5cbiAgICBjb25zdCB0b3AgPSBzLmdldFZpZXdwb3J0VG9wKClcbiAgICBjb25zdCBib3R0b20gPSB0b3AgKyBzLmdldFZpZXdwb3J0SGVpZ2h0KCkgLSAxXG4gICAgLy8gT25seSB0cmFuc2xhdGUgaWYgdGhlIHNlbGVjdGlvbiBpcyBPTiBzY3JvbGxib3ggY29udGVudC4gU2VsZWN0aW9uc1xuICAgIC8vIGluIHRoZSBmb290ZXIvcHJvbXB0L1N0aWNreVByb21wdEhlYWRlciBhcmUgb24gc3RhdGljIHRleHQg4oCUIHRoZVxuICAgIC8vIHNjcm9sbCBkb2Vzbid0IG1vdmUgd2hhdCdzIHVuZGVyIHRoZW0uIFNhbWUgZ3VhcmQgYXMgaW5rLnRzeCdzXG4gICAgLy8gYXV0by1mb2xsb3cgdHJhbnNsYXRlIChjb21taXQgMzZhOGQxNTQpLlxuICAgIGlmIChzZWwuYW5jaG9yLnJvdyA8IHRvcCB8fCBzZWwuYW5jaG9yLnJvdyA+IGJvdHRvbSkgcmV0dXJuXG4gICAgLy8gQ3Jvc3MtYm91bmRhcnk6IGFuY2hvciBpbiBzY3JvbGxib3gsIGZvY3VzIGluIGZvb3Rlci9oZWFkZXIuIE1pcnJvclxuICAgIC8vIGluay50c3gncyBGbGFnLTMgZ3VhcmQg4oCUIGZhbGwgdGhyb3VnaCB3aXRob3V0IHNoaWZ0aW5nIE9SIGNhcHR1cmluZy5cbiAgICAvLyBUaGUgc3RhdGljIGVuZHBvaW50IHBpbnMgdGhlIHNlbGVjdGlvbjsgc2hpZnRpbmcgd291bGQgdGVsZXBvcnQgaXRcbiAgICAvLyBpbnRvIHNjcm9sbGJveCBjb250ZW50LlxuICAgIGlmIChzZWwuZm9jdXMucm93IDwgdG9wIHx8IHNlbC5mb2N1cy5yb3cgPiBib3R0b20pIHJldHVyblxuICAgIGNvbnN0IG1heCA9IE1hdGgubWF4KDAsIHMuZ2V0U2Nyb2xsSGVpZ2h0KCkgLSBzLmdldFZpZXdwb3J0SGVpZ2h0KCkpXG4gICAgY29uc3QgY3VyID0gcy5nZXRTY3JvbGxUb3AoKSArIHMuZ2V0UGVuZGluZ0RlbHRhKClcbiAgICAvLyBBY3R1YWwgc2Nyb2xsIGRpc3RhbmNlIGFmdGVyIGJvdW5kYXJ5IGNsYW1wLiBqdW1wQnkgbWF5IGNhbGxcbiAgICAvLyBzY3JvbGxUb0JvdHRvbSB3aGVuIHRhcmdldCA+PSBtYXggYnV0IHRoZSB2aWV3IGNhbid0IG1vdmUgcGFzdCBtYXgsXG4gICAgLy8gc28gdGhlIHNlbGVjdGlvbiBzaGlmdCBpcyBib3VuZGVkIGhlcmUuXG4gICAgY29uc3QgYWN0dWFsID0gTWF0aC5tYXgoMCwgTWF0aC5taW4obWF4LCBjdXIgKyBkZWx0YSkpIC0gY3VyXG4gICAgaWYgKGFjdHVhbCA9PT0gMCkgcmV0dXJuXG4gICAgaWYgKGFjdHVhbCA+IDApIHtcbiAgICAgIC8vIFNjcm9sbGluZyBkb3duOiBjb250ZW50IG1vdmVzIHVwLiBSb3dzIGF0IHRoZSBUT1AgbGVhdmUgdmlld3BvcnQuXG4gICAgICAvLyBBbmNob3IrZm9jdXMgc2hpZnQgLWFjdHVhbCBzbyB0aGV5IHRyYWNrIHRoZSBjb250ZW50IHRoYXQgbW92ZWQgdXAuXG4gICAgICBzZWxlY3Rpb24uY2FwdHVyZVNjcm9sbGVkUm93cyh0b3AsIHRvcCArIGFjdHVhbCAtIDEsICdhYm92ZScpXG4gICAgICBzZWxlY3Rpb24uc2hpZnRTZWxlY3Rpb24oLWFjdHVhbCwgdG9wLCBib3R0b20pXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNjcm9sbGluZyB1cDogY29udGVudCBtb3ZlcyBkb3duLiBSb3dzIGF0IHRoZSBCT1RUT00gbGVhdmUgdmlld3BvcnQuXG4gICAgICBjb25zdCBhID0gLWFjdHVhbFxuICAgICAgc2VsZWN0aW9uLmNhcHR1cmVTY3JvbGxlZFJvd3MoYm90dG9tIC0gYSArIDEsIGJvdHRvbSwgJ2JlbG93JylcbiAgICAgIHNlbGVjdGlvbi5zaGlmdFNlbGVjdGlvbihhLCB0b3AsIGJvdHRvbSlcbiAgICB9XG4gIH1cblxuICB1c2VLZXliaW5kaW5ncyhcbiAgICB7XG4gICAgICAnc2Nyb2xsOnBhZ2VVcCc6ICgpID0+IHtcbiAgICAgICAgY29uc3QgcyA9IHNjcm9sbFJlZi5jdXJyZW50XG4gICAgICAgIGlmICghcykgcmV0dXJuXG4gICAgICAgIGNvbnN0IGQgPSAtTWF0aC5tYXgoMSwgTWF0aC5mbG9vcihzLmdldFZpZXdwb3J0SGVpZ2h0KCkgLyAyKSlcbiAgICAgICAgdHJhbnNsYXRlU2VsZWN0aW9uRm9ySnVtcChzLCBkKVxuICAgICAgICBjb25zdCBzdGlja3kgPSBqdW1wQnkocywgZClcbiAgICAgICAgb25TY3JvbGw/LihzdGlja3ksIHMpXG4gICAgICB9LFxuICAgICAgJ3Njcm9sbDpwYWdlRG93bic6ICgpID0+IHtcbiAgICAgICAgY29uc3QgcyA9IHNjcm9sbFJlZi5jdXJyZW50XG4gICAgICAgIGlmICghcykgcmV0dXJuXG4gICAgICAgIGNvbnN0IGQgPSBNYXRoLm1heCgxLCBNYXRoLmZsb29yKHMuZ2V0Vmlld3BvcnRIZWlnaHQoKSAvIDIpKVxuICAgICAgICB0cmFuc2xhdGVTZWxlY3Rpb25Gb3JKdW1wKHMsIGQpXG4gICAgICAgIGNvbnN0IHN0aWNreSA9IGp1bXBCeShzLCBkKVxuICAgICAgICBvblNjcm9sbD8uKHN0aWNreSwgcylcbiAgICAgIH0sXG4gICAgICAnc2Nyb2xsOmxpbmVVcCc6ICgpID0+IHtcbiAgICAgICAgLy8gV2hlZWw6IHNjcm9sbEJ5IGFjY3VtdWxhdGVzIGludG8gcGVuZGluZ1Njcm9sbERlbHRhLCBkcmFpbmVkIGFzeW5jXG4gICAgICAgIC8vIGJ5IHRoZSByZW5kZXJlci4gY2FwdHVyZVNjcm9sbGVkUm93cyBjYW4ndCByZWFkIHRoZSBvdXRnb2luZyByb3dzXG4gICAgICAgIC8vIGJlZm9yZSB0aGV5IGxlYXZlIChkcmFpbiBpcyBub24tZGV0ZXJtaW5pc3RpYykuIENsZWFyIGZvciBub3cuXG4gICAgICAgIHNlbGVjdGlvbi5jbGVhclNlbGVjdGlvbigpXG4gICAgICAgIGNvbnN0IHMgPSBzY3JvbGxSZWYuY3VycmVudFxuICAgICAgICAvLyBSZXR1cm4gZmFsc2UgKG5vdCBjb25zdW1lZCkgd2hlbiB0aGUgU2Nyb2xsQm94IGNvbnRlbnQgZml0cyDigJRcbiAgICAgICAgLy8gc2Nyb2xsIHdvdWxkIGJlIGEgbm8tb3AuIExldHMgYSBjaGlsZCBjb21wb25lbnQncyBoYW5kbGVyIHRha2VcbiAgICAgICAgLy8gdGhlIHdoZWVsIGV2ZW50IGluc3RlYWQgKGUuZy4gU2V0dGluZ3MgQ29uZmlnJ3MgbGlzdCBuYXZpZ2F0aW9uXG4gICAgICAgIC8vIGluc2lkZSB0aGUgY2VudGVyZWQgTW9kYWwsIHdoZXJlIHRoZSBwYWdpbmF0ZWQgc2xpY2UgYWx3YXlzIGZpdHMpLlxuICAgICAgICBpZiAoIXMgfHwgcy5nZXRTY3JvbGxIZWlnaHQoKSA8PSBzLmdldFZpZXdwb3J0SGVpZ2h0KCkpIHJldHVybiBmYWxzZVxuICAgICAgICB3aGVlbEFjY2VsLmN1cnJlbnQgPz89IGluaXRBbmRMb2dXaGVlbEFjY2VsKClcbiAgICAgICAgc2Nyb2xsVXAocywgY29tcHV0ZVdoZWVsU3RlcCh3aGVlbEFjY2VsLmN1cnJlbnQsIC0xLCBwZXJmb3JtYW5jZS5ub3coKSkpXG4gICAgICAgIG9uU2Nyb2xsPy4oZmFsc2UsIHMpXG4gICAgICB9LFxuICAgICAgJ3Njcm9sbDpsaW5lRG93bic6ICgpID0+IHtcbiAgICAgICAgc2VsZWN0aW9uLmNsZWFyU2VsZWN0aW9uKClcbiAgICAgICAgY29uc3QgcyA9IHNjcm9sbFJlZi5jdXJyZW50XG4gICAgICAgIGlmICghcyB8fCBzLmdldFNjcm9sbEhlaWdodCgpIDw9IHMuZ2V0Vmlld3BvcnRIZWlnaHQoKSkgcmV0dXJuIGZhbHNlXG4gICAgICAgIHdoZWVsQWNjZWwuY3VycmVudCA/Pz0gaW5pdEFuZExvZ1doZWVsQWNjZWwoKVxuICAgICAgICBjb25zdCBzdGVwID0gY29tcHV0ZVdoZWVsU3RlcCh3aGVlbEFjY2VsLmN1cnJlbnQsIDEsIHBlcmZvcm1hbmNlLm5vdygpKVxuICAgICAgICBjb25zdCByZWFjaGVkQm90dG9tID0gc2Nyb2xsRG93bihzLCBzdGVwKVxuICAgICAgICBvblNjcm9sbD8uKHJlYWNoZWRCb3R0b20sIHMpXG4gICAgICB9LFxuICAgICAgJ3Njcm9sbDp0b3AnOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHMgPSBzY3JvbGxSZWYuY3VycmVudFxuICAgICAgICBpZiAoIXMpIHJldHVyblxuICAgICAgICB0cmFuc2xhdGVTZWxlY3Rpb25Gb3JKdW1wKHMsIC0ocy5nZXRTY3JvbGxUb3AoKSArIHMuZ2V0UGVuZGluZ0RlbHRhKCkpKVxuICAgICAgICBzLnNjcm9sbFRvKDApXG4gICAgICAgIG9uU2Nyb2xsPy4oZmFsc2UsIHMpXG4gICAgICB9LFxuICAgICAgJ3Njcm9sbDpib3R0b20nOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHMgPSBzY3JvbGxSZWYuY3VycmVudFxuICAgICAgICBpZiAoIXMpIHJldHVyblxuICAgICAgICBjb25zdCBtYXggPSBNYXRoLm1heCgwLCBzLmdldFNjcm9sbEhlaWdodCgpIC0gcy5nZXRWaWV3cG9ydEhlaWdodCgpKVxuICAgICAgICB0cmFuc2xhdGVTZWxlY3Rpb25Gb3JKdW1wKFxuICAgICAgICAgIHMsXG4gICAgICAgICAgbWF4IC0gKHMuZ2V0U2Nyb2xsVG9wKCkgKyBzLmdldFBlbmRpbmdEZWx0YSgpKSxcbiAgICAgICAgKVxuICAgICAgICAvLyBzY3JvbGxUbyhtYXgpIGVhZ2VyLXdyaXRlcyBzY3JvbGxUb3Agc28gdGhlIHJlbmRlci1waGFzZSBzdGlja3lcbiAgICAgICAgLy8gZm9sbG93IGNvbXB1dGVzIGZvbGxvd0RlbHRhPTAuIFdpdGhvdXQgdGhpcywgc2Nyb2xsVG9Cb3R0b20oKVxuICAgICAgICAvLyBhbG9uZSBsZWF2ZXMgc2Nyb2xsVG9wIHN0YWxlIOKGkiBmb2xsb3dEZWx0YT1tYXgtc3RhbGUg4oaSXG4gICAgICAgIC8vIHNoaWZ0U2VsZWN0aW9uRm9yRm9sbG93IGFwcGxpZXMgdGhlIFNBTUUgc2hpZnQgd2UgYWxyZWFkeSBkaWRcbiAgICAgICAgLy8gYWJvdmUsIDLDlyBvZmZzZXQuIHNjcm9sbFRvQm90dG9tKCkgdGhlbiByZS1lbmFibGVzIHN0aWNreS5cbiAgICAgICAgcy5zY3JvbGxUbyhtYXgpXG4gICAgICAgIHMuc2Nyb2xsVG9Cb3R0b20oKVxuICAgICAgICBvblNjcm9sbD8uKHRydWUsIHMpXG4gICAgICB9LFxuICAgICAgJ3NlbGVjdGlvbjpjb3B5JzogY29weUFuZFRvYXN0LFxuICAgIH0sXG4gICAgeyBjb250ZXh0OiAnU2Nyb2xsJywgaXNBY3RpdmUgfSxcbiAgKVxuXG4gIC8vIHNjcm9sbDpoYWxmUGFnZSovZnVsbFBhZ2UqIGhhdmUgbm8gZGVmYXVsdCBrZXkgYmluZGluZ3Mg4oCUIGN0cmwrdS9kL2IvZlxuICAvLyBhbGwgaGF2ZSByZWFsIG93bmVycyBpbiBub3JtYWwgbW9kZSAoa2lsbC1saW5lL2V4aXQvdGFzazpiYWNrZ3JvdW5kL1xuICAvLyBraWxsLWFnZW50cykuIFRyYW5zY3JpcHQgbW9kZSBnZXRzIHRoZW0gdmlhIHRoZSBpc01vZGFsIHJhdyB1c2VJbnB1dFxuICAvLyBiZWxvdy4gVGhlc2UgaGFuZGxlcnMgc3RheSBmb3IgY3VzdG9tIHJlYmluZHMgb25seS5cbiAgdXNlS2V5YmluZGluZ3MoXG4gICAge1xuICAgICAgJ3Njcm9sbDpoYWxmUGFnZVVwJzogKCkgPT4ge1xuICAgICAgICBjb25zdCBzID0gc2Nyb2xsUmVmLmN1cnJlbnRcbiAgICAgICAgaWYgKCFzKSByZXR1cm5cbiAgICAgICAgY29uc3QgZCA9IC1NYXRoLm1heCgxLCBNYXRoLmZsb29yKHMuZ2V0Vmlld3BvcnRIZWlnaHQoKSAvIDIpKVxuICAgICAgICB0cmFuc2xhdGVTZWxlY3Rpb25Gb3JKdW1wKHMsIGQpXG4gICAgICAgIGNvbnN0IHN0aWNreSA9IGp1bXBCeShzLCBkKVxuICAgICAgICBvblNjcm9sbD8uKHN0aWNreSwgcylcbiAgICAgIH0sXG4gICAgICAnc2Nyb2xsOmhhbGZQYWdlRG93bic6ICgpID0+IHtcbiAgICAgICAgY29uc3QgcyA9IHNjcm9sbFJlZi5jdXJyZW50XG4gICAgICAgIGlmICghcykgcmV0dXJuXG4gICAgICAgIGNvbnN0IGQgPSBNYXRoLm1heCgxLCBNYXRoLmZsb29yKHMuZ2V0Vmlld3BvcnRIZWlnaHQoKSAvIDIpKVxuICAgICAgICB0cmFuc2xhdGVTZWxlY3Rpb25Gb3JKdW1wKHMsIGQpXG4gICAgICAgIGNvbnN0IHN0aWNreSA9IGp1bXBCeShzLCBkKVxuICAgICAgICBvblNjcm9sbD8uKHN0aWNreSwgcylcbiAgICAgIH0sXG4gICAgICAnc2Nyb2xsOmZ1bGxQYWdlVXAnOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHMgPSBzY3JvbGxSZWYuY3VycmVudFxuICAgICAgICBpZiAoIXMpIHJldHVyblxuICAgICAgICBjb25zdCBkID0gLU1hdGgubWF4KDEsIHMuZ2V0Vmlld3BvcnRIZWlnaHQoKSlcbiAgICAgICAgdHJhbnNsYXRlU2VsZWN0aW9uRm9ySnVtcChzLCBkKVxuICAgICAgICBjb25zdCBzdGlja3kgPSBqdW1wQnkocywgZClcbiAgICAgICAgb25TY3JvbGw/LihzdGlja3ksIHMpXG4gICAgICB9LFxuICAgICAgJ3Njcm9sbDpmdWxsUGFnZURvd24nOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHMgPSBzY3JvbGxSZWYuY3VycmVudFxuICAgICAgICBpZiAoIXMpIHJldHVyblxuICAgICAgICBjb25zdCBkID0gTWF0aC5tYXgoMSwgcy5nZXRWaWV3cG9ydEhlaWdodCgpKVxuICAgICAgICB0cmFuc2xhdGVTZWxlY3Rpb25Gb3JKdW1wKHMsIGQpXG4gICAgICAgIGNvbnN0IHN0aWNreSA9IGp1bXBCeShzLCBkKVxuICAgICAgICBvblNjcm9sbD8uKHN0aWNreSwgcylcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7IGNvbnRleHQ6ICdTY3JvbGwnLCBpc0FjdGl2ZSB9LFxuICApXG5cbiAgLy8gTW9kYWwgcGFnZXIga2V5cyDigJQgdHJhbnNjcmlwdCBtb2RlIG9ubHkuIGxlc3MvdG11eCBjb3B5LW1vZGUgbGluZWFnZTpcbiAgLy8gY3RybCt1L2QgKGhhbGYtcGFnZSksIGN0cmwrYi9mIChmdWxsLXBhZ2UpLCBnL0cgKHRvcC9ib3R0b20pLiBUb20nc1xuICAvLyByZXNvbHV0aW9uICgyMDI2LTAzLTE1KTogXCJJbiBjdHJsLW8gbW9kZSwgY3RybC11LCBjdHJsLWQsIGV0Yy4gc2hvdWxkXG4gIC8vIHJvdWdobHkganVzdCB3b3JrIVwiIOKAlCB0cmFuc2NyaXB0IGlzIHRoZSBjb3B5LW1vZGUgY29udGFpbmVyLlxuICAvL1xuICAvLyBTYWZlIGJlY2F1c2UgdGhlIGNvbmZsaWN0aW5nIGhhbmRsZXJzIGFyZW4ndCByZWFjaGFibGUgaGVyZTpcbiAgLy8gICBjdHJsK3Ug4oaSIGtpbGwtbGluZSwgY3RybCtkIOKGkiBleGl0OiBQcm9tcHRJbnB1dCBub3QgbW91bnRlZFxuICAvLyAgIGN0cmwrYiDihpIgdGFzazpiYWNrZ3JvdW5kOiBTZXNzaW9uQmFja2dyb3VuZEhpbnQgbm90IG1vdW50ZWRcbiAgLy8gICBjdHJsK2Yg4oaSIGNoYXQ6a2lsbEFnZW50cyBtb3ZlZCB0byBjdHJsK3ggY3RybCtrOyBubyBjb25mbGljdFxuICAvLyAgIGcvRyDihpIgcHJpbnRhYmxlIGNoYXJzOiBubyBwcm9tcHQgdG8gZWF0IHRoZW0sIG5vIHZpbS9zdGlja3kgZ2F0ZSBuZWVkZWRcbiAgLy9cbiAgLy8gVE9ETyhzZWFyY2gpOiBgL2AsIG4vTiDigJQgYnVpbGQgb24gUmljaGFyZCBLaW0ncyBkOTRiMDdhZGQ0IChicmFuY2hcbiAgLy8gY2xhdWRlL2p1bXAtcmVjZW50LW1lc3NhZ2UtQ0VQY3EpLiBnZXRJdGVtWSBZb2dhLXdhbGsgKyBjb21wdXRlT3JpZ2luICtcbiAgLy8gYW5jaG9yWSBhbHJlYWR5IHNvbHZlIHNjcm9sbC10by1pbmRleC4ganVtcFRvUHJldlR1cm4gaXMgdGhlIG4vTlxuICAvLyB0ZW1wbGF0ZS4gU2luZ2xlLXNob3QgdmlhIE9WRVJTQ0FOX1JPV1M9ODA7IHR3by1waGFzZSB3YXMgdHJpZWQgYW5kXG4gIC8vIGFiYW5kb25lZCAo4p2vIG9zY2lsbGF0aW9uKS4gU2VlIHRlYW0gbWVtb3J5IHNjcm9sbC1jb3B5LW1vZGUtZGVzaWduLm1kLlxuICB1c2VJbnB1dChcbiAgICAoaW5wdXQsIGtleSwgZXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IHMgPSBzY3JvbGxSZWYuY3VycmVudFxuICAgICAgaWYgKCFzKSByZXR1cm5cbiAgICAgIGNvbnN0IHN0aWNreSA9IGFwcGx5TW9kYWxQYWdlckFjdGlvbihzLCBtb2RhbFBhZ2VyQWN0aW9uKGlucHV0LCBrZXkpLCBkID0+XG4gICAgICAgIHRyYW5zbGF0ZVNlbGVjdGlvbkZvckp1bXAocywgZCksXG4gICAgICApXG4gICAgICBpZiAoc3RpY2t5ID09PSBudWxsKSByZXR1cm5cbiAgICAgIG9uU2Nyb2xsPy4oc3RpY2t5LCBzKVxuICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcbiAgICB9LFxuICAgIHsgaXNBY3RpdmU6IGlzQWN0aXZlICYmIGlzTW9kYWwgfSxcbiAgKVxuXG4gIC8vIEVzYyBjbGVhcnMgc2VsZWN0aW9uOyBhbnkgb3RoZXIga2V5c3Ryb2tlIGFsc28gY2xlYXJzIGl0IChtYXRjaGVzXG4gIC8vIG5hdGl2ZSB0ZXJtaW5hbCBiZWhhdmlvciB3aGVyZSBzZWxlY3Rpb24gZGlzYXBwZWFycyBvbiBpbnB1dCkuXG4gIC8vIEN0cmwrQyBjb3BpZXMgd2hlbiBhIHNlbGVjdGlvbiBleGlzdHMg4oCUIG5lZWRlZCBvbiBsZWdhY3kgdGVybWluYWxzXG4gIC8vIHdoZXJlIGN0cmwrc2hpZnQrYyBzZW5kcyB0aGUgc2FtZSBieXRlIChcXHgwMywgc2hpZnQgaXMgbG9zdCkgYW5kXG4gIC8vIGNtZCtjIG5ldmVyIHJlYWNoZXMgdGhlIHB0eSAodGVybWluYWwgaW50ZXJjZXB0cyBpdCBmb3IgRWRpdCA+IENvcHkpLlxuICAvLyBIYW5kbGVkIHZpYSByYXcgdXNlSW5wdXQgc28gd2UgY2FuIGNvbmRpdGlvbmFsbHkgY29uc3VtZTogRXNjL0N0cmwrQ1xuICAvLyBvbmx5IHN0b3AgcHJvcGFnYXRpb24gd2hlbiBhIHNlbGVjdGlvbiBleGlzdHMsIGxldHRpbmcgdGhlbSBzdGlsbCB3b3JrXG4gIC8vIGZvciBjYW5jZWwtcmVxdWVzdCAvIGludGVycnVwdCBvdGhlcndpc2UuIE90aGVyIGtleXMgbmV2ZXIgc3RvcFxuICAvLyBwcm9wYWdhdGlvbiDigJQgdGhleSdyZSBvYnNlcnZlZCB0byBjbGVhciBzZWxlY3Rpb24gYXMgYSBzaWRlLWVmZmVjdC5cbiAgLy8gVGhlIHNlbGVjdGlvbjpjb3B5IGtleWJpbmRpbmcgKGN0cmwrc2hpZnQrYyAvIGNtZCtjKSByZWdpc3RlcnMgYWJvdmVcbiAgLy8gdmlhIHVzZUtleWJpbmRpbmdzIGFuZCBjb25zdW1lcyBpdHMgZXZlbnQgYmVmb3JlIHJlYWNoaW5nIGhlcmUuXG4gIHVzZUlucHV0KFxuICAgIChpbnB1dCwga2V5LCBldmVudCkgPT4ge1xuICAgICAgaWYgKCFzZWxlY3Rpb24uaGFzU2VsZWN0aW9uKCkpIHJldHVyblxuICAgICAgaWYgKGtleS5lc2NhcGUpIHtcbiAgICAgICAgc2VsZWN0aW9uLmNsZWFyU2VsZWN0aW9uKClcbiAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBpZiAoa2V5LmN0cmwgJiYgIWtleS5zaGlmdCAmJiAha2V5Lm1ldGEgJiYgaW5wdXQgPT09ICdjJykge1xuICAgICAgICBjb3B5QW5kVG9hc3QoKVxuICAgICAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGNvbnN0IG1vdmUgPSBzZWxlY3Rpb25Gb2N1c01vdmVGb3JLZXkoa2V5KVxuICAgICAgaWYgKG1vdmUpIHtcbiAgICAgICAgc2VsZWN0aW9uLm1vdmVGb2N1cyhtb3ZlKVxuICAgICAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGlmIChzaG91bGRDbGVhclNlbGVjdGlvbk9uS2V5KGtleSkpIHtcbiAgICAgICAgc2VsZWN0aW9uLmNsZWFyU2VsZWN0aW9uKClcbiAgICAgIH1cbiAgICB9LFxuICAgIHsgaXNBY3RpdmUgfSxcbiAgKVxuXG4gIHVzZURyYWdUb1Njcm9sbChzY3JvbGxSZWYsIHNlbGVjdGlvbiwgaXNBY3RpdmUsIG9uU2Nyb2xsKVxuICB1c2VDb3B5T25TZWxlY3Qoc2VsZWN0aW9uLCBpc0FjdGl2ZSwgc2hvd0NvcGllZFRvYXN0KVxuICB1c2VTZWxlY3Rpb25CZ0NvbG9yKHNlbGVjdGlvbilcblxuICByZXR1cm4gbnVsbFxufVxuXG4vKipcbiAqIEF1dG8tc2Nyb2xsIHRoZSBTY3JvbGxCb3ggd2hlbiB0aGUgdXNlciBkcmFncyBhIHNlbGVjdGlvbiBwYXN0IGl0cyB0b3Agb3JcbiAqIGJvdHRvbSBlZGdlLiBUaGUgYW5jaG9yIGlzIHNoaWZ0ZWQgaW4gdGhlIG9wcG9zaXRlIGRpcmVjdGlvbiBzbyBpdCBzdGF5c1xuICogb24gdGhlIHNhbWUgY29udGVudCAoY29udGVudCB0aGF0IHdhcyBhdCB2aWV3cG9ydCByb3cgTiBpcyBub3cgYXQgcm93IE7CsWRcbiAqIGFmdGVyIHNjcm9sbGluZyBieSBkKS4gRm9jdXMgc3RheXMgYXQgdGhlIG1vdXNlIHBvc2l0aW9uIChlZGdlIHJvdykuXG4gKlxuICogU2VsZWN0aW9uIGNvb3JkcyBhcmUgc2NyZWVuLWJ1ZmZlci1sb2NhbCwgc28gdGhlIGFuY2hvciBpcyBjbGFtcGVkIHRvIHRoZVxuICogdmlld3BvcnQgYm91bmRzIG9uY2UgdGhlIG9yaWdpbmFsIGNvbnRlbnQgc2Nyb2xscyBvdXQuIFRvIHByZXNlcnZlIHRoZSBmdWxsXG4gKiBzZWxlY3Rpb24sIHJvd3MgYWJvdXQgdG8gc2Nyb2xsIG91dCBhcmUgY2FwdHVyZWQgaW50byBzY3JvbGxlZE9mZkFib3ZlL1xuICogc2Nyb2xsZWRPZmZCZWxvdyBiZWZvcmUgZWFjaCBzY3JvbGwgc3RlcCBhbmQgam9pbmVkIGJhY2sgaW4gYnlcbiAqIGdldFNlbGVjdGVkVGV4dC5cbiAqL1xuZnVuY3Rpb24gdXNlRHJhZ1RvU2Nyb2xsKFxuICBzY3JvbGxSZWY6IFJlZk9iamVjdDxTY3JvbGxCb3hIYW5kbGUgfCBudWxsPixcbiAgc2VsZWN0aW9uOiBSZXR1cm5UeXBlPHR5cGVvZiB1c2VTZWxlY3Rpb24+LFxuICBpc0FjdGl2ZTogYm9vbGVhbixcbiAgb25TY3JvbGw6IFByb3BzWydvblNjcm9sbCddLFxuKTogdm9pZCB7XG4gIGNvbnN0IHRpbWVyUmVmID0gdXNlUmVmPE5vZGVKUy5UaW1lb3V0IHwgbnVsbD4obnVsbClcbiAgY29uc3QgZGlyUmVmID0gdXNlUmVmPC0xIHwgMCB8IDE+KDApIC8vIC0xIHNjcm9sbGluZyB1cCwgKzEgZG93biwgMCBpZGxlXG4gIC8vIFN1cnZpdmVzIHN0b3AoKSDigJQgcmVzZXQgb25seSBvbiBkcmFnLWZpbmlzaC4gU2VlIGNoZWNrKCkgZm9yIHNlbWFudGljcy5cbiAgY29uc3QgbGFzdFNjcm9sbGVkRGlyUmVmID0gdXNlUmVmPC0xIHwgMCB8IDE+KDApXG4gIGNvbnN0IHRpY2tzUmVmID0gdXNlUmVmKDApXG4gIC8vIG9uU2Nyb2xsIG1heSBjaGFuZ2UgaWRlbnRpdHkgZXZlcnkgcmVuZGVyIChpZiBub3QgbWVtb2l6ZWQgYnkgY2FsbGVyKS5cbiAgLy8gUmVhZCB0aHJvdWdoIGEgcmVmIHNvIHRoZSBlZmZlY3QgZG9lc24ndCByZS1zdWJzY3JpYmUgYW5kIGtpbGwgdGhlIHRpbWVyXG4gIC8vIG9uIGVhY2ggc2Nyb2xsLWluZHVjZWQgcmUtcmVuZGVyLlxuICBjb25zdCBvblNjcm9sbFJlZiA9IHVzZVJlZihvblNjcm9sbClcbiAgb25TY3JvbGxSZWYuY3VycmVudCA9IG9uU2Nyb2xsXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWlzQWN0aXZlKSByZXR1cm5cblxuICAgIGZ1bmN0aW9uIHN0b3AoKTogdm9pZCB7XG4gICAgICBkaXJSZWYuY3VycmVudCA9IDBcbiAgICAgIGlmICh0aW1lclJlZi5jdXJyZW50KSB7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGltZXJSZWYuY3VycmVudClcbiAgICAgICAgdGltZXJSZWYuY3VycmVudCA9IG51bGxcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0aWNrKCk6IHZvaWQge1xuICAgICAgY29uc3Qgc2VsID0gc2VsZWN0aW9uLmdldFN0YXRlKClcbiAgICAgIGNvbnN0IHMgPSBzY3JvbGxSZWYuY3VycmVudFxuICAgICAgY29uc3QgZGlyID0gZGlyUmVmLmN1cnJlbnRcbiAgICAgIC8vIGRpciA9PT0gMCBkZWZlbmRzIGFnYWluc3QgYSBzdGFsZSBpbnRlcnZhbCAoc3RhcnQoKSBtYXkgaGF2ZSBzZXQgb25lXG4gICAgICAvLyBhZnRlciB0aGUgaW1tZWRpYXRlIHRpY2sgYWxyZWFkeSBjYWxsZWQgc3RvcCgpIGF0IGEgc2Nyb2xsIGJvdW5kYXJ5KS5cbiAgICAgIC8vIHRpY2tzIGNhcCBkZWZlbmRzIGFnYWluc3QgYSBsb3N0IHJlbGVhc2UgZXZlbnQgKG1vdXNlIHJlbGVhc2VkXG4gICAgICAvLyBvdXRzaWRlIHRlcm1pbmFsIHdpbmRvdykgbGVhdmluZyBpc0RyYWdnaW5nIHN0dWNrIHRydWUuXG4gICAgICBpZiAoXG4gICAgICAgICFzZWw/LmlzRHJhZ2dpbmcgfHxcbiAgICAgICAgIXNlbC5mb2N1cyB8fFxuICAgICAgICAhcyB8fFxuICAgICAgICBkaXIgPT09IDAgfHxcbiAgICAgICAgKyt0aWNrc1JlZi5jdXJyZW50ID4gQVVUT1NDUk9MTF9NQVhfVElDS1NcbiAgICAgICkge1xuICAgICAgICBzdG9wKClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICAvLyBzY3JvbGxCeSBhY2N1bXVsYXRlcyBpbnRvIHBlbmRpbmdTY3JvbGxEZWx0YTsgdGhlIHNjcmVlbiBidWZmZXJcbiAgICAgIC8vIGRvZXNuJ3QgdXBkYXRlIHVudGlsIHRoZSBuZXh0IHJlbmRlciBkcmFpbnMgaXQuIElmIGEgcHJldmlvdXNcbiAgICAgIC8vIHRpY2sncyBzY3JvbGwgaGFzbid0IGRyYWluZWQgeWV0LCBjYXB0dXJlU2Nyb2xsZWRSb3dzIHdvdWxkIHJlYWRcbiAgICAgIC8vIHN0YWxlIGNvbnRlbnQgKHNhbWUgcm93cyBhcyBsYXN0IHRpY2sg4oaSIGR1cGxpY2F0ZWQgaW4gdGhlXG4gICAgICAvLyBhY2N1bXVsYXRvciBBTkQgbWlzc2luZyB0aGUgcm93cyB0aGF0IGFjdHVhbGx5IHNjcm9sbGVkIG91dCkuXG4gICAgICAvLyBTa2lwIHRoaXMgdGljazsgdGhlIDUwbXMgaW50ZXJ2YWwgd2lsbCByZXRyeSBhZnRlciBJbmsncyAxNm1zXG4gICAgICAvLyByZW5kZXIgY2F0Y2hlcyB1cC4gQWxzbyBwcmV2ZW50cyBzaGlmdEFuY2hvciBmcm9tIGRlc3luY2luZy5cbiAgICAgIGlmIChzLmdldFBlbmRpbmdEZWx0YSgpICE9PSAwKSByZXR1cm5cbiAgICAgIGNvbnN0IHRvcCA9IHMuZ2V0Vmlld3BvcnRUb3AoKVxuICAgICAgY29uc3QgYm90dG9tID0gdG9wICsgcy5nZXRWaWV3cG9ydEhlaWdodCgpIC0gMVxuICAgICAgLy8gQ2xhbXAgYW5jaG9yIHdpdGhpbiBbdG9wLCBib3R0b21dLiBOb3QgWzAsIGJvdHRvbV06IHRoZSBTY3JvbGxCb3hcbiAgICAgIC8vIHBhZGRpbmcgcm93IGF0IDAgd291bGQgcHJvZHVjZSBhIGJsYW5rIGxpbmUgYmV0d2VlbiBzY3JvbGxlZE9mZkFib3ZlXG4gICAgICAvLyBhbmQgdGhlIG9uLXNjcmVlbiBjb250ZW50IGluIGdldFNlbGVjdGVkVGV4dC4gVGhlIHBhZGRpbmctcm93XG4gICAgICAvLyBoaWdobGlnaHQgd2FzIGEgbWlub3IgdmlzdWFsIG5pY2V0eTsgdGV4dCBjb3JyZWN0bmVzcyB3aW5zLlxuICAgICAgaWYgKGRpciA8IDApIHtcbiAgICAgICAgaWYgKHMuZ2V0U2Nyb2xsVG9wKCkgPD0gMCkge1xuICAgICAgICAgIHN0b3AoKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIC8vIFNjcm9sbGluZyB1cDogY29udGVudCBtb3ZlcyBkb3duIGluIHZpZXdwb3J0LCBzbyBhbmNob3Igcm93ICtOLlxuICAgICAgICAvLyBDbGFtcCB0byBhY3R1YWwgc2Nyb2xsIGRpc3RhbmNlIHNvIGFuY2hvciBzdGF5cyBpbiBzeW5jIHdoZW4gbmVhclxuICAgICAgICAvLyB0aGUgdG9wIGJvdW5kYXJ5IChyZW5kZXJlciBjbGFtcHMgc2Nyb2xsVG9wIHRvIDAgb24gZHJhaW4pLlxuICAgICAgICBjb25zdCBhY3R1YWwgPSBNYXRoLm1pbihBVVRPU0NST0xMX0xJTkVTLCBzLmdldFNjcm9sbFRvcCgpKVxuICAgICAgICAvLyBDYXB0dXJlIHJvd3MgYWJvdXQgdG8gc2Nyb2xsIG91dCB0aGUgQk9UVE9NIGJlZm9yZSBzY3JvbGxCeVxuICAgICAgICAvLyBvdmVyd3JpdGVzIHRoZW0uIE9ubHkgcm93cyBpbnNpZGUgdGhlIHNlbGVjdGlvbiBhcmUgY2FwdHVyZWRcbiAgICAgICAgLy8gKGNhcHR1cmVTY3JvbGxlZFJvd3MgaW50ZXJzZWN0cyB3aXRoIHNlbGVjdGlvbiBib3VuZHMpLlxuICAgICAgICBzZWxlY3Rpb24uY2FwdHVyZVNjcm9sbGVkUm93cyhib3R0b20gLSBhY3R1YWwgKyAxLCBib3R0b20sICdiZWxvdycpXG4gICAgICAgIHNlbGVjdGlvbi5zaGlmdEFuY2hvcihhY3R1YWwsIDAsIGJvdHRvbSlcbiAgICAgICAgcy5zY3JvbGxCeSgtQVVUT1NDUk9MTF9MSU5FUylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG1heCA9IE1hdGgubWF4KDAsIHMuZ2V0U2Nyb2xsSGVpZ2h0KCkgLSBzLmdldFZpZXdwb3J0SGVpZ2h0KCkpXG4gICAgICAgIGlmIChzLmdldFNjcm9sbFRvcCgpID49IG1heCkge1xuICAgICAgICAgIHN0b3AoKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIC8vIFNjcm9sbGluZyBkb3duOiBjb250ZW50IG1vdmVzIHVwIGluIHZpZXdwb3J0LCBzbyBhbmNob3Igcm93IC1OLlxuICAgICAgICAvLyBDbGFtcCB0byBhY3R1YWwgc2Nyb2xsIGRpc3RhbmNlIHNvIGFuY2hvciBzdGF5cyBpbiBzeW5jIHdoZW4gbmVhclxuICAgICAgICAvLyB0aGUgYm90dG9tIGJvdW5kYXJ5IChyZW5kZXJlciBjbGFtcHMgc2Nyb2xsVG9wIHRvIG1heCBvbiBkcmFpbikuXG4gICAgICAgIGNvbnN0IGFjdHVhbCA9IE1hdGgubWluKEFVVE9TQ1JPTExfTElORVMsIG1heCAtIHMuZ2V0U2Nyb2xsVG9wKCkpXG4gICAgICAgIC8vIENhcHR1cmUgcm93cyBhYm91dCB0byBzY3JvbGwgb3V0IHRoZSBUT1AuXG4gICAgICAgIHNlbGVjdGlvbi5jYXB0dXJlU2Nyb2xsZWRSb3dzKHRvcCwgdG9wICsgYWN0dWFsIC0gMSwgJ2Fib3ZlJylcbiAgICAgICAgc2VsZWN0aW9uLnNoaWZ0QW5jaG9yKC1hY3R1YWwsIHRvcCwgYm90dG9tKVxuICAgICAgICBzLnNjcm9sbEJ5KEFVVE9TQ1JPTExfTElORVMpXG4gICAgICB9XG4gICAgICBvblNjcm9sbFJlZi5jdXJyZW50Py4oZmFsc2UsIHMpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc3RhcnQoZGlyOiAtMSB8IDEpOiB2b2lkIHtcbiAgICAgIC8vIFJlY29yZCBCRUZPUkUgZWFybHktcmV0dXJuOiB0aGUgZW1wdHktYWNjdW11bGF0b3IgcmVzZXQgaW4gY2hlY2soKVxuICAgICAgLy8gbWF5IGhhdmUgemVyb2VkIHRoaXMgZHVyaW5nIHRoZSBwcmUtY3Jvc3NpbmcgcGhhc2UgKGFjY3VtdWxhdG9yc1xuICAgICAgLy8gZW1wdHkgdW50aWwgdGhlIGFuY2hvciByb3cgZW50ZXJzIHRoZSBjYXB0dXJlIHJhbmdlKS4gUmUtcmVjb3JkXG4gICAgICAvLyBvbiBldmVyeSBjYWxsIHNvIHRoZSBjb3JydXB0aW9uIGlzIGluc3RhbnRseSBoZWFsZWQuXG4gICAgICBsYXN0U2Nyb2xsZWREaXJSZWYuY3VycmVudCA9IGRpclxuICAgICAgaWYgKGRpclJlZi5jdXJyZW50ID09PSBkaXIpIHJldHVybiAvLyBhbHJlYWR5IGdvaW5nIHRoaXMgd2F5XG4gICAgICBzdG9wKClcbiAgICAgIGRpclJlZi5jdXJyZW50ID0gZGlyXG4gICAgICB0aWNrc1JlZi5jdXJyZW50ID0gMFxuICAgICAgdGljaygpXG4gICAgICAvLyB0aWNrKCkgbWF5IGhhdmUgaGl0IGEgc2Nyb2xsIGJvdW5kYXJ5IGFuZCBjYWxsZWQgc3RvcCgpIChkaXIgcmVzZXQgdG9cbiAgICAgIC8vIDApLiBPbmx5IHN0YXJ0IHRoZSBpbnRlcnZhbCBpZiB3ZSdyZSBzdGlsbCBnb2luZyDigJQgb3RoZXJ3aXNlIHRoZVxuICAgICAgLy8gaW50ZXJ2YWwgd291bGQgcnVuIGZvcmV2ZXIgd2l0aCBkaXIgPT09IDAgZG9pbmcgbm90aGluZyB1c2VmdWwuXG4gICAgICBpZiAoZGlyUmVmLmN1cnJlbnQgPT09IGRpcikge1xuICAgICAgICB0aW1lclJlZi5jdXJyZW50ID0gc2V0SW50ZXJ2YWwodGljaywgQVVUT1NDUk9MTF9JTlRFUlZBTF9NUylcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZS1ldmFsdWF0ZWQgb24gZXZlcnkgc2VsZWN0aW9uIGNoYW5nZSAoc3RhcnQvZHJhZy9maW5pc2gvY2xlYXIpLlxuICAgIC8vIERyaXZlcyBkcmFnLXRvLXNjcm9sbCBhdXRvc2Nyb2xsIHdoZW4gdGhlIGRyYWcgbGVhdmVzIHRoZSB2aWV3cG9ydC5cbiAgICAvLyBQcmlvciB2ZXJzaW9ucyBicm9rZSBzdGlja3kgaGVyZSBvbiBkcmFnLXN0YXJ0IHRvIHByZXZlbnQgc2VsZWN0aW9uXG4gICAgLy8gZHJpZnQgZHVyaW5nIHN0cmVhbWluZyDigJQgaW5rLnRzeCBub3cgdHJhbnNsYXRlcyBzZWxlY3Rpb24gY29vcmRzIGJ5XG4gICAgLy8gdGhlIGZvbGxvdyBkZWx0YSBpbnN0ZWFkIChuYXRpdmUgdGVybWluYWwgYmVoYXZpb3I6IHZpZXcga2VlcHNcbiAgICAvLyBzY3JvbGxpbmcsIGhpZ2hsaWdodCB3YWxrcyB1cCB3aXRoIHRoZSB0ZXh0KS4gS2VlcGluZyBzdGlja3kgYWxzb1xuICAgIC8vIGF2b2lkcyB1c2VWaXJ0dWFsU2Nyb2xsJ3MgdGFpbC13YWxrIOKGkiBmb3J3YXJkLXdhbGsgcGhhbnRvbSBncm93dGguXG4gICAgZnVuY3Rpb24gY2hlY2soKTogdm9pZCB7XG4gICAgICBjb25zdCBzID0gc2Nyb2xsUmVmLmN1cnJlbnRcbiAgICAgIGlmICghcykge1xuICAgICAgICBzdG9wKClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBjb25zdCB0b3AgPSBzLmdldFZpZXdwb3J0VG9wKClcbiAgICAgIGNvbnN0IGJvdHRvbSA9IHRvcCArIHMuZ2V0Vmlld3BvcnRIZWlnaHQoKSAtIDFcbiAgICAgIGNvbnN0IHNlbCA9IHNlbGVjdGlvbi5nZXRTdGF0ZSgpXG4gICAgICAvLyBQYXNzIHRoZSBMQVNULXNjcm9sbGVkIGRpcmVjdGlvbiAobm90IGRpclJlZikgc28gdGhlIGFuY2hvciBndWFyZCBpc1xuICAgICAgLy8gYnlwYXNzZWQgYWZ0ZXIgc2hpZnRBbmNob3IgaGFzIGNsYW1wZWQgYW5jaG9yIHRvd2FyZCByb3cgMC4gVXNpbmdcbiAgICAgIC8vIGxhc3RTY3JvbGxlZERpclJlZiAoc3Vydml2ZXMgc3RvcCgpKSBsZXRzIGF1dG9zY3JvbGwgcmVzdW1lIGFmdGVyIGFcbiAgICAgIC8vIGJyaWVmIG1vdXNlIGRpcCBpbnRvIHRoZSB2aWV3cG9ydC4gU2FtZS1kaXJlY3Rpb24gb25seSDigJQgYSBtb3VzZVxuICAgICAgLy8ganVtcCBmcm9tIGJlbG93LWJvdHRvbSB0byBhYm92ZS10b3AgbXVzdCBzdG9wLCBzaW5jZSByZXZlcnNpbmcgd2hpbGVcbiAgICAgIC8vIHRoZSBzY3JvbGxlZE9mZkFib3ZlL0JlbG93IGFjY3VtdWxhdG9ycyBob2xkIHRoZSBwcmlvciBkaXJlY3Rpb24nc1xuICAgICAgLy8gcm93cyB3b3VsZCBkdXBsaWNhdGUgdGV4dCBpbiBnZXRTZWxlY3RlZFRleHQuIFJlc2V0IG9uIGRyYWctZmluaXNoXG4gICAgICAvLyBPUiB3aGVuIGJvdGggYWNjdW11bGF0b3JzIGFyZSBlbXB0eTogc3RhcnRTZWxlY3Rpb24gY2xlYXJzIHRoZW1cbiAgICAgIC8vIChzZWxlY3Rpb24udHMpLCBzbyBhIG5ldyBkcmFnIGFmdGVyIGEgbG9zdC1yZWxlYXNlIChpc0RyYWdnaW5nXG4gICAgICAvLyBzdHVjayB0cnVlLCB0aGUgcmVhc29uIEFVVE9TQ1JPTExfTUFYX1RJQ0tTIGV4aXN0cykgc3RpbGwgcmVzZXRzLlxuICAgICAgLy8gU2FmZTogc3RhcnQoKSBiZWxvdyByZS1yZWNvcmRzIGxhc3RTY3JvbGxlZERpclJlZiBiZWZvcmUgaXRzXG4gICAgICAvLyBlYXJseS1yZXR1cm4sIHNvIGEgbWlkLXNjcm9sbCByZXNldCBoZXJlIGlzIGluc3RhbnRseSB1bmRvbmUuXG4gICAgICBpZiAoXG4gICAgICAgICFzZWw/LmlzRHJhZ2dpbmcgfHxcbiAgICAgICAgKHNlbC5zY3JvbGxlZE9mZkFib3ZlLmxlbmd0aCA9PT0gMCAmJiBzZWwuc2Nyb2xsZWRPZmZCZWxvdy5sZW5ndGggPT09IDApXG4gICAgICApIHtcbiAgICAgICAgbGFzdFNjcm9sbGVkRGlyUmVmLmN1cnJlbnQgPSAwXG4gICAgICB9XG4gICAgICBjb25zdCBkaXIgPSBkcmFnU2Nyb2xsRGlyZWN0aW9uKFxuICAgICAgICBzZWwsXG4gICAgICAgIHRvcCxcbiAgICAgICAgYm90dG9tLFxuICAgICAgICBsYXN0U2Nyb2xsZWREaXJSZWYuY3VycmVudCxcbiAgICAgIClcbiAgICAgIGlmIChkaXIgPT09IDApIHtcbiAgICAgICAgLy8gQmxvY2tlZCByZXZlcnNhbDogZm9jdXMganVtcGVkIHRvIHRoZSBvcHBvc2l0ZSBlZGdlIChvZmYtd2luZG93XG4gICAgICAgIC8vIGRyYWcgcmV0dXJuLCBmYXN0IGZsaWNrKS4gaGFuZGxlU2VsZWN0aW9uRHJhZyBhbHJlYWR5IG1vdmVkIGZvY3VzXG4gICAgICAgIC8vIHBhc3QgdGhlIGFuY2hvciwgZmxpcHBpbmcgc2VsZWN0aW9uQm91bmRzIOKAlCB0aGUgYWNjdW11bGF0b3IgaXNcbiAgICAgICAgLy8gbm93IG9ycGhhbmVkIChob2xkcyByb3dzIG9uIHRoZSB3cm9uZyBzaWRlKS4gQ2xlYXIgaXQgc29cbiAgICAgICAgLy8gZ2V0U2VsZWN0ZWRUZXh0IG1hdGNoZXMgdGhlIHZpc2libGUgaGlnaGxpZ2h0LlxuICAgICAgICBpZiAobGFzdFNjcm9sbGVkRGlyUmVmLmN1cnJlbnQgIT09IDAgJiYgc2VsPy5mb2N1cykge1xuICAgICAgICAgIGNvbnN0IHdhbnQgPSBzZWwuZm9jdXMucm93IDwgdG9wID8gLTEgOiBzZWwuZm9jdXMucm93ID4gYm90dG9tID8gMSA6IDBcbiAgICAgICAgICBpZiAod2FudCAhPT0gMCAmJiB3YW50ICE9PSBsYXN0U2Nyb2xsZWREaXJSZWYuY3VycmVudCkge1xuICAgICAgICAgICAgc2VsLnNjcm9sbGVkT2ZmQWJvdmUgPSBbXVxuICAgICAgICAgICAgc2VsLnNjcm9sbGVkT2ZmQmVsb3cgPSBbXVxuICAgICAgICAgICAgc2VsLnNjcm9sbGVkT2ZmQWJvdmVTVyA9IFtdXG4gICAgICAgICAgICBzZWwuc2Nyb2xsZWRPZmZCZWxvd1NXID0gW11cbiAgICAgICAgICAgIGxhc3RTY3JvbGxlZERpclJlZi5jdXJyZW50ID0gMFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdG9wKClcbiAgICAgIH0gZWxzZSBzdGFydChkaXIpXG4gICAgfVxuXG4gICAgY29uc3QgdW5zdWJzY3JpYmUgPSBzZWxlY3Rpb24uc3Vic2NyaWJlKGNoZWNrKVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB1bnN1YnNjcmliZSgpXG4gICAgICBzdG9wKClcbiAgICAgIGxhc3RTY3JvbGxlZERpclJlZi5jdXJyZW50ID0gMFxuICAgIH1cbiAgfSwgW2lzQWN0aXZlLCBzY3JvbGxSZWYsIHNlbGVjdGlvbl0pXG59XG5cbi8qKlxuICogQ29tcHV0ZSBhdXRvc2Nyb2xsIGRpcmVjdGlvbiBmb3IgYSBkcmFnIHNlbGVjdGlvbiByZWxhdGl2ZSB0byB0aGUgU2Nyb2xsQm94XG4gKiB2aWV3cG9ydC4gUmV0dXJucyAwIHdoZW4gbm90IGRyYWdnaW5nLCBhbmNob3IvZm9jdXMgbWlzc2luZywgb3IgdGhlIGFuY2hvclxuICogaXMgb3V0c2lkZSB0aGUgdmlld3BvcnQg4oCUIGEgbXVsdGktY2xpY2sgb3IgZHJhZyB0aGF0IHN0YXJ0ZWQgaW4gdGhlIGlucHV0XG4gKiBhcmVhIG11c3Qgbm90IGNvbW1hbmRlZXIgdGhlIG1lc3NhZ2Ugc2Nyb2xsIChkb3VibGUtY2xpY2sgaW4gdGhlIGlucHV0IGFyZWFcbiAqIHdoaWxlIHNjcm9sbGVkIHVwIHByZXZpb3VzbHkgY29ycnVwdGVkIHRoZSBhbmNob3IgdmlhIHNoaWZ0QW5jaG9yIGFuZFxuICogc3B1cmlvdXNseSBzY3JvbGxlZCB0aGUgbWVzc2FnZSBoaXN0b3J5IGV2ZXJ5IDUwbXMgdW50aWwgcmVsZWFzZSkuXG4gKlxuICogYWxyZWFkeVNjcm9sbGluZ0RpciBieXBhc3NlcyB0aGUgYW5jaG9yLWluLXZpZXdwb3J0IGd1YXJkIG9uY2UgYXV0b3Njcm9sbFxuICogaXMgYWN0aXZlIChzaGlmdEFuY2hvciBsZWdpdGltYXRlbHkgY2xhbXBzIHRoZSBhbmNob3IgdG93YXJkIHJvdyAwLCBiZWxvd1xuICogYHRvcGApIGJ1dCBvbmx5IGFsbG93cyBTQU1FLWRpcmVjdGlvbiBjb250aW51YXRpb24uIElmIHRoZSBmb2N1cyBqdW1wcyB0b1xuICogdGhlIG9wcG9zaXRlIGVkZ2UgKGJlbG934oaSYWJvdmUgb3IgYWJvdmXihpJiZWxvdyDigJQgcG9zc2libGUgd2l0aCBhIGZhc3QgZmxpY2tcbiAqIG9yIG9mZi13aW5kb3cgZHJhZyBzaW5jZSBtb2RlIDEwMDIgcmVwb3J0cyBvbiBjZWxsIGNoYW5nZSwgbm90IHBlciBjZWxsKSxcbiAqIHJldHVybnMgMCB0byBzdG9wIOKAlCByZXZlcnNpbmcgd2l0aG91dCBjbGVhcmluZyBzY3JvbGxlZE9mZkFib3ZlL0JlbG93XG4gKiB3b3VsZCBkdXBsaWNhdGUgY2FwdHVyZWQgcm93cyB3aGVuIHRoZXkgc2Nyb2xsIGJhY2sgb24tc2NyZWVuLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZHJhZ1Njcm9sbERpcmVjdGlvbihcbiAgc2VsOiBTZWxlY3Rpb25TdGF0ZSB8IG51bGwsXG4gIHRvcDogbnVtYmVyLFxuICBib3R0b206IG51bWJlcixcbiAgYWxyZWFkeVNjcm9sbGluZ0RpcjogLTEgfCAwIHwgMSA9IDAsXG4pOiAtMSB8IDAgfCAxIHtcbiAgaWYgKCFzZWw/LmlzRHJhZ2dpbmcgfHwgIXNlbC5hbmNob3IgfHwgIXNlbC5mb2N1cykgcmV0dXJuIDBcbiAgY29uc3Qgcm93ID0gc2VsLmZvY3VzLnJvd1xuICBjb25zdCB3YW50OiAtMSB8IDAgfCAxID0gcm93IDwgdG9wID8gLTEgOiByb3cgPiBib3R0b20gPyAxIDogMFxuICBpZiAoYWxyZWFkeVNjcm9sbGluZ0RpciAhPT0gMCkge1xuICAgIC8vIFNhbWUtZGlyZWN0aW9uIG9ubHkuIEZvY3VzIG9uIHRoZSBvcHBvc2l0ZSBzaWRlLCBvciBiYWNrIGluc2lkZSB0aGVcbiAgICAvLyB2aWV3cG9ydCwgc3RvcHMgdGhlIHNjcm9sbCDigJQgY2FwdHVyZWQgcm93cyBzdGF5IGluIHNjcm9sbGVkT2ZmQWJvdmUvXG4gICAgLy8gQmVsb3cgYnV0IG5ldmVyIHNjcm9sbCBiYWNrIG9uLXNjcmVlbiwgc28gZ2V0U2VsZWN0ZWRUZXh0IGlzIGNvcnJlY3QuXG4gICAgcmV0dXJuIHdhbnQgPT09IGFscmVhZHlTY3JvbGxpbmdEaXIgPyB3YW50IDogMFxuICB9XG4gIC8vIEFuY2hvciBtdXN0IGJlIGluc2lkZSB0aGUgdmlld3BvcnQgZm9yIHVzIHRvIG93biB0aGlzIGRyYWcuIElmIHRoZVxuICAvLyB1c2VyIHN0YXJ0ZWQgc2VsZWN0aW5nIGluIHRoZSBpbnB1dCBib3ggb3IgaGVhZGVyLCBhdXRvc2Nyb2xsaW5nIHRoZVxuICAvLyBtZXNzYWdlIGhpc3RvcnkgaXMgc3VycHJpc2luZyBhbmQgY29ycnVwdHMgdGhlIGFuY2hvciB2aWEgc2hpZnRBbmNob3IuXG4gIGlmIChzZWwuYW5jaG9yLnJvdyA8IHRvcCB8fCBzZWwuYW5jaG9yLnJvdyA+IGJvdHRvbSkgcmV0dXJuIDBcbiAgcmV0dXJuIHdhbnRcbn1cblxuLy8gS2V5Ym9hcmQgcGFnZSBqdW1wczogc2Nyb2xsVG8oKSB3cml0ZXMgc2Nyb2xsVG9wIGRpcmVjdGx5IGFuZCBjbGVhcnNcbi8vIHBlbmRpbmdTY3JvbGxEZWx0YSDigJQgb25lIGZyYW1lLCBubyBkcmFpbi4gc2Nyb2xsQnkoKSBhY2N1bXVsYXRlcyBpbnRvXG4vLyBwZW5kaW5nU2Nyb2xsRGVsdGEgd2hpY2ggdGhlIHJlbmRlcmVyIGRyYWlucyBvdmVyIHNldmVyYWwgZnJhbWVzXG4vLyAocmVuZGVyLW5vZGUtdG8tb3V0cHV0LnRzIGRyYWluUHJvcG9ydGlvbmFsL2RyYWluQWRhcHRpdmUpIOKAlCBjb3JyZWN0IGZvclxuLy8gd2hlZWwgc21vb3RobmVzcywgd3JvbmcgZm9yIFBnVXAvY3RybCt1IHdoZXJlIHRoZSB1c2VyIGV4cGVjdHMgYSBzbmFwLlxuLy8gVGFyZ2V0IGlzIHJlbGF0aXZlIHRvIHNjcm9sbFRvcCtwZW5kaW5nRGVsdGEgc28gYSBqdW1wIG1pZC13aGVlbC1idXJzdFxuLy8gbGFuZHMgd2hlcmUgdGhlIHdoZWVsIHdhcyBoZWFkaW5nLlxuZXhwb3J0IGZ1bmN0aW9uIGp1bXBCeShzOiBTY3JvbGxCb3hIYW5kbGUsIGRlbHRhOiBudW1iZXIpOiBib29sZWFuIHtcbiAgY29uc3QgbWF4ID0gTWF0aC5tYXgoMCwgcy5nZXRTY3JvbGxIZWlnaHQoKSAtIHMuZ2V0Vmlld3BvcnRIZWlnaHQoKSlcbiAgY29uc3QgdGFyZ2V0ID0gcy5nZXRTY3JvbGxUb3AoKSArIHMuZ2V0UGVuZGluZ0RlbHRhKCkgKyBkZWx0YVxuICBpZiAodGFyZ2V0ID49IG1heCkge1xuICAgIC8vIEVhZ2VyLXdyaXRlIHNjcm9sbFRvcCBzbyBmb2xsb3ctc2Nyb2xsIHNlZXMgZm9sbG93RGVsdGE9MC4gQ2FsbGVyc1xuICAgIC8vIHRoYXQgcmFuIHRyYW5zbGF0ZVNlbGVjdGlvbkZvckp1bXAgYWxyZWFkeSBzaGlmdGVkOyBzY3JvbGxUb0JvdHRvbSgpXG4gICAgLy8gYWxvbmUgd291bGQgZG91YmxlLXNoaWZ0IHZpYSB0aGUgcmVuZGVyLXBoYXNlIHN0aWNreSBmb2xsb3cuXG4gICAgcy5zY3JvbGxUbyhtYXgpXG4gICAgcy5zY3JvbGxUb0JvdHRvbSgpXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICBzLnNjcm9sbFRvKE1hdGgubWF4KDAsIHRhcmdldCkpXG4gIHJldHVybiBmYWxzZVxufVxuXG4vLyBXaGVlbC1kb3duIHBhc3QgbWF4U2Nyb2xsIHJlLWVuYWJsZXMgc3RpY2t5IHNvIHdoZWVsaW5nIGF0IHRoZSBib3R0b21cbi8vIG5hdHVyYWxseSByZS1waW5zIChtYXRjaGVzIHR5cGljYWwgY2hhdC1hcHAgYmVoYXZpb3IpLiBSZXR1cm5zIHRoZVxuLy8gcmVzdWx0aW5nIHN0aWNreSBzdGF0ZSBzbyBjYWxsZXJzIGNhbiBwcm9wYWdhdGUgaXQuXG5mdW5jdGlvbiBzY3JvbGxEb3duKHM6IFNjcm9sbEJveEhhbmRsZSwgYW1vdW50OiBudW1iZXIpOiBib29sZWFuIHtcbiAgY29uc3QgbWF4ID0gTWF0aC5tYXgoMCwgcy5nZXRTY3JvbGxIZWlnaHQoKSAtIHMuZ2V0Vmlld3BvcnRIZWlnaHQoKSlcbiAgLy8gSW5jbHVkZSBwZW5kaW5nRGVsdGE6IHNjcm9sbEJ5IGFjY3VtdWxhdGVzIGludG8gcGVuZGluZ1Njcm9sbERlbHRhXG4gIC8vIHdpdGhvdXQgdXBkYXRpbmcgc2Nyb2xsVG9wLCBzbyBnZXRTY3JvbGxUb3AoKSBhbG9uZSBpcyBzdGFsZSB3aXRoaW5cbiAgLy8gYSBiYXRjaCBvZiB3aGVlbCBldmVudHMuIFdpdGhvdXQgdGhpcywgd2hlZWxpbmcgdG8gdGhlIGJvdHRvbSBuZXZlclxuICAvLyByZS1lbmFibGVzIHN0aWNreSBzY3JvbGwuXG4gIGNvbnN0IGVmZmVjdGl2ZVRvcCA9IHMuZ2V0U2Nyb2xsVG9wKCkgKyBzLmdldFBlbmRpbmdEZWx0YSgpXG4gIGlmIChlZmZlY3RpdmVUb3AgKyBhbW91bnQgPj0gbWF4KSB7XG4gICAgcy5zY3JvbGxUb0JvdHRvbSgpXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICBzLnNjcm9sbEJ5KGFtb3VudClcbiAgcmV0dXJuIGZhbHNlXG59XG5cbi8vIFdoZWVsLXVwIHBhc3Qgc2Nyb2xsVG9wPTAgY2xhbXBzIHZpYSBzY3JvbGxUbygwKSwgY2xlYXJpbmdcbi8vIHBlbmRpbmdTY3JvbGxEZWx0YSBzbyBhZ2dyZXNzaXZlIHdoZWVsIGJ1cnN0cyAoZS5nLiBNWCBNYXN0ZXIgZnJlZS1zcGluKVxuLy8gZG9uJ3QgYWNjdW11bGF0ZSBhbiB1bmJvdW5kZWQgbmVnYXRpdmUgZGVsdGEuIFdpdGhvdXQgdGhpcyBjbGFtcCxcbi8vIHVzZVZpcnR1YWxTY3JvbGwncyBbZWZmTG8sIGVmZkhpXSBzcGFuIGdyb3dzIHBhc3Qgd2hhdCBNQVhfTU9VTlRFRF9JVEVNU1xuLy8gY2FuIGNvdmVyIGFuZCBpbnRlcm1lZGlhdGUgZHJhaW4gZnJhbWVzIHJlbmRlciBhdCBzY3JvbGxUb3BzIHdpdGggbm9cbi8vIG1vdW50ZWQgY2hpbGRyZW4g4oCUIGJsYW5rIHZpZXdwb3J0LlxuZXhwb3J0IGZ1bmN0aW9uIHNjcm9sbFVwKHM6IFNjcm9sbEJveEhhbmRsZSwgYW1vdW50OiBudW1iZXIpOiB2b2lkIHtcbiAgLy8gSW5jbHVkZSBwZW5kaW5nRGVsdGE6IHNjcm9sbEJ5IGFjY3VtdWxhdGVzIHdpdGhvdXQgdXBkYXRpbmcgc2Nyb2xsVG9wLFxuICAvLyBzbyBnZXRTY3JvbGxUb3AoKSBhbG9uZSBpcyBzdGFsZSB3aXRoaW4gYSBiYXRjaCBvZiB3aGVlbCBldmVudHMuXG4gIGNvbnN0IGVmZmVjdGl2ZVRvcCA9IHMuZ2V0U2Nyb2xsVG9wKCkgKyBzLmdldFBlbmRpbmdEZWx0YSgpXG4gIGlmIChlZmZlY3RpdmVUb3AgLSBhbW91bnQgPD0gMCkge1xuICAgIHMuc2Nyb2xsVG8oMClcbiAgICByZXR1cm5cbiAgfVxuICBzLnNjcm9sbEJ5KC1hbW91bnQpXG59XG5cbmV4cG9ydCB0eXBlIE1vZGFsUGFnZXJBY3Rpb24gPVxuICB8ICdsaW5lVXAnXG4gIHwgJ2xpbmVEb3duJ1xuICB8ICdoYWxmUGFnZVVwJ1xuICB8ICdoYWxmUGFnZURvd24nXG4gIHwgJ2Z1bGxQYWdlVXAnXG4gIHwgJ2Z1bGxQYWdlRG93bidcbiAgfCAndG9wJ1xuICB8ICdib3R0b20nXG5cbi8qKlxuICogTWFwcyBhIGtleXN0cm9rZSB0byBhIG1vZGFsIHBhZ2VyIGFjdGlvbi4gRXhwb3J0ZWQgZm9yIHRlc3RpbmcuXG4gKiBSZXR1cm5zIG51bGwgZm9yIGtleXMgdGhlIG1vZGFsIHBhZ2VyIGRvZXNuJ3QgaGFuZGxlICh0aGV5IGZhbGwgdGhyb3VnaCkuXG4gKlxuICogY3RybCt1L2QvYi9mIGFyZSB0aGUgbGVzcy1saW5lYWdlIGJpbmRpbmdzLiBnL0cgYXJlIGJhcmUgbGV0dGVycyAob25seVxuICogc2FmZSB3aGVuIG5vIHByb21wdCBpcyBtb3VudGVkKS4gRyBhcnJpdmVzIGFzIGlucHV0PSdHJyBzaGlmdD1mYWxzZSBvblxuICogbGVnYWN5IHRlcm1pbmFscywgb3IgaW5wdXQ9J2cnIHNoaWZ0PXRydWUgb24ga2l0dHktcHJvdG9jb2wgdGVybWluYWxzLlxuICogTG93ZXJjYXNlIGcgbmVlZHMgdGhlICFzaGlmdCBndWFyZCBzbyBpdCBkb2Vzbid0IGFsc28gbWF0Y2gga2l0dHktRy5cbiAqXG4gKiBLZXktcmVwZWF0OiBzdGRpbiBjb2FsZXNjZXMgaGVsZC1kb3duIHByaW50YWJsZXMgaW50byBvbmUgbXVsdGktY2hhclxuICogc3RyaW5nIChlLmcuICdnZ2cnKS4gT25seSB1bmlmb3JtLWNoYXIgYmF0Y2hlcyBhcmUgaGFuZGxlZCDigJQgbWl4ZWQgaW5wdXRcbiAqIGxpa2UgJ2dHJyBpc24ndCBrZXktcmVwZWF0LiBnL0cgYXJlIGlkZW1wb3RlbnQgYWJzb2x1dGUganVtcHMsIHNvIHRoZVxuICogY291bnQgaXMgaXJyZWxldmFudCAoY29uc3VtaW5nIHRoZSBiYXRjaCBqdXN0IHByZXZlbnRzIGl0IGZyb20gbGVha2luZ1xuICogdG8gdGhlIHNlbGVjdGlvbi1jbGVhci1vbi1wcmludGFibGUgaGFuZGxlcikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtb2RhbFBhZ2VyQWN0aW9uKFxuICBpbnB1dDogc3RyaW5nLFxuICBrZXk6IFBpY2s8XG4gICAgS2V5LFxuICAgICdjdHJsJyB8ICdtZXRhJyB8ICdzaGlmdCcgfCAndXBBcnJvdycgfCAnZG93bkFycm93JyB8ICdob21lJyB8ICdlbmQnXG4gID4sXG4pOiBNb2RhbFBhZ2VyQWN0aW9uIHwgbnVsbCB7XG4gIGlmIChrZXkubWV0YSkgcmV0dXJuIG51bGxcbiAgLy8gU3BlY2lhbCBrZXlzIGZpcnN0IOKAlCBhcnJvd3MvaG9tZS9lbmQgYXJyaXZlIHdpdGggZW1wdHkgb3IganVuayBpbnB1dCxcbiAgLy8gc28gdGhlc2UgbXVzdCBiZSBjaGVja2VkIGJlZm9yZSBhbnkgaW5wdXQtc3RyaW5nIGxvZ2ljLiBzaGlmdCBpc1xuICAvLyByZXNlcnZlZCBmb3Igc2VsZWN0aW9uLWV4dGVuZCAoc2VsZWN0aW9uRm9jdXNNb3ZlRm9yS2V5KTsgY3RybCtob21lL2VuZFxuICAvLyBhbHJlYWR5IGhhcyBhIHVzZUtleWJpbmRpbmdzIHJvdXRlIHRvIHNjcm9sbDp0b3AvYm90dG9tLlxuICBpZiAoIWtleS5jdHJsICYmICFrZXkuc2hpZnQpIHtcbiAgICBpZiAoa2V5LnVwQXJyb3cpIHJldHVybiAnbGluZVVwJ1xuICAgIGlmIChrZXkuZG93bkFycm93KSByZXR1cm4gJ2xpbmVEb3duJ1xuICAgIGlmIChrZXkuaG9tZSkgcmV0dXJuICd0b3AnXG4gICAgaWYgKGtleS5lbmQpIHJldHVybiAnYm90dG9tJ1xuICB9XG4gIGlmIChrZXkuY3RybCkge1xuICAgIGlmIChrZXkuc2hpZnQpIHJldHVybiBudWxsXG4gICAgc3dpdGNoIChpbnB1dCkge1xuICAgICAgY2FzZSAndSc6XG4gICAgICAgIHJldHVybiAnaGFsZlBhZ2VVcCdcbiAgICAgIGNhc2UgJ2QnOlxuICAgICAgICByZXR1cm4gJ2hhbGZQYWdlRG93bidcbiAgICAgIGNhc2UgJ2InOlxuICAgICAgICByZXR1cm4gJ2Z1bGxQYWdlVXAnXG4gICAgICBjYXNlICdmJzpcbiAgICAgICAgcmV0dXJuICdmdWxsUGFnZURvd24nXG4gICAgICAvLyBlbWFjcy1zdHlsZSBsaW5lIHNjcm9sbCAobGVzcyBhY2NlcHRzIGJvdGggY3RybCtuL3AgYW5kIGN0cmwrZS95KS5cbiAgICAgIC8vIFdvcmtzIGR1cmluZyBzZWFyY2ggbmF2IOKAlCBmaW5lLWFkanVzdCBhZnRlciBhIGp1bXAgd2l0aG91dFxuICAgICAgLy8gbGVhdmluZyBtb2RhbC4gTm8gIXNlYXJjaE9wZW4gZ2F0ZSBvbiB0aGlzIHVzZUlucHV0J3MgaXNBY3RpdmUuXG4gICAgICBjYXNlICduJzpcbiAgICAgICAgcmV0dXJuICdsaW5lRG93bidcbiAgICAgIGNhc2UgJ3AnOlxuICAgICAgICByZXR1cm4gJ2xpbmVVcCdcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICB9XG4gIC8vIEJhcmUgbGV0dGVycy4gS2V5LXJlcGVhdCBiYXRjaGVzOiBvbmx5IGFjdCBvbiB1bmlmb3JtIHJ1bnMuXG4gIGNvbnN0IGMgPSBpbnB1dFswXVxuICBpZiAoIWMgfHwgaW5wdXQgIT09IGMucmVwZWF0KGlucHV0Lmxlbmd0aCkpIHJldHVybiBudWxsXG4gIC8vIGtpdHR5IHNlbmRzIEcgYXMgaW5wdXQ9J2cnIHNoaWZ0PXRydWU7IGxlZ2FjeSBhcyAnRycgc2hpZnQ9ZmFsc2UuXG4gIC8vIENoZWNrIEJFRk9SRSB0aGUgc2hpZnQtZ2F0ZSBzbyBib3RoIGhpdCAnYm90dG9tJy5cbiAgaWYgKGMgPT09ICdHJyB8fCAoYyA9PT0gJ2cnICYmIGtleS5zaGlmdCkpIHJldHVybiAnYm90dG9tJ1xuICBpZiAoa2V5LnNoaWZ0KSByZXR1cm4gbnVsbFxuICBzd2l0Y2ggKGMpIHtcbiAgICBjYXNlICdnJzpcbiAgICAgIHJldHVybiAndG9wJ1xuICAgIC8vIGovayByZS1hZGRlZCBwZXIgVG9tIE1hciAxOCDigJQgcmV2ZXJzYWwgb2YgTWFyIDE2IHJlbW92YWwuIFdvcmtzXG4gICAgLy8gZHVyaW5nIHNlYXJjaCBuYXYgKGZpbmUtYWRqdXN0IGFmdGVyIG4vTiBsYW5kcykgc2luY2UgaXNNb2RhbCBpc1xuICAgIC8vIGluZGVwZW5kZW50IG9mIHNlYXJjaE9wZW4uXG4gICAgY2FzZSAnaic6XG4gICAgICByZXR1cm4gJ2xpbmVEb3duJ1xuICAgIGNhc2UgJ2snOlxuICAgICAgcmV0dXJuICdsaW5lVXAnXG4gICAgLy8gbGVzczogc3BhY2UgPSBwYWdlIGRvd24sIGIgPSBwYWdlIHVwLiBjdHJsK2IgYWxyZWFkeSBtYXBzIGFib3ZlO1xuICAgIC8vIGJhcmUgYiBpcyB0aGUgbGVzcy1uYXRpdmUgdmVyc2lvbi5cbiAgICBjYXNlICcgJzpcbiAgICAgIHJldHVybiAnZnVsbFBhZ2VEb3duJ1xuICAgIGNhc2UgJ2InOlxuICAgICAgcmV0dXJuICdmdWxsUGFnZVVwJ1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbFxuICB9XG59XG5cbi8qKlxuICogQXBwbGllcyBhIG1vZGFsIHBhZ2VyIGFjdGlvbiB0byBhIFNjcm9sbEJveC4gUmV0dXJucyB0aGUgcmVzdWx0aW5nIHN0aWNreVxuICogc3RhdGUsIG9yIG51bGwgaWYgdGhlIGFjdGlvbiB3YXMgbnVsbCAobm90aGluZyB0byBkbyDigJQgY2FsbGVyIHNob3VsZCBmYWxsXG4gKiB0aHJvdWdoKS4gQ2FsbHMgb25CZWZvcmVKdW1wKGRlbHRhKSBiZWZvcmUgc2Nyb2xsaW5nIHNvIHRoZSBjYWxsZXIgY2FuXG4gKiB0cmFuc2xhdGUgdGhlIHRleHQgc2VsZWN0aW9uIGJ5IHRoZSBzY3JvbGwgZGVsdGEgKGNhcHR1cmUgb3V0Z29pbmcgcm93cyxcbiAqIHNoaWZ0IGFuY2hvcitmb2N1cykgaW5zdGVhZCBvZiBjbGVhcmluZyBpdC4gRXhwb3J0ZWQgZm9yIHRlc3RpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseU1vZGFsUGFnZXJBY3Rpb24oXG4gIHM6IFNjcm9sbEJveEhhbmRsZSxcbiAgYWN0OiBNb2RhbFBhZ2VyQWN0aW9uIHwgbnVsbCxcbiAgb25CZWZvcmVKdW1wOiAoZGVsdGE6IG51bWJlcikgPT4gdm9pZCxcbik6IGJvb2xlYW4gfCBudWxsIHtcbiAgc3dpdGNoIChhY3QpIHtcbiAgICBjYXNlIG51bGw6XG4gICAgICByZXR1cm4gbnVsbFxuICAgIGNhc2UgJ2xpbmVVcCc6XG4gICAgY2FzZSAnbGluZURvd24nOiB7XG4gICAgICBjb25zdCBkID0gYWN0ID09PSAnbGluZURvd24nID8gMSA6IC0xXG4gICAgICBvbkJlZm9yZUp1bXAoZClcbiAgICAgIHJldHVybiBqdW1wQnkocywgZClcbiAgICB9XG4gICAgY2FzZSAnaGFsZlBhZ2VVcCc6XG4gICAgY2FzZSAnaGFsZlBhZ2VEb3duJzoge1xuICAgICAgY29uc3QgaGFsZiA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3Iocy5nZXRWaWV3cG9ydEhlaWdodCgpIC8gMikpXG4gICAgICBjb25zdCBkID0gYWN0ID09PSAnaGFsZlBhZ2VEb3duJyA/IGhhbGYgOiAtaGFsZlxuICAgICAgb25CZWZvcmVKdW1wKGQpXG4gICAgICByZXR1cm4ganVtcEJ5KHMsIGQpXG4gICAgfVxuICAgIGNhc2UgJ2Z1bGxQYWdlVXAnOlxuICAgIGNhc2UgJ2Z1bGxQYWdlRG93bic6IHtcbiAgICAgIGNvbnN0IHBhZ2UgPSBNYXRoLm1heCgxLCBzLmdldFZpZXdwb3J0SGVpZ2h0KCkpXG4gICAgICBjb25zdCBkID0gYWN0ID09PSAnZnVsbFBhZ2VEb3duJyA/IHBhZ2UgOiAtcGFnZVxuICAgICAgb25CZWZvcmVKdW1wKGQpXG4gICAgICByZXR1cm4ganVtcEJ5KHMsIGQpXG4gICAgfVxuICAgIGNhc2UgJ3RvcCc6XG4gICAgICBvbkJlZm9yZUp1bXAoLShzLmdldFNjcm9sbFRvcCgpICsgcy5nZXRQZW5kaW5nRGVsdGEoKSkpXG4gICAgICBzLnNjcm9sbFRvKDApXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICBjYXNlICdib3R0b20nOiB7XG4gICAgICBjb25zdCBtYXggPSBNYXRoLm1heCgwLCBzLmdldFNjcm9sbEhlaWdodCgpIC0gcy5nZXRWaWV3cG9ydEhlaWdodCgpKVxuICAgICAgb25CZWZvcmVKdW1wKG1heCAtIChzLmdldFNjcm9sbFRvcCgpICsgcy5nZXRQZW5kaW5nRGVsdGEoKSkpXG4gICAgICAvLyBFYWdlci13cml0ZSBzY3JvbGxUb3AgYmVmb3JlIHNjcm9sbFRvQm90dG9tIOKAlCBzYW1lIGRvdWJsZS1zaGlmdFxuICAgICAgLy8gZml4IGFzIHNjcm9sbDpib3R0b20gYW5kIGp1bXBCeSdzIG1heCBicmFuY2guXG4gICAgICBzLnNjcm9sbFRvKG1heClcbiAgICAgIHMuc2Nyb2xsVG9Cb3R0b20oKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsT0FBT0EsS0FBSyxJQUFJLEtBQUtDLFNBQVMs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