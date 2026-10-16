import { feature } from 'bun:bundle';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNotifications } from '../context/notifications.js';
import { useIsModalOverlayActive } from '../context/overlayContext.js';
import { useGetVoiceState, useSetVoiceState, useVoiceState } from '../context/voice.js';
import { KeyboardEvent } from '../ink/events/keyboard-event.js';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- backward-compat bridge until REPL wires handleKeyDown to <Box onKeyDown>
import { useInput } from '../ink.js';
import { useOptionalKeybindingContext } from '../keybindings/KeybindingContext.js';
import { keystrokesEqual } from '../keybindings/resolver.js';
import type { ParsedKeystroke } from '../keybindings/types.js';
import { normalizeFullWidthSpace } from '../utils/stringUtils.js';
import { useVoiceEnabled } from './useVoiceEnabled.js';

// Dead code elimination: conditional import for voice input hook.
/* eslint-disable @typescript-eslint/no-require-imports */
// Capture the module namespace, not the function: spyOn() mutates the module
// object, so `voiceNs.useVoice(...)` resolves to the spy even if this module
// was loaded before the spy was installed (test ordering independence).
const voiceNs: {
  useVoice: typeof import('./useVoice.js').useVoice;
} = feature('VOICE_MODE') ? require('./useVoice.js') : {
  useVoice: ({
    enabled: _e
  }: {
    onTranscript: (t: string) => void;
    enabled: boolean;
  }) => ({
    state: 'idle' as const,
    handleKeyEvent: (_fallbackMs?: number) => {}
  })
};
/* eslint-enable @typescript-eslint/no-require-imports */

// Maximum gap (ms) between key presses to count as held (auto-repeat).
// Terminal auto-repeat fires every 30-80ms; 120ms covers jitter while
// excluding normal typing speed (100-300ms between keystrokes).
const RAPID_KEY_GAP_MS = 120;

// Fallback (ms) for modifier-combo first-press activation. Must match
// FIRST_PRESS_FALLBACK_MS in useVoice.ts. Covers the max OS initial
// key-repeat delay (~2s on macOS with slider at "Long") so holding a
// modifier combo doesn't fragment into two sessions when the first
// auto-repeat arrives after the default 600ms REPEAT_FALLBACK_MS.
const MODIFIER_FIRST_PRESS_FALLBACK_MS = 2000;

// Number of rapid consecutive key events required to activate voice.
// Only applies to bare-char bindings (space, v, etc.) where a single press
// could be normal typing. Modifier combos activate on the first press.
const HOLD_THRESHOLD = 5;

// Number of rapid key events to start showing warmup feedback.
const WARMUP_THRESHOLD = 2;

// Match a KeyboardEvent against a ParsedKeystroke. Replaces the legacy
// matchesKeystroke(input, Key, ...) path which assumed useInput's raw
// `input` arg — KeyboardEvent.key holds normalized names (e.g. 'space',
// 'f9') that getKeyName() didn't handle, so modifier combos and f-keys
// silently failed to match after the onKeyDown migration (#23524).
function matchesKeyboardEvent(e: KeyboardEvent, target: ParsedKeystroke): boolean {
  // KeyboardEvent stores key names; ParsedKeystroke stores ' ' for space
  // and 'enter' for return (see parser.ts case 'space'/'return').
  const key = e.key === 'space' ? ' ' : e.key === 'return' ? 'enter' : e.key.toLowerCase();
  if (key !== target.key) return false;
  if (e.ctrl !== target.ctrl) return false;
  if (e.shift !== target.shift) return false;
  // KeyboardEvent.meta folds alt|option (terminal limitation — esc-prefix);
  // ParsedKeystroke has both alt and meta as aliases for the same thing.
  if (e.meta !== (target.alt || target.meta)) return false;
  if (e.superKey !== target.super) return false;
  return true;
}

// Hardcoded default for when there's no KeybindingProvider at all (e.g.
// headless/test contexts). NOT used when the provider exists and the
// lookup returns null — that means the user null-unbound or reassigned
// space, and falling back to space would pick a dead or conflicting key.
const DEFAULT_VOICE_KEYSTROKE: ParsedKeystroke = {
  key: ' ',
  ctrl: false,
  alt: false,
  shift: false,
  meta: false,
  super: false
};
type InsertTextHandle = {
  insert: (text: string) => void;
  setInputWithCursor: (value: string, cursor: number) => void;
  cursorOffset: number;
};
type UseVoiceIntegrationArgs = {
  setInputValueRaw: React.Dispatch<React.SetStateAction<string>>;
  inputValueRef: React.RefObject<string>;
  insertTextRef: React.RefObject<InsertTextHandle | null>;
};
type InterimRange = {
  start: number;
  end: number;
};
type StripOpts = {
  // Which char to strip (the configured hold key). Defaults to space.
  char?: string;
  // Capture the voice prefix/suffix anchor at the stripped position.
  anchor?: boolean;
  // Minimum trailing count to leave behind — prevents stripping the
  // intentional warmup chars when defensively cleaning up leaks.
  floor?: number;
};
type UseVoiceIntegrationResult = {
  // Returns the number of trailing chars remaining after stripping.
  stripTrailing: (maxStrip: number, opts?: StripOpts) => number;
  // Undo the gap space and reset anchor refs after a failed voice activation.
  resetAnchor: () => void;
  handleKeyEvent: (fallbackMs?: number) => void;
  interimRange: InterimRange | null;
};
export function useVoiceIntegration({
  setInputValueRaw,
  inputValueRef,
  insertTextRef
}: UseVoiceIntegrationArgs): UseVoiceIntegrationResult {
  const {
    addNotification
  } = useNotifications();

  // Tracks the input content before/after the cursor when voice starts,
  // so interim transcripts can be inserted at the cursor position without
  // clobbering surrounding user text.
  const voicePrefixRef = useRef<string | null>(null);
  const voiceSuffixRef = useRef<string>('');
  // Tracks the last input value this hook wrote (via anchor, interim effect,
  // or handleVoiceTranscript). If inputValueRef.current diverges, the user
  // submitted or edited — both write paths bail to avoid clobbering. This is
  // the only guard that correctly handles empty-prefix-empty-suffix: a
  // startsWith('')/endsWith('') check vacuously passes, and a length check
  // can't distinguish a cleared input from a never-set one.
  const lastSetInputRef = useRef<string | null>(null);

  // Strip trailing hold-key chars (and optionally capture the voice
  // anchor). Called during warmup (to clean up chars that leaked past
  // stopImmediatePropagation — listener order is not guaranteed) and
  // on activation (with anchor=true to capture the prefix/suffix around
  // the cursor for interim transcript placement). The caller passes the
  // exact count it expects to strip so pre-existing chars at the
  // boundary are preserved (e.g. the "v" in "hav" when hold-key is "v").
  // The floor option sets a minimum trailing count to leave behind
  // (during warmup this is the count we intentionally let through, so
  // defensive cleanup only removes leaks). Returns the number of
  // trailing chars remaining after stripping. When nothing changes, no
  // state update is performed.
  const stripTrailing = useCallback((maxStrip: number, {
    char = ' ',
    anchor = false,
    floor = 0
  }: StripOpts = {}) => {
    const prev = inputValueRef.current;
    const offset = insertTextRef.current?.cursorOffset ?? prev.length;
    const beforeCursor = prev.slice(0, offset);
    const afterCursor = prev.slice(offset);
    // When the hold key is space, also count full-width spaces (U+3000)
    // that a CJK IME may have inserted for the same physical key.
    // U+3000 is BMP single-code-unit so indices align with beforeCursor.
    const scan = char === ' ' ? normalizeFullWidthSpace(beforeCursor) : beforeCursor;
    let trailing = 0;
    while (trailing < scan.length && scan[scan.length - 1 - trailing] === char) {
      trailing++;
    }
    const stripCount = Math.max(0, Math.min(trailing - floor, maxStrip));
    const remaining = trailing - stripCount;
    const stripped = beforeCursor.slice(0, beforeCursor.length - stripCount);
    // When anchoring with a non-space suffix, insert a gap space so the
    // waveform cursor sits on the gap instead of covering the first
    // suffix letter. The interim transcript effect maintains this same
    // structure (prefix + leading + interim + trailing + suffix), so
    // the gap is seamless once transcript text arrives.
    // Always overwrite on anchor — if a prior activation failed to start
    // voice (voiceState stayed 'idle'), the cleanup effect didn't fire and
    // the old anchor is stale. anchor=true is only passed on the single
    // activation call, never during recording, so overwrite is safe.
    let gap = '';
    if (anchor) {
      voicePrefixRef.current = stripped;
      voiceSuffixRef.current = afterCursor;
      if (afterCursor.length > 0 && !/^\s/.test(afterCursor)) {
        gap = ' ';
      }
    }
    const newValue = stripped + gap + afterCursor;
    if (anchor) lastSetInputRef.current = newValue;
    if (newValue === prev && stripCount === 0) return remaining;
    if (insertTextRef.current) {
      insertTextRef.current.setInputWithCursor(newValue, stripped.length);
    } else {
      setInputValueRaw(newValue);
    }
    return remaining;
  }, [setInputValueRaw, inputValueRef, insertTextRef]);

  // Undo the gap space inserted by stripTrailing(..., {anchor:true}) and
  // reset the voice prefix/suffix refs. Called when voice activation fails
  // (voiceState stays 'idle' after voiceHandleKeyEvent), so the cleanup
  // effect (voiceState useEffect below) — which only fires on voiceState transitions — can't
  // reach the stale anchor. Without this, the gap space and stale refs
  // persist in the input.
  const resetAnchor = useCallback(() => {
    const prefix = voicePrefixRef.current;
    if (prefix === null) return;
    const suffix = voiceSuffixRef.current;
    voicePrefixRef.current = null;
    voiceSuffixRef.current = '';
    const restored = prefix + suffix;
    if (insertTextRef.current) {
      insertTextRef.current.setInputWithCursor(restored, prefix.length);
    } else {
      setInputValueRaw(restored);
    }
  }, [setInputValueRaw, insertTextRef]);

  // Voice state selectors. useVoiceEnabled = user intent (settings) +
  // auth + GB kill-switch, with the auth half memoized on authVersion so
  // render loops never hit a cold keychain spawn.
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const voiceEnabled = feature('VOICE_MODE') ? useVoiceEnabled() : false;
  const voiceState = feature('VOICE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useVoiceState(s => s.voiceState) : 'idle' as const;
  const voiceInterimTranscript = feature('VOICE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useVoiceState(s_0 => s_0.voiceInterimTranscript) : '';

  // Set the voice anchor for focus mode (where recording starts via terminal
  // focus, not key hold). Key-hold sets the anchor in stripTrailing.
  useEffect(() => {
    if (!feature('VOICE_MODE')) return;
    if (voiceState === 'recording' && voicePrefixRef.current === null) {
      const input = inputValueRef.current;
      const offset_0 = insertTextRef.current?.cursorOffset ?? input.length;
      voicePrefixRef.current = input.slice(0, offset_0);
      voiceSuffixRef.current = input.slice(offset_0);
      lastSetInputRef.current = input;
    }
    if (voiceState === 'idle') {
      voicePrefixRef.current = null;
      voiceSuffixRef.current = '';
      lastSetInputRef.current = null;
    }
  }, [voiceState, inputValueRef, insertTextRef]);

  // Live-update the prompt input with the interim transcript as voice
  // transcribes speech. The prefix (user-typed text before the cursor) is
  // preserved and the transcript is inserted between prefix and suffix.
  useEffect(() => {
    if (!feature('VOICE_MODE')) return;
    if (voicePrefixRef.current === null) return;
    const prefix_0 = voicePrefixRef.current;
    const suffix_0 = voiceSuffixRef.current;
    // Submit race: if the input isn't what this hook last set it to, the
    // user submitted (clearing it) or edited it. voicePrefixRef is only
    // cleared on voiceState→idle, so it's still set during the 'processing'
    // window between CloseStream and WS close — this catches refined
    // TranscriptText arriving then and re-filling a cleared input.
    if (inputValueRef.current !== lastSetInputRef.current) return;
    const needsSpace = prefix_0.length > 0 && !/\s$/.test(prefix_0) && voiceInterimTranscript.length > 0;
    // Don't gate on voiceInterimTranscript.length -- when interim clears to ''
    // after handleVoiceTranscript sets the final text, the trailing space
    // between prefix and suffix must still be preserved.
    const needsTrailingSpace = suffix_0.length > 0 && !/^\s/.test(suffix_0);
    const leadingSpace = needsSpace ? ' ' : '';
    const trailingSpace = needsTrailingSpace ? ' ' : '';
    const newValue_0 = prefix_0 + leadingSpace + voiceInterimTranscript + trailingSpace + suffix_0;
    // Position cursor after the transcribed text (before suffix)
    const cursorPos = prefix_0.length + leadingSpace.length + voiceInterimTranscript.length;
    if (insertTextRef.current) {
      insertTextRef.current.setInputWithCursor(newValue_0, cursorPos);
    } else {
      setInputValueRaw(newValue_0);
    }
    lastSetInputRef.current = newValue_0;
  }, [voiceInterimTranscript, setInputValueRaw, inputValueRef, insertTextRef]);
  const handleVoiceTranscript = useCallback((text: string) => {
    if (!feature('VOICE_MODE')) return;
    const prefix_1 = voicePrefixRef.current;
    // No voice anchor — voice was reset (or never started). Nothing to do.
    if (prefix_1 === null) return;
    const suffix_1 = voiceSuffixRef.current;
    // Submit race: finishRecording() → user presses Enter (input cleared)
    // → WebSocket close → this callback fires with stale prefix/suffix.
    // If the input isn't what this hook last set (via the interim effect
    // or anchor), the user submitted or edited — don't re-fill. Comparing
    // against `text.length` would false-positive when the final is longer
    // than the interim (ASR routinely adds punctuation/corrections).
    if (inputValueRef.current !== lastSetInputRef.current) return;
    const needsSpace_0 = prefix_1.length > 0 && !/\s$/.test(prefix_1) && text.length > 0;
    const needsTrailingSpace_0 = suffix_1.length > 0 && !/^\s/.test(suffix_1) && text.length > 0;
    const leadingSpace_0 = needsSpace_0 ? ' ' : '';
    const trailingSpace_0 = needsTrailingSpace_0 ? ' ' : '';
    const newInput = prefix_1 + leadingSpace_0 + text + trailingSpace_0 + suffix_1;
    // Position cursor after the transcribed text (before suffix)
    const cursorPos_0 = prefix_1.length + leadingSpace_0.length + text.length;
    if (insertTextRef.current) {
      insertTextRef.current.setInputWithCursor(newInput, cursorPos_0);
    } else {
      setInputValueRaw(newInput);
    }
    lastSetInputRef.current = newInput;
    // Update the prefix to include this chunk so focus mode can continue
    // appending subsequent transcripts after it.
    voicePrefixRef.current = prefix_1 + leadingSpace_0 + text;
  }, [setInputValueRaw, inputValueRef, insertTextRef]);
  const voice = voiceNs.useVoice({
    onTranscript: handleVoiceTranscript,
    onError: (message: string) => {
      addNotification({
        key: 'voice-error',
        text: message,
        color: 'error',
        priority: 'immediate',
        timeoutMs: 10_000
      });
    },
    enabled: voiceEnabled,
    focusMode: false
  });

  // Compute the character range of interim (not-yet-finalized) transcript
  // text in the input value, so the UI can dim it.
  const interimRange = useMemo((): InterimRange | null => {
    if (!feature('VOICE_MODE')) return null;
    if (voicePrefixRef.current === null) return null;
    if (voiceInterimTranscript.length === 0) return null;
    const prefix_2 = voicePrefixRef.current;
    const needsSpace_1 = prefix_2.length > 0 && !/\s$/.test(prefix_2) && voiceInterimTranscript.length > 0;
    const start = prefix_2.length + (needsSpace_1 ? 1 : 0);
    const end = start + voiceInterimTranscript.length;
    return {
      start,
      end
    };
  }, [voiceInterimTranscript]);
  return {
    stripTrailing,
    resetAnchor,
    handleKeyEvent: voice.handleKeyEvent,
    interimRange
  };
}

/**
 * Component that handles hold-to-talk voice activation.
 *
 * The activation key is configurable via keybindings (voice:pushToTalk,
 * default: space). Hold detection depends on OS auto-repeat delivering a
 * stream of events at 30-80ms intervals. Two binding types work:
 *
 * **Modifier + letter (meta+k, ctrl+x, alt+v):** Cleanest. Activates on
 * the first press — a modifier combo is unambiguous intent (can't be
 * typed accidentally), so no hold threshold applies. The letter part
 * auto-repeats while held, feeding release detection in useVoice.ts.
 * No flow-through, no stripping.
 *
 * **Bare chars (space, v, x):** Require HOLD_THRESHOLD rapid presses to
 * activate (a single space could be normal typing). The first
 * WARMUP_THRESHOLD presses flow into the input so a single press types
 * normally. Past that, rapid presses are swallowed; on activation the
 * flow-through chars are stripped. Binding "v" doesn't make "v"
 * untypable — normal typing (>120ms between keystrokes) flows through;
 * only rapid auto-repeat from a held key triggers activation.
 *
 * Known broken: modifier+space (NUL → parsed as ctrl+backtick), chords
 * (discrete sequences, no hold). Validation warns on these.
 */
export function useVoiceKeybindingHandler({
  voiceHandleKeyEvent,
  stripTrailing,
  resetAnchor,
  isActive
}: {
  voiceHandleKeyEvent: (fallbackMs?: number) => void;
  stripTrailing: (maxStrip: number, opts?: StripOpts) => number;
  resetAnchor: () => void;
  isActive: boolean;
}): {
  handleKeyDown: (e: KeyboardEvent) => void;
} {
  const getVoiceState = useGetVoiceState();
  const setVoiceState = useSetVoiceState();
  const keybindingContext = useOptionalKeybindingContext();
  const isModalOverlayActive = useIsModalOverlayActive();
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const voiceEnabled = feature('VOICE_MODE') ? useVoiceEnabled() : false;
  const voiceState = feature('VOICE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useVoiceState(s => s.voiceState) : 'idle';

  // Find the configured key for voice:pushToTalk from keybinding context.
  // Forward iteration with last-wins (matching the resolver): if a later
  // Chat binding overrides the same chord with null or a different
  // action, the voice binding is discarded and null is returned — the
  // user explicitly disabled hold-to-talk via binding override, so
  // don't second-guess them with a fallback. The DEFAULT is only used
  // when there's no provider at all. Context filter is required — space
  // is also bound in Settings/Confirmation/Plugin (select:accept etc.);
  // without the filter those would null out the default.
  const voiceKeystroke = useMemo((): ParsedKeystroke | null => {
    if (!keybindingContext) return DEFAULT_VOICE_KEYSTROKE;
    let result: ParsedKeystroke | null = null;
    for (const binding of keybindingContext.bindings) {
      if (binding.context !== 'Chat') continue;
      if (binding.chord.length !== 1) continue;
      const ks = binding.chord[0];
      if (!ks) continue;
      if (binding.action === 'voice:pushToTalk') {
        result = ks;
      } else if (result !== null && keystrokesEqual(ks, result)) {
        // A later binding overrides this chord (null unbind or reassignment)
        result = null;
      }
    }
    return result;
  }, [keybindingContext]);

  // If the binding is a bare (unmodified) single printable char, terminal
  // auto-repeat may batch N keystrokes into one input event (e.g. "vvv"),
  // and the char flows into the text input — we need flow-through + strip.
  // Modifier combos (meta+k, ctrl+x) also auto-repeat (the letter part
  // repeats) but don't insert text, so they're swallowed from the first
  // press with no stripping needed. matchesKeyboardEvent handles those.
  const bareChar = voiceKeystroke !== null && voiceKeystroke.key.length === 1 && !voiceKeystroke.ctrl && !voiceKeystroke.alt && !voiceKeystroke.shift && !voiceKeystroke.meta && !voiceKeystroke.super ? voiceKeystroke.key : null;
  const rapidCountRef = useRef(0);
  // How many rapid chars we intentionally let through to the text
  // input (the first WARMUP_THRESHOLD). The activation strip removes
  // up to this many + the activation event's potential leak. For the
  // default (space) this is precise — pre-existing trailing spaces are
  // rare. For letter bindings (validation warns) this may over-strip
  // one pre-existing char if the input already ended in the bound
  // letter (e.g. "hav" + hold "v" → "ha"). We don't track that
  // boundary — it's best-effort and the warning says so.
  const charsInInputRef = useRef(0);
  // Trailing-char count remaining after the activation strip — these
  // belong to the user's anchored prefix and must be preserved during
  // recording's defensive leak cleanup.
  const recordingFloorRef = useRef(0);
  // True when the current recording was started by key-hold (not focus).
  // Used to avoid swallowing keypresses during focus-mode recording.
  const isHoldActiveRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset hold state as soon as we leave 'recording'. The physical hold
  // ends when key-repeat stops (state → 'processing'); keeping the ref
  // set through 'processing' swallows new space presses the user types
  // while the transcript finalizes.
  useEffect(() => {
    if (voiceState !== 'recording') {
      isHoldActiveRef.current = false;
      rapidCountRef.current = 0;
      charsInInputRef.current = 0;
      recordingFloorRef.current = 0;
      setVoiceState(prev => {
        if (!prev.voiceWarmingUp) return prev;
        return {
          ...prev,
          voiceWarmingUp: false
        };
      });
    }
  }, [voiceState, setVoiceState]);
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (!voiceEnabled) return;

    // PromptInput is not a valid transcript target — let the hold key
    // flow through instead of swallowing it into stale refs (#33556).
    // Two distinct unmount/unfocus paths (both needed):
    //   - !isActive: local-jsx command hid PromptInput (shouldHidePromptInput)
    //     without registering an overlay — e.g. /install-github-app,
    //     /plugin. Mirrors CommandKeybindingHandlers' isActive gate.
    //   - isModalOverlayActive: overlay (permission dialog, Select with
    //     onCancel) has focus; PromptInput is mounted but focus=false.
    if (!isActive || isModalOverlayActive) return;

    // null means the user overrode the default (null-unbind/reassign) —
    // hold-to-talk is disabled via binding. To toggle the feature
    // itself, use /voice.
    if (voiceKeystroke === null) return;

    // Match the configured key. Bare chars match by content (handles
    // batched auto-repeat like "vvv") with a modifier reject so e.g.
    // ctrl+v doesn't trip a "v" binding. Modifier combos go through
    // matchesKeyboardEvent (one event per repeat, no batching).
    let repeatCount: number;
    if (bareChar !== null) {
      if (e.ctrl || e.meta || e.shift) return;
      // When bound to space, also accept U+3000 (full-width space) —
      // CJK IMEs emit it for the same physical key.
      const normalized = bareChar === ' ' ? normalizeFullWidthSpace(e.key) : e.key;
      // Fast-path: normal typing (any char that isn't the bound one)
      // bails here without allocating. The repeat() check only matters
      // for batched auto-repeat (input.length > 1) which is rare.
      if (normalized[0] !== bareChar) return;
      if (normalized.length > 1 && normalized !== bareChar.repeat(normalized.length)) return;
      repeatCount = normalized.length;
    } else {
      if (!matchesKeyboardEvent(e, voiceKeystroke)) return;
      repeatCount = 1;
    }

    // Guard: only swallow keypresses when recording was triggered by
    // key-hold. Focus-mode recording also sets voiceState to 'recording',
    // but keypresses should flow through normally (voiceHandleKeyEvent
    // returns early for focus-triggered sessions). We also check voiceState
    // from the store so that if voiceHandleKeyEvent() fails to transition
    // state (module not loaded, stream unavailable) we don't permanently
    // swallow keypresses.
    const currentVoiceState = getVoiceState().voiceState;
    if (isHoldActiveRef.current && currentVoiceState !== 'idle') {
      // Already recording — swallow continued keypresses and forward
      // to voice for release detection. For bare chars, defensively
      // strip in case the text input handler fired before this one
      // (listener order is not guaranteed). Modifier combos don't
      // insert text, so nothing to strip.
      e.stopImmediatePropagation();
      if (bareChar !== null) {
        stripTrailing(repeatCount, {
          char: bareChar,
          floor: recordingFloorRef.current
        });
      }
      voiceHandleKeyEvent();
      return;
    }

    // Non-hold recording (focus-mode) or processing is active.
    // Modifier combos must not re-activate: stripTrailing(0,{anchor:true})
    // would overwrite voicePrefixRef with interim text and duplicate the
    // transcript on the next interim update. Pre-#22144, a single tap
    // hit the warmup else-branch (swallow only). Bare chars flow through
    // unconditionally — user may be typing during focus-recording.
    if (currentVoiceState !== 'idle') {
      if (bareChar === null) e.stopImmediatePropagation();
      return;
    }
    const countBefore = rapidCountRef.current;
    rapidCountRef.current += repeatCount;

    // ── Activation ────────────────────────────────────────────
    // Handled first so the warmup branch below does NOT also run
    // on this event — two strip calls in the same tick would both
    // read the stale inputValueRef and the second would under-strip.
    // Modifier combos activate on the first press — they can't be
    // typed accidentally, so the hold threshold (which exists to
    // distinguish typing a space from holding space) doesn't apply.
    if (bareChar === null || rapidCountRef.current >= HOLD_THRESHOLD) {
      e.stopImmediatePropagation();
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
      rapidCountRef.current = 0;
      isHoldActiveRef.current = true;
      setVoiceState(prev_0 => {
        if (!prev_0.voiceWarmingUp) return prev_0;
        return {
          ...prev_0,
          voiceWarmingUp: false
        };
      });
      if (bareChar !== null) {
        // Strip the intentional warmup chars plus this event's leak
        // (if text input fired first). Cap covers both; min(trailing)
        // handles the no-leak case. Anchor the voice prefix here.
        // The return value (remaining) becomes the floor for
        // recording-time leak cleanup.
        recordingFloorRef.current = stripTrailing(charsInInputRef.current + repeatCount, {
          char: bareChar,
          anchor: true
        });
        charsInInputRef.current = 0;
        voiceHandleKeyEvent();
      } else {
        // Modifier combo: nothing inserted, nothing to strip. Just
        // anchor the voice prefix at the current cursor position.
        // Longer fallback: this call is at t=0 (before auto-repeat),
        // so the gap to the next keypress is the OS initial repeat
        // *delay* (up to ~2s), not the repeat *rate* (~30-80ms).
        stripTrailing(0, {
          anchor: true
        });
        voiceHandleKeyEvent(MODIFIER_FIRST_PRESS_FALLBACK_MS);
      }
      // If voice failed to transition (module not loaded, stream
      // unavailable, stale enabled), clear the ref so a later
      // focus-mode recording doesn't inherit stale hold state
      // and swallow keypresses. Store is synchronous — the check is
      // immediate. The anchor set by stripTrailing above will
      // be overwritten on retry (anchor always overwrites now).
      if (getVoiceState().voiceState === 'idle') {
        isHoldActiveRef.current = false;
        resetAnchor();
      }
      return;
    }

    // ── Warmup (bare-char only; modifier combos activated above) ──
    // First WARMUP_THRESHOLD chars flow to the text input so normal
    // typing has zero latency (a single press types normally).
    // Subsequent rapid chars are swallowed so the input stays aligned
    // with the warmup UI. Strip defensively (listener order is not
    // guaranteed — text input may have already added the char). The
    // floor preserves the intentional warmup chars; the strip is a
    // no-op when nothing leaked. Check countBefore so the event that
    // crosses the threshold still flows through (terminal batching).
    if (countBefore >= WARMUP_THRESHOLD) {
      e.stopImmediatePropagation();
      stripTrailing(repeatCount, {
        char: bareChar,
        floor: charsInInputRef.current
      });
    } else {
      charsInInputRef.current += repeatCount;
    }

    // Show warmup feedback once we detect a hold pattern
    if (rapidCountRef.current >= WARMUP_THRESHOLD) {
      setVoiceState(prev_1 => {
        if (prev_1.voiceWarmingUp) return prev_1;
        return {
          ...prev_1,
          voiceWarmingUp: true
        };
      });
    }
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout((resetTimerRef_0, rapidCountRef_0, charsInInputRef_0, setVoiceState_0) => {
      resetTimerRef_0.current = null;
      rapidCountRef_0.current = 0;
      charsInInputRef_0.current = 0;
      setVoiceState_0(prev_2 => {
        if (!prev_2.voiceWarmingUp) return prev_2;
        return {
          ...prev_2,
          voiceWarmingUp: false
        };
      });
    }, RAPID_KEY_GAP_MS, resetTimerRef, rapidCountRef, charsInInputRef, setVoiceState);
  };

  // Backward-compat bridge: REPL.tsx doesn't yet wire handleKeyDown to
  // <Box onKeyDown>. Subscribe via useInput and adapt InputEvent →
  // KeyboardEvent until the consumer is migrated (separate PR).
  // TODO(onKeyDown-migration): remove once REPL passes handleKeyDown.
  useInput((_input, _key, event) => {
    const kbEvent = new KeyboardEvent(event.keypress);
    handleKeyDown(kbEvent);
    // handleKeyDown stopped the adapter event, not the InputEvent the
    // emitter actually checks — forward it so the text input's useInput
    // listener is skipped and held spaces don't leak into the prompt.
    if (kbEvent.didStopImmediatePropagation()) {
      event.stopImmediatePropagation();
    }
  }, {
    isActive
  });
  return {
    handleKeyDown
  };
}

// TODO(onKeyDown-migration): temporary shim so existing JSX callers
// (<VoiceKeybindingHandler .../>) keep compiling. Remove once REPL.tsx
// wires handleKeyDown directly.
export function VoiceKeybindingHandler(props) {
  useVoiceKeybindingHandler(props);
  return null;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZU1lbW8iLCJ1c2VSZWYiLCJ1c2VOb3RpZmljYXRpb25zIiwidXNlSXNNb2RhbE92ZXJsYXlBY3RpdmUiLCJ1c2VHZXRWb2ljZVN0YXRlIiwidXNlU2V0Vm9pY2VTdGF0ZSIsInVzZVZvaWNlU3RhdGUiLCJLZXlib2FyZEV2ZW50IiwidXNlSW5wdXQiLCJ1c2VPcHRpb25hbEtleWJpbmRpbmdDb250ZXh0Iiwia2V5c3Ryb2tlc0VxdWFsIiwiUGFyc2VkS2V5c3Ryb2tlIiwibm9ybWFsaXplRnVsbFdpZHRoU3BhY2UiLCJ1c2VWb2ljZUVuYWJsZWQiLCJ2b2ljZU5zIiwidXNlVm9pY2UiLCJyZXF1aXJlIiwiZW5hYmxlZCIsIl9lIiwib25UcmFuc2NyaXB0IiwidCIsInN0YXRlIiwiY29uc3QiLCJoYW5kbGVLZXlFdmVudCIsIl9mYWxsYmFja01zIiwiUkFQSURfS0VZX0dBUF9NUyIsIk1PRElGSUVSX0ZJUlNUX1BSRVNTX0ZBTExCQUNLX01TIiwiSE9MRF9USFJFU0hPTEQiLCJXQVJNVVBfVEhSRVNIT0xEIiwibWF0Y2hlc0tleWJvYXJkRXZlbnQiLCJlIiwidGFyZ2V0Iiwia2V5IiwidG9Mb3dlckNhc2UiLCJjdHJsIiwic2hpZnQiLCJtZXRhIiwiYWx0Iiwic3VwZXJLZXkiLCJzdXBlciIsIkRFRkFVTFRfVk9JQ0VfS0VZU1RST0tFIiwiSW5zZXJ0VGV4dEhhbmRsZSIsImluc2VydCIsInRleHQiLCJzZXRJbnB1dFdpdGhDdXJzb3IiLCJ2YWx1ZSIsImN1cnNvciIsImN1cnNvck9mZnNldCIsIlVzZVZvaWNlSW50ZWdyYXRpb25BcmdzIiwic2V0SW5wdXRWYWx1ZVJhdyIsIkRpc3BhdGNoIiwiU2V0U3RhdGVBY3Rpb24iLCJpbnB1dFZhbHVlUmVmIiwiUmVmT2JqZWN0IiwiaW5zZXJ0VGV4dFJlZiIsIkludGVyaW1SYW5nZSIsInN0YXJ0IiwiZW5kIiwiU3RyaXBPcHRzIiwiY2hhciIsImFuY2hvciIsImZsb29yIiwiVXNlVm9pY2VJbnRlZ3JhdGlvblJlc3VsdCIsInN0cmlwVHJhaWxpbmciLCJtYXhTdHJpcCIsIm9wdHMiLCJyZXNldEFuY2hvciIsImZhbGxiYWNrTXMiLCJpbnRlcmltUmFuZ2UiLCJ1c2VWb2ljZUludGVncmF0aW9uIiwiYWRkTm90aWZpY2F0aW9uIiwidm9pY2VQcmVmaXhSZWYiLCJ2b2ljZVN1ZmZpeFJlZiIsImxhc3RTZXRJbnB1dFJlZiIsInByZXYiLCJjdXJyZW50Iiwib2Zmc2V0IiwibGVuZ3RoIiwiYmVmb3JlQ3Vyc29yIiwic2xpY2UiLCJhZnRlckN1cnNvciIsInNjYW4iLCJ0cmFpbGluZyIsInN0cmlwQ291bnQiLCJNYXRoIiwibWF4IiwibWluIiwicmVtYWluaW5nIiwic3RyaXBwZWQiLCJnYXAiLCJ0ZXN0IiwibmV3VmFsdWUiLCJwcmVmaXgiLCJzdWZmaXgiLCJyZXN0b3JlZCIsInZvaWNlRW5hYmxlZCIsInZvaWNlU3RhdGUiLCJzIiwidm9pY2VJbnRlcmltVHJhbnNjcmlwdCIsImlucHV0IiwibmVlZHNTcGFjZSIsIm5lZWRzVHJhaWxpbmdTcGFjZSIsImxlYWRpbmdTcGFjZSIsInRyYWlsaW5nU3BhY2UiLCJjdXJzb3JQb3MiLCJoYW5kbGVWb2ljZVRyYW5zY3JpcHQiLCJuZXdJbnB1dCIsInZvaWNlIiwib25FcnJvciIsIm1lc3NhZ2UiLCJjb2xvciIsInByaW9yaXR5IiwidGltZW91dE1zIiwiZm9jdXNNb2RlIiwidXNlVm9pY2VLZXliaW5kaW5nSGFuZGxlciIsInZvaWNlSGFuZGxlS2V5RXZlbnQiLCJpc0FjdGl2ZSIsImhhbmRsZUtleURvd24iLCJnZXRWb2ljZVN0YXRlIiwic2V0Vm9pY2VTdGF0ZSIsImtleWJpbmRpbmdDb250ZXh0IiwiaXNNb2RhbE92ZXJsYXlBY3RpdmUiLCJ2b2ljZUtleXN0cm9rZSIsInJlc3VsdCIsImJpbmRpbmciLCJiaW5kaW5ncyIsImNvbnRleHQiLCJjaG9yZCIsImtzIiwiYWN0aW9uIiwiYmFyZUNoYXIiLCJyYXBpZENvdW50UmVmIiwiY2hhcnNJbklucHV0UmVmIiwicmVjb3JkaW5nRmxvb3JSZWYiLCJpc0hvbGRBY3RpdmVSZWYiLCJyZXNldFRpbWVyUmVmIiwiUmV0dXJuVHlwZSIsInNldFRpbWVvdXQiLCJ2b2ljZVdhcm1pbmdVcCIsInJlcGVhdENvdW50Iiwibm9ybWFsaXplZCIsInJlcGVhdCIsImN1cnJlbnRWb2ljZVN0YXRlIiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwiY291bnRCZWZvcmUiLCJjbGVhclRpbWVvdXQiLCJfaW5wdXQiLCJfa2V5IiwiZXZlbnQiLCJrYkV2ZW50Iiwia2V5cHJlc3MiLCJkaWRTdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24iLCJWb2ljZUtleWJpbmRpbmdIYW5kbGVyIiwicHJvcHMiXSwic291cmNlcyI6WyJ1c2VWb2ljZUludGVncmF0aW9uLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlUmVmIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VOb3RpZmljYXRpb25zIH0gZnJvbSAnLi4vY29udGV4dC9ub3RpZmljYXRpb25zLmpzJ1xuaW1wb3J0IHsgdXNlSXNNb2RhbE92ZXJsYXlBY3RpdmUgfSBmcm9tICcuLi9jb250ZXh0L292ZXJsYXlDb250ZXh0LmpzJ1xuaW1wb3J0IHtcbiAgdXNlR2V0Vm9pY2VTdGF0ZSxcbiAgdXNlU2V0Vm9pY2VTdGF0ZSxcbiAgdXNlVm9pY2VTdGF0ZSxcbn0gZnJvbSAnLi4vY29udGV4dC92b2ljZS5qcydcbmltcG9ydCB7IEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi9pbmsvZXZlbnRzL2tleWJvYXJkLWV2ZW50LmpzJ1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9wcmVmZXItdXNlLWtleWJpbmRpbmdzIC0tIGJhY2t3YXJkLWNvbXBhdCBicmlkZ2UgdW50aWwgUkVQTCB3aXJlcyBoYW5kbGVLZXlEb3duIHRvIDxCb3ggb25LZXlEb3duPlxuaW1wb3J0IHsgdXNlSW5wdXQgfSBmcm9tICcuLi9pbmsuanMnXG5pbXBvcnQgeyB1c2VPcHRpb25hbEtleWJpbmRpbmdDb250ZXh0IH0gZnJvbSAnLi4va2V5YmluZGluZ3MvS2V5YmluZGluZ0NvbnRleHQuanMnXG5pbXBvcnQgeyBrZXlzdHJva2VzRXF1YWwgfSBmcm9tICcuLi9rZXliaW5kaW5ncy9yZXNvbHZlci5qcydcbmltcG9ydCB0eXBlIHsgUGFyc2VkS2V5c3Ryb2tlIH0gZnJvbSAnLi4va2V5YmluZGluZ3MvdHlwZXMuanMnXG5pbXBvcnQgeyBub3JtYWxpemVGdWxsV2lkdGhTcGFjZSB9IGZyb20gJy4uL3V0aWxzL3N0cmluZ1V0aWxzLmpzJ1xuaW1wb3J0IHsgdXNlVm9pY2VFbmFibGVkIH0gZnJvbSAnLi91c2VWb2ljZUVuYWJsZWQuanMnXG5cbi8vIERlYWQgY29kZSBlbGltaW5hdGlvbjogY29uZGl0aW9uYWwgaW1wb3J0IGZvciB2b2ljZSBpbnB1dCBob29rLlxuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuLy8gQ2FwdHVyZSB0aGUgbW9kdWxlIG5hbWVzcGFjZSwgbm90IHRoZSBmdW5jdGlvbjogc3B5T24oKSBtdXRhdGVzIHRoZSBtb2R1bGVcbi8vIG9iamVjdCwgc28gYHZvaWNlTnMudXNlVm9pY2UoLi4uKWAgcmVzb2x2ZXMgdG8gdGhlIHNweSBldmVuIGlmIHRoaXMgbW9kdWxlXG4vLyB3YXMgbG9hZGVkIGJlZm9yZSB0aGUgc3B5IHdhcyBpbnN0YWxsZWQgKHRlc3Qgb3JkZXJpbmcgaW5kZXBlbmRlbmNlKS5cbmNvbnN0IHZvaWNlTnM6IHsgdXNlVm9pY2U6IHR5cGVvZiBpbXBvcnQoJy4vdXNlVm9pY2UuanMnKS51c2VWb2ljZSB9ID0gZmVhdHVyZShcbiAgJ1ZPSUNFX01PREUnLFxuKVxuICA/IHJlcXVpcmUoJy4vdXNlVm9pY2UuanMnKVxuICA6IHtcbiAgICAgIHVzZVZvaWNlOiAoe1xuICAgICAgICBlbmFibGVkOiBfZSxcbiAgICAgIH06IHtcbiAgICAgICAgb25UcmFuc2NyaXB0OiAodDogc3RyaW5nKSA9PiB2b2lkXG4gICAgICAgIGVuYWJsZWQ6IGJvb2xlYW5cbiAgICAgIH0pID0+ICh7XG4gICAgICAgIHN0YXRlOiAnaWRsZScgYXMgY29uc3QsXG4gICAgICAgIGhhbmRsZUtleUV2ZW50OiAoX2ZhbGxiYWNrTXM/OiBudW1iZXIpID0+IHt9LFxuICAgICAgfSksXG4gICAgfVxuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5cbi8vIE1heGltdW0gZ2FwIChtcykgYmV0d2VlbiBrZXkgcHJlc3NlcyB0byBjb3VudCBhcyBoZWxkIChhdXRvLXJlcGVhdCkuXG4vLyBUZXJtaW5hbCBhdXRvLXJlcGVhdCBmaXJlcyBldmVyeSAzMC04MG1zOyAxMjBtcyBjb3ZlcnMgaml0dGVyIHdoaWxlXG4vLyBleGNsdWRpbmcgbm9ybWFsIHR5cGluZyBzcGVlZCAoMTAwLTMwMG1zIGJldHdlZW4ga2V5c3Ryb2tlcykuXG5jb25zdCBSQVBJRF9LRVlfR0FQX01TID0gMTIwXG5cbi8vIEZhbGxiYWNrIChtcykgZm9yIG1vZGlmaWVyLWNvbWJvIGZpcnN0LXByZXNzIGFjdGl2YXRpb24uIE11c3QgbWF0Y2hcbi8vIEZJUlNUX1BSRVNTX0ZBTExCQUNLX01TIGluIHVzZVZvaWNlLnRzLiBDb3ZlcnMgdGhlIG1heCBPUyBpbml0aWFsXG4vLyBrZXktcmVwZWF0IGRlbGF5ICh+MnMgb24gbWFjT1Mgd2l0aCBzbGlkZXIgYXQgXCJMb25nXCIpIHNvIGhvbGRpbmcgYVxuLy8gbW9kaWZpZXIgY29tYm8gZG9lc24ndCBmcmFnbWVudCBpbnRvIHR3byBzZXNzaW9ucyB3aGVuIHRoZSBmaXJzdFxuLy8gYXV0by1yZXBlYXQgYXJyaXZlcyBhZnRlciB0aGUgZGVmYXVsdCA2MDBtcyBSRVBFQVRfRkFMTEJBQ0tfTVMuXG5jb25zdCBNT0RJRklFUl9GSVJTVF9QUkVTU19GQUxMQkFDS19NUyA9IDIwMDBcblxuLy8gTnVtYmVyIG9mIHJhcGlkIGNvbnNlY3V0aXZlIGtleSBldmVudHMgcmVxdWlyZWQgdG8gYWN0aXZhdGUgdm9pY2UuXG4vLyBPbmx5IGFwcGxpZXMgdG8gYmFyZS1jaGFyIGJpbmRpbmdzIChzcGFjZSwgdiwgZXRjLikgd2hlcmUgYSBzaW5nbGUgcHJlc3Ncbi8vIGNvdWxkIGJlIG5vcm1hbCB0eXBpbmcuIE1vZGlmaWVyIGNvbWJvcyBhY3RpdmF0ZSBvbiB0aGUgZmlyc3QgcHJlc3MuXG5jb25zdCBIT0xEX1RIUkVTSE9MRCA9IDVcblxuLy8gTnVtYmVyIG9mIHJhcGlkIGtleSBldmVudHMgdG8gc3RhcnQgc2hvd2luZyB3YXJtdXAgZmVlZGJhY2suXG5jb25zdCBXQVJNVVBfVEhSRVNIT0xEID0gMlxuXG4vLyBNYXRjaCBhIEtleWJvYXJkRXZlbnQgYWdhaW5zdCBhIFBhcnNlZEtleXN0cm9rZS4gUmVwbGFjZXMgdGhlIGxlZ2FjeVxuLy8gbWF0Y2hlc0tleXN0cm9rZShpbnB1dCwgS2V5LCAuLi4pIHBhdGggd2hpY2ggYXNzdW1lZCB1c2VJbnB1dCdzIHJhd1xuLy8gYGlucHV0YCBhcmcg4oCUIEtleWJvYXJkRXZlbnQua2V5IGhvbGRzIG5vcm1hbGl6ZWQgbmFtZXMgKGUuZy4gJ3NwYWNlJyxcbi8vICdmOScpIHRoYXQgZ2V0S2V5TmFtZSgpIGRpZG4ndCBoYW5kbGUsIHNvIG1vZGlmaWVyIGNvbWJvcyBhbmQgZi1rZXlzXG4vLyBzaWxlbnRseSBmYWlsZWQgdG8gbWF0Y2ggYWZ0ZXIgdGhlIG9uS2V5RG93biBtaWdyYXRpb24gKCMyMzUyNCkuXG5mdW5jdGlvbiBtYXRjaGVzS2V5Ym9hcmRFdmVudChcbiAgZTogS2V5Ym9hcmRFdmVudCxcbiAgdGFyZ2V0OiBQYXJzZWRLZXlzdHJva2UsXG4pOiBib29sZWFuIHtcbiAgLy8gS2V5Ym9hcmRFdmVudCBzdG9yZXMga2V5IG5hbWVzOyBQYXJzZWRLZXlzdHJva2Ugc3RvcmVzICcgJyBmb3Igc3BhY2VcbiAgLy8gYW5kICdlbnRlcicgZm9yIHJldHVybiAoc2VlIHBhcnNlci50cyBjYXNlICdzcGFjZScvJ3JldHVybicpLlxuICBjb25zdCBrZXkgPVxuICAgIGUua2V5ID09PSAnc3BhY2UnID8gJyAnIDogZS5rZXkgPT09ICdyZXR1cm4nID8gJ2VudGVyJyA6IGUua2V5LnRvTG93ZXJDYXNlKClcbiAgaWYgKGtleSAhPT0gdGFyZ2V0LmtleSkgcmV0dXJuIGZhbHNlXG4gIGlmIChlLmN0cmwgIT09IHRhcmdldC5jdHJsKSByZXR1cm4gZmFsc2VcbiAgaWYgKGUuc2hpZnQgIT09IHRhcmdldC5zaGlmdCkgcmV0dXJuIGZhbHNlXG4gIC8vIEtleWJvYXJkRXZlbnQubWV0YSBmb2xkcyBhbHR8b3B0aW9uICh0ZXJtaW5hbCBsaW1pdGF0aW9uIOKAlCBlc2MtcHJlZml4KTtcbiAgLy8gUGFyc2VkS2V5c3Ryb2tlIGhhcyBib3RoIGFsdCBhbmQgbWV0YSBhcyBhbGlhc2VzIGZvciB0aGUgc2FtZSB0aGluZy5cbiAgaWYgKGUubWV0YSAhPT0gKHRhcmdldC5hbHQgfHwgdGFyZ2V0Lm1ldGEpKSByZXR1cm4gZmFsc2VcbiAgaWYgKGUuc3VwZXJLZXkgIT09IHRhcmdldC5zdXBlcikgcmV0dXJuIGZhbHNlXG4gIHJldHVybiB0cnVlXG59XG5cbi8vIEhhcmRjb2RlZCBkZWZhdWx0IGZvciB3aGVuIHRoZXJlJ3Mgbm8gS2V5YmluZGluZ1Byb3ZpZGVyIGF0IGFsbCAoZS5nLlxuLy8gaGVhZGxlc3MvdGVzdCBjb250ZXh0cykuIE5PVCB1c2VkIHdoZW4gdGhlIHByb3ZpZGVyIGV4aXN0cyBhbmQgdGhlXG4vLyBsb29rdXAgcmV0dXJucyBudWxsIOKAlCB0aGF0IG1lYW5zIHRoZSB1c2VyIG51bGwtdW5ib3VuZCBvciByZWFzc2lnbmVkXG4vLyBzcGFjZSwgYW5kIGZhbGxpbmcgYmFjayB0byBzcGFjZSB3b3VsZCBwaWNrIGEgZGVhZCBvciBjb25mbGljdGluZyBrZXkuXG5jb25zdCBERUZBVUxUX1ZPSUNFX0tFWVNUUk9LRTogUGFyc2VkS2V5c3Ryb2tlID0ge1xuICBrZXk6ICcgJyxcbiAgY3RybDogZmFsc2UsXG4gIGFsdDogZmFsc2UsXG4gIHNoaWZ0OiBmYWxzZSxcbiAgbWV0YTogZmFsc2UsXG4gIHN1cGVyOiBmYWxzZSxcbn1cblxudHlwZSBJbnNlcnRUZXh0SGFuZGxlID0ge1xuICBpbnNlcnQ6ICh0ZXh0OiBzdHJpbmcpID0+IHZvaWRcbiAgc2V0SW5wdXRXaXRoQ3Vyc29yOiAodmFsdWU6IHN0cmluZywgY3Vyc29yOiBudW1iZXIpID0+IHZvaWRcbiAgY3Vyc29yT2Zmc2V0OiBudW1iZXJcbn1cblxudHlwZSBVc2VWb2ljZUludGVncmF0aW9uQXJncyA9IHtcbiAgc2V0SW5wdXRWYWx1ZVJhdzogUmVhY3QuRGlzcGF0Y2g8UmVhY3QuU2V0U3RhdGVBY3Rpb248c3RyaW5nPj5cbiAgaW5wdXRWYWx1ZVJlZjogUmVhY3QuUmVmT2JqZWN0PHN0cmluZz5cbiAgaW5zZXJ0VGV4dFJlZjogUmVhY3QuUmVmT2JqZWN0PEluc2VydFRleHRIYW5kbGUgfCBudWxsPlxufVxuXG50eXBlIEludGVyaW1SYW5nZSA9IHsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXIgfVxuXG50eXBlIFN0cmlwT3B0cyA9IHtcbiAgLy8gV2hpY2ggY2hhciB0byBzdHJpcCAodGhlIGNvbmZpZ3VyZWQgaG9sZCBrZXkpLiBEZWZhdWx0cyB0byBzcGFjZS5cbiAgY2hhcj86IHN0cmluZ1xuICAvLyBDYXB0dXJlIHRoZSB2b2ljZSBwcmVmaXgvc3VmZml4IGFuY2hvciBhdCB0aGUgc3RyaXBwZWQgcG9zaXRpb24uXG4gIGFuY2hvcj86IGJvb2xlYW5cbiAgLy8gTWluaW11bSB0cmFpbGluZyBjb3VudCB0byBsZWF2ZSBiZWhpbmQg4oCUIHByZXZlbnRzIHN0cmlwcGluZyB0aGVcbiAgLy8gaW50ZW50aW9uYWwgd2FybXVwIGNoYXJzIHdoZW4gZGVmZW5zaXZlbHkgY2xlYW5pbmcgdXAgbGVha3MuXG4gIGZsb29yPzogbnVtYmVyXG59XG5cbnR5cGUgVXNlVm9pY2VJbnRlZ3JhdGlvblJlc3VsdCA9IHtcbiAgLy8gUmV0dXJucyB0aGUgbnVtYmVyIG9mIHRyYWlsaW5nIGNoYXJzIHJlbWFpbmluZyBhZnRlciBzdHJpcHBpbmcuXG4gIHN0cmlwVHJhaWxpbmc6IChtYXhTdHJpcDogbnVtYmVyLCBvcHRzPzogU3RyaXBPcHRzKSA9PiBudW1iZXJcbiAgLy8gVW5kbyB0aGUgZ2FwIHNwYWNlIGFuZCByZXNldCBhbmNob3IgcmVmcyBhZnRlciBhIGZhaWxlZCB2b2ljZSBhY3RpdmF0aW9uLlxuICByZXNldEFuY2hvcjogKCkgPT4gdm9pZFxuICBoYW5kbGVLZXlFdmVudDogKGZhbGxiYWNrTXM/OiBudW1iZXIpID0+IHZvaWRcbiAgaW50ZXJpbVJhbmdlOiBJbnRlcmltUmFuZ2UgfCBudWxsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VWb2ljZUludGVncmF0aW9uKHtcbiAgc2V0SW5wdXRWYWx1ZVJhdyxcbiAgaW5wdXRWYWx1ZVJlZixcbiAgaW5zZXJ0VGV4dFJlZixcbn06IFVzZVZvaWNlSW50ZWdyYXRpb25BcmdzKTogVXNlVm9pY2VJbnRlZ3JhdGlvblJlc3VsdCB7XG4gIGNvbnN0IHsgYWRkTm90aWZpY2F0aW9uIH0gPSB1c2VOb3RpZmljYXRpb25zKClcblxuICAvLyBUcmFja3MgdGhlIGlucHV0IGNvbnRlbnQgYmVmb3JlL2FmdGVyIHRoZSBjdXJzb3Igd2hlbiB2b2ljZSBzdGFydHMsXG4gIC8vIHNvIGludGVyaW0gdHJhbnNjcmlwdHMgY2FuIGJlIGluc2VydGVkIGF0IHRoZSBjdXJzb3IgcG9zaXRpb24gd2l0aG91dFxuICAvLyBjbG9iYmVyaW5nIHN1cnJvdW5kaW5nIHVzZXIgdGV4dC5cbiAgY29uc3Qgdm9pY2VQcmVmaXhSZWYgPSB1c2VSZWY8c3RyaW5nIHwgbnVsbD4obnVsbClcbiAgY29uc3Qgdm9pY2VTdWZmaXhSZWYgPSB1c2VSZWY8c3RyaW5nPignJylcbiAgLy8gVHJhY2tzIHRoZSBsYXN0IGlucHV0IHZhbHVlIHRoaXMgaG9vayB3cm90ZSAodmlhIGFuY2hvciwgaW50ZXJpbSBlZmZlY3QsXG4gIC8vIG9yIGhhbmRsZVZvaWNlVHJhbnNjcmlwdCkuIElmIGlucHV0VmFsdWVSZWYuY3VycmVudCBkaXZlcmdlcywgdGhlIHVzZXJcbiAgLy8gc3VibWl0dGVkIG9yIGVkaXRlZCDigJQgYm90aCB3cml0ZSBwYXRocyBiYWlsIHRvIGF2b2lkIGNsb2JiZXJpbmcuIFRoaXMgaXNcbiAgLy8gdGhlIG9ubHkgZ3VhcmQgdGhhdCBjb3JyZWN0bHkgaGFuZGxlcyBlbXB0eS1wcmVmaXgtZW1wdHktc3VmZml4OiBhXG4gIC8vIHN0YXJ0c1dpdGgoJycpL2VuZHNXaXRoKCcnKSBjaGVjayB2YWN1b3VzbHkgcGFzc2VzLCBhbmQgYSBsZW5ndGggY2hlY2tcbiAgLy8gY2FuJ3QgZGlzdGluZ3Vpc2ggYSBjbGVhcmVkIGlucHV0IGZyb20gYSBuZXZlci1zZXQgb25lLlxuICBjb25zdCBsYXN0U2V0SW5wdXRSZWYgPSB1c2VSZWY8c3RyaW5nIHwgbnVsbD4obnVsbClcblxuICAvLyBTdHJpcCB0cmFpbGluZyBob2xkLWtleSBjaGFycyAoYW5kIG9wdGlvbmFsbHkgY2FwdHVyZSB0aGUgdm9pY2VcbiAgLy8gYW5jaG9yKS4gQ2FsbGVkIGR1cmluZyB3YXJtdXAgKHRvIGNsZWFuIHVwIGNoYXJzIHRoYXQgbGVha2VkIHBhc3RcbiAgLy8gc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIOKAlCBsaXN0ZW5lciBvcmRlciBpcyBub3QgZ3VhcmFudGVlZCkgYW5kXG4gIC8vIG9uIGFjdGl2YXRpb24gKHdpdGggYW5jaG9yPXRydWUgdG8gY2FwdHVyZSB0aGUgcHJlZml4L3N1ZmZpeCBhcm91bmRcbiAgLy8gdGhlIGN1cnNvciBmb3IgaW50ZXJpbSB0cmFuc2NyaXB0IHBsYWNlbWVudCkuIFRoZSBjYWxsZXIgcGFzc2VzIHRoZVxuICAvLyBleGFjdCBjb3VudCBpdCBleHBlY3RzIHRvIHN0cmlwIHNvIHByZS1leGlzdGluZyBjaGFycyBhdCB0aGVcbiAgLy8gYm91bmRhcnkgYXJlIHByZXNlcnZlZCAoZS5nLiB0aGUgXCJ2XCIgaW4gXCJoYXZcIiB3aGVuIGhvbGQta2V5IGlzIFwidlwiKS5cbiAgLy8gVGhlIGZsb29yIG9wdGlvbiBzZXRzIGEgbWluaW11bSB0cmFpbGluZyBjb3VudCB0byBsZWF2ZSBiZWhpbmRcbiAgLy8gKGR1cmluZyB3YXJtdXAgdGhpcyBpcyB0aGUgY291bnQgd2UgaW50ZW50aW9uYWxseSBsZXQgdGhyb3VnaCwgc29cbiAgLy8gZGVmZW5zaXZlIGNsZWFudXAgb25seSByZW1vdmVzIGxlYWtzKS4gUmV0dXJucyB0aGUgbnVtYmVyIG9mXG4gIC8vIHRyYWlsaW5nIGNoYXJzIHJlbWFpbmluZyBhZnRlciBzdHJpcHBpbmcuIFdoZW4gbm90aGluZyBjaGFuZ2VzLCBub1xuICAvLyBzdGF0ZSB1cGRhdGUgaXMgcGVyZm9ybWVkLlxuICBjb25zdCBzdHJpcFRyYWlsaW5nID0gdXNlQ2FsbGJhY2soXG4gICAgKFxuICAgICAgbWF4U3RyaXA6IG51bWJlcixcbiAgICAgIHsgY2hhciA9ICcgJywgYW5jaG9yID0gZmFsc2UsIGZsb29yID0gMCB9OiBTdHJpcE9wdHMgPSB7fSxcbiAgICApID0+IHtcbiAgICAgIGNvbnN0IHByZXYgPSBpbnB1dFZhbHVlUmVmLmN1cnJlbnRcbiAgICAgIGNvbnN0IG9mZnNldCA9IGluc2VydFRleHRSZWYuY3VycmVudD8uY3Vyc29yT2Zmc2V0ID8/IHByZXYubGVuZ3RoXG4gICAgICBjb25zdCBiZWZvcmVDdXJzb3IgPSBwcmV2LnNsaWNlKDAsIG9mZnNldClcbiAgICAgIGNvbnN0IGFmdGVyQ3Vyc29yID0gcHJldi5zbGljZShvZmZzZXQpXG4gICAgICAvLyBXaGVuIHRoZSBob2xkIGtleSBpcyBzcGFjZSwgYWxzbyBjb3VudCBmdWxsLXdpZHRoIHNwYWNlcyAoVSszMDAwKVxuICAgICAgLy8gdGhhdCBhIENKSyBJTUUgbWF5IGhhdmUgaW5zZXJ0ZWQgZm9yIHRoZSBzYW1lIHBoeXNpY2FsIGtleS5cbiAgICAgIC8vIFUrMzAwMCBpcyBCTVAgc2luZ2xlLWNvZGUtdW5pdCBzbyBpbmRpY2VzIGFsaWduIHdpdGggYmVmb3JlQ3Vyc29yLlxuICAgICAgY29uc3Qgc2NhbiA9XG4gICAgICAgIGNoYXIgPT09ICcgJyA/IG5vcm1hbGl6ZUZ1bGxXaWR0aFNwYWNlKGJlZm9yZUN1cnNvcikgOiBiZWZvcmVDdXJzb3JcbiAgICAgIGxldCB0cmFpbGluZyA9IDBcbiAgICAgIHdoaWxlIChcbiAgICAgICAgdHJhaWxpbmcgPCBzY2FuLmxlbmd0aCAmJlxuICAgICAgICBzY2FuW3NjYW4ubGVuZ3RoIC0gMSAtIHRyYWlsaW5nXSA9PT0gY2hhclxuICAgICAgKSB7XG4gICAgICAgIHRyYWlsaW5nKytcbiAgICAgIH1cbiAgICAgIGNvbnN0IHN0cmlwQ291bnQgPSBNYXRoLm1heCgwLCBNYXRoLm1pbih0cmFpbGluZyAtIGZsb29yLCBtYXhTdHJpcCkpXG4gICAgICBjb25zdCByZW1haW5pbmcgPSB0cmFpbGluZyAtIHN0cmlwQ291bnRcbiAgICAgIGNvbnN0IHN0cmlwcGVkID0gYmVmb3JlQ3Vyc29yLnNsaWNlKDAsIGJlZm9yZUN1cnNvci5sZW5ndGggLSBzdHJpcENvdW50KVxuICAgICAgLy8gV2hlbiBhbmNob3Jpbmcgd2l0aCBhIG5vbi1zcGFjZSBzdWZmaXgsIGluc2VydCBhIGdhcCBzcGFjZSBzbyB0aGVcbiAgICAgIC8vIHdhdmVmb3JtIGN1cnNvciBzaXRzIG9uIHRoZSBnYXAgaW5zdGVhZCBvZiBjb3ZlcmluZyB0aGUgZmlyc3RcbiAgICAgIC8vIHN1ZmZpeCBsZXR0ZXIuIFRoZSBpbnRlcmltIHRyYW5zY3JpcHQgZWZmZWN0IG1haW50YWlucyB0aGlzIHNhbWVcbiAgICAgIC8vIHN0cnVjdHVyZSAocHJlZml4ICsgbGVhZGluZyArIGludGVyaW0gKyB0cmFpbGluZyArIHN1ZmZpeCksIHNvXG4gICAgICAvLyB0aGUgZ2FwIGlzIHNlYW1sZXNzIG9uY2UgdHJhbnNjcmlwdCB0ZXh0IGFycml2ZXMuXG4gICAgICAvLyBBbHdheXMgb3ZlcndyaXRlIG9uIGFuY2hvciDigJQgaWYgYSBwcmlvciBhY3RpdmF0aW9uIGZhaWxlZCB0byBzdGFydFxuICAgICAgLy8gdm9pY2UgKHZvaWNlU3RhdGUgc3RheWVkICdpZGxlJyksIHRoZSBjbGVhbnVwIGVmZmVjdCBkaWRuJ3QgZmlyZSBhbmRcbiAgICAgIC8vIHRoZSBvbGQgYW5jaG9yIGlzIHN0YWxlLiBhbmNob3I9dHJ1ZSBpcyBvbmx5IHBhc3NlZCBvbiB0aGUgc2luZ2xlXG4gICAgICAvLyBhY3RpdmF0aW9uIGNhbGwsIG5ldmVyIGR1cmluZyByZWNvcmRpbmcsIHNvIG92ZXJ3cml0ZSBpcyBzYWZlLlxuICAgICAgbGV0IGdhcCA9ICcnXG4gICAgICBpZiAoYW5jaG9yKSB7XG4gICAgICAgIHZvaWNlUHJlZml4UmVmLmN1cnJlbnQgPSBzdHJpcHBlZFxuICAgICAgICB2b2ljZVN1ZmZpeFJlZi5jdXJyZW50ID0gYWZ0ZXJDdXJzb3JcbiAgICAgICAgaWYgKGFmdGVyQ3Vyc29yLmxlbmd0aCA+IDAgJiYgIS9eXFxzLy50ZXN0KGFmdGVyQ3Vyc29yKSkge1xuICAgICAgICAgIGdhcCA9ICcgJ1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCBuZXdWYWx1ZSA9IHN0cmlwcGVkICsgZ2FwICsgYWZ0ZXJDdXJzb3JcbiAgICAgIGlmIChhbmNob3IpIGxhc3RTZXRJbnB1dFJlZi5jdXJyZW50ID0gbmV3VmFsdWVcbiAgICAgIGlmIChuZXdWYWx1ZSA9PT0gcHJldiAmJiBzdHJpcENvdW50ID09PSAwKSByZXR1cm4gcmVtYWluaW5nXG4gICAgICBpZiAoaW5zZXJ0VGV4dFJlZi5jdXJyZW50KSB7XG4gICAgICAgIGluc2VydFRleHRSZWYuY3VycmVudC5zZXRJbnB1dFdpdGhDdXJzb3IobmV3VmFsdWUsIHN0cmlwcGVkLmxlbmd0aClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldElucHV0VmFsdWVSYXcobmV3VmFsdWUpXG4gICAgICB9XG4gICAgICByZXR1cm4gcmVtYWluaW5nXG4gICAgfSxcbiAgICBbc2V0SW5wdXRWYWx1ZVJhdywgaW5wdXRWYWx1ZVJlZiwgaW5zZXJ0VGV4dFJlZl0sXG4gIClcblxuICAvLyBVbmRvIHRoZSBnYXAgc3BhY2UgaW5zZXJ0ZWQgYnkgc3RyaXBUcmFpbGluZyguLi4sIHthbmNob3I6dHJ1ZX0pIGFuZFxuICAvLyByZXNldCB0aGUgdm9pY2UgcHJlZml4L3N1ZmZpeCByZWZzLiBDYWxsZWQgd2hlbiB2b2ljZSBhY3RpdmF0aW9uIGZhaWxzXG4gIC8vICh2b2ljZVN0YXRlIHN0YXlzICdpZGxlJyBhZnRlciB2b2ljZUhhbmRsZUtleUV2ZW50KSwgc28gdGhlIGNsZWFudXBcbiAgLy8gZWZmZWN0ICh2b2ljZVN0YXRlIHVzZUVmZmVjdCBiZWxvdykg4oCUIHdoaWNoIG9ubHkgZmlyZXMgb24gdm9pY2VTdGF0ZSB0cmFuc2l0aW9ucyDigJQgY2FuJ3RcbiAgLy8gcmVhY2ggdGhlIHN0YWxlIGFuY2hvci4gV2l0aG91dCB0aGlzLCB0aGUgZ2FwIHNwYWNlIGFuZCBzdGFsZSByZWZzXG4gIC8vIHBlcnNpc3QgaW4gdGhlIGlucHV0LlxuICBjb25zdCByZXNldEFuY2hvciA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBjb25zdCBwcmVmaXggPSB2b2ljZVByZWZpeFJlZi5jdXJyZW50XG4gICAgaWYgKHByZWZpeCA9PT0gbnVsbCkgcmV0dXJuXG4gICAgY29uc3Qgc3VmZml4ID0gdm9pY2VTdWZmaXhSZWYuY3VycmVudFxuICAgIHZvaWNlUHJlZml4UmVmLmN1cnJlbnQgPSBudWxsXG4gICAgdm9pY2VTdWZmaXhSZWYuY3VycmVudCA9ICcnXG4gICAgY29uc3QgcmVzdG9yZWQgPSBwcmVmaXggKyBzdWZmaXhcbiAgICBpZiAoaW5zZXJ0VGV4dFJlZi5jdXJyZW50KSB7XG4gICAgICBpbnNlcnRUZXh0UmVmLmN1cnJlbnQuc2V0SW5wdXRXaXRoQ3Vyc29yKHJlc3RvcmVkLCBwcmVmaXgubGVuZ3RoKVxuICAgIH0gZWxzZSB7XG4gICAgICBzZXRJbnB1dFZhbHVlUmF3KHJlc3RvcmVkKVxuICAgIH1cbiAgfSwgW3NldElucHV0VmFsdWVSYXcsIGluc2VydFRleHRSZWZdKVxuXG4gIC8vIFZvaWNlIHN0YXRlIHNlbGVjdG9ycy4gdXNlVm9pY2VFbmFibGVkID0gdXNlciBpbnRlbnQgKHNldHRpbmdzKSArXG4gIC8vIGF1dGggKyBHQiBraWxsLXN3aXRjaCwgd2l0aCB0aGUgYXV0aCBoYWxmIG1lbW9pemVkIG9uIGF1dGhWZXJzaW9uIHNvXG4gIC8vIHJlbmRlciBsb29wcyBuZXZlciBoaXQgYSBjb2xkIGtleWNoYWluIHNwYXduLlxuICAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gIGNvbnN0IHZvaWNlRW5hYmxlZCA9IGZlYXR1cmUoJ1ZPSUNFX01PREUnKSA/IHVzZVZvaWNlRW5hYmxlZCgpIDogZmFsc2VcbiAgY29uc3Qgdm9pY2VTdGF0ZSA9IGZlYXR1cmUoJ1ZPSUNFX01PREUnKVxuICAgID8gLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICAgICAgdXNlVm9pY2VTdGF0ZShzID0+IHMudm9pY2VTdGF0ZSlcbiAgICA6ICgnaWRsZScgYXMgY29uc3QpXG4gIGNvbnN0IHZvaWNlSW50ZXJpbVRyYW5zY3JpcHQgPSBmZWF0dXJlKCdWT0lDRV9NT0RFJylcbiAgICA/IC8vIGJpb21lLWlnbm9yZSBsaW50L2NvcnJlY3RuZXNzL3VzZUhvb2tBdFRvcExldmVsOiBmZWF0dXJlKCkgaXMgYSBjb21waWxlLXRpbWUgY29uc3RhbnRcbiAgICAgIHVzZVZvaWNlU3RhdGUocyA9PiBzLnZvaWNlSW50ZXJpbVRyYW5zY3JpcHQpXG4gICAgOiAnJ1xuXG4gIC8vIFNldCB0aGUgdm9pY2UgYW5jaG9yIGZvciBmb2N1cyBtb2RlICh3aGVyZSByZWNvcmRpbmcgc3RhcnRzIHZpYSB0ZXJtaW5hbFxuICAvLyBmb2N1cywgbm90IGtleSBob2xkKS4gS2V5LWhvbGQgc2V0cyB0aGUgYW5jaG9yIGluIHN0cmlwVHJhaWxpbmcuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFmZWF0dXJlKCdWT0lDRV9NT0RFJykpIHJldHVyblxuICAgIGlmICh2b2ljZVN0YXRlID09PSAncmVjb3JkaW5nJyAmJiB2b2ljZVByZWZpeFJlZi5jdXJyZW50ID09PSBudWxsKSB7XG4gICAgICBjb25zdCBpbnB1dCA9IGlucHV0VmFsdWVSZWYuY3VycmVudFxuICAgICAgY29uc3Qgb2Zmc2V0ID0gaW5zZXJ0VGV4dFJlZi5jdXJyZW50Py5jdXJzb3JPZmZzZXQgPz8gaW5wdXQubGVuZ3RoXG4gICAgICB2b2ljZVByZWZpeFJlZi5jdXJyZW50ID0gaW5wdXQuc2xpY2UoMCwgb2Zmc2V0KVxuICAgICAgdm9pY2VTdWZmaXhSZWYuY3VycmVudCA9IGlucHV0LnNsaWNlKG9mZnNldClcbiAgICAgIGxhc3RTZXRJbnB1dFJlZi5jdXJyZW50ID0gaW5wdXRcbiAgICB9XG4gICAgaWYgKHZvaWNlU3RhdGUgPT09ICdpZGxlJykge1xuICAgICAgdm9pY2VQcmVmaXhSZWYuY3VycmVudCA9IG51bGxcbiAgICAgIHZvaWNlU3VmZml4UmVmLmN1cnJlbnQgPSAnJ1xuICAgICAgbGFzdFNldElucHV0UmVmLmN1cnJlbnQgPSBudWxsXG4gICAgfVxuICB9LCBbdm9pY2VTdGF0ZSwgaW5wdXRWYWx1ZVJlZiwgaW5zZXJ0VGV4dFJlZl0pXG5cbiAgLy8gTGl2ZS11cGRhdGUgdGhlIHByb21wdCBpbnB1dCB3aXRoIHRoZSBpbnRlcmltIHRyYW5zY3JpcHQgYXMgdm9pY2VcbiAgLy8gdHJhbnNjcmliZXMgc3BlZWNoLiBUaGUgcHJlZml4ICh1c2VyLXR5cGVkIHRleHQgYmVmb3JlIHRoZSBjdXJzb3IpIGlzXG4gIC8vIHByZXNlcnZlZCBhbmQgdGhlIHRyYW5zY3JpcHQgaXMgaW5zZXJ0ZWQgYmV0d2VlbiBwcmVmaXggYW5kIHN1ZmZpeC5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWZlYXR1cmUoJ1ZPSUNFX01PREUnKSkgcmV0dXJuXG4gICAgaWYgKHZvaWNlUHJlZml4UmVmLmN1cnJlbnQgPT09IG51bGwpIHJldHVyblxuICAgIGNvbnN0IHByZWZpeCA9IHZvaWNlUHJlZml4UmVmLmN1cnJlbnRcbiAgICBjb25zdCBzdWZmaXggPSB2b2ljZVN1ZmZpeFJlZi5jdXJyZW50XG4gICAgLy8gU3VibWl0IHJhY2U6IGlmIHRoZSBpbnB1dCBpc24ndCB3aGF0IHRoaXMgaG9vayBsYXN0IHNldCBpdCB0bywgdGhlXG4gICAgLy8gdXNlciBzdWJtaXR0ZWQgKGNsZWFyaW5nIGl0KSBvciBlZGl0ZWQgaXQuIHZvaWNlUHJlZml4UmVmIGlzIG9ubHlcbiAgICAvLyBjbGVhcmVkIG9uIHZvaWNlU3RhdGXihpJpZGxlLCBzbyBpdCdzIHN0aWxsIHNldCBkdXJpbmcgdGhlICdwcm9jZXNzaW5nJ1xuICAgIC8vIHdpbmRvdyBiZXR3ZWVuIENsb3NlU3RyZWFtIGFuZCBXUyBjbG9zZSDigJQgdGhpcyBjYXRjaGVzIHJlZmluZWRcbiAgICAvLyBUcmFuc2NyaXB0VGV4dCBhcnJpdmluZyB0aGVuIGFuZCByZS1maWxsaW5nIGEgY2xlYXJlZCBpbnB1dC5cbiAgICBpZiAoaW5wdXRWYWx1ZVJlZi5jdXJyZW50ICE9PSBsYXN0U2V0SW5wdXRSZWYuY3VycmVudCkgcmV0dXJuXG4gICAgY29uc3QgbmVlZHNTcGFjZSA9XG4gICAgICBwcmVmaXgubGVuZ3RoID4gMCAmJlxuICAgICAgIS9cXHMkLy50ZXN0KHByZWZpeCkgJiZcbiAgICAgIHZvaWNlSW50ZXJpbVRyYW5zY3JpcHQubGVuZ3RoID4gMFxuICAgIC8vIERvbid0IGdhdGUgb24gdm9pY2VJbnRlcmltVHJhbnNjcmlwdC5sZW5ndGggLS0gd2hlbiBpbnRlcmltIGNsZWFycyB0byAnJ1xuICAgIC8vIGFmdGVyIGhhbmRsZVZvaWNlVHJhbnNjcmlwdCBzZXRzIHRoZSBmaW5hbCB0ZXh0LCB0aGUgdHJhaWxpbmcgc3BhY2VcbiAgICAvLyBiZXR3ZWVuIHByZWZpeCBhbmQgc3VmZml4IG11c3Qgc3RpbGwgYmUgcHJlc2VydmVkLlxuICAgIGNvbnN0IG5lZWRzVHJhaWxpbmdTcGFjZSA9IHN1ZmZpeC5sZW5ndGggPiAwICYmICEvXlxccy8udGVzdChzdWZmaXgpXG4gICAgY29uc3QgbGVhZGluZ1NwYWNlID0gbmVlZHNTcGFjZSA/ICcgJyA6ICcnXG4gICAgY29uc3QgdHJhaWxpbmdTcGFjZSA9IG5lZWRzVHJhaWxpbmdTcGFjZSA/ICcgJyA6ICcnXG4gICAgY29uc3QgbmV3VmFsdWUgPVxuICAgICAgcHJlZml4ICsgbGVhZGluZ1NwYWNlICsgdm9pY2VJbnRlcmltVHJhbnNjcmlwdCArIHRyYWlsaW5nU3BhY2UgKyBzdWZmaXhcbiAgICAvLyBQb3NpdGlvbiBjdXJzb3IgYWZ0ZXIgdGhlIHRyYW5zY3JpYmVkIHRleHQgKGJlZm9yZSBzdWZmaXgpXG4gICAgY29uc3QgY3Vyc29yUG9zID1cbiAgICAgIHByZWZpeC5sZW5ndGggKyBsZWFkaW5nU3BhY2UubGVuZ3RoICsgdm9pY2VJbnRlcmltVHJhbnNjcmlwdC5sZW5ndGhcbiAgICBpZiAoaW5zZXJ0VGV4dFJlZi5jdXJyZW50KSB7XG4gICAgICBpbnNlcnRUZXh0UmVmLmN1cnJlbnQuc2V0SW5wdXRXaXRoQ3Vyc29yKG5ld1ZhbHVlLCBjdXJzb3JQb3MpXG4gICAgfSBlbHNlIHtcbiAgICAgIHNldElucHV0VmFsdWVSYXcobmV3VmFsdWUpXG4gICAgfVxuICAgIGxhc3RTZXRJbnB1dFJlZi5jdXJyZW50ID0gbmV3VmFsdWVcbiAgfSwgW3ZvaWNlSW50ZXJpbVRyYW5zY3JpcHQsIHNldElucHV0VmFsdWVSYXcsIGlucHV0VmFsdWVSZWYsIGluc2VydFRleHRSZWZdKVxuXG4gIGNvbnN0IGhhbmRsZVZvaWNlVHJhbnNjcmlwdCA9IHVzZUNhbGxiYWNrKFxuICAgICh0ZXh0OiBzdHJpbmcpID0+IHtcbiAgICAgIGlmICghZmVhdHVyZSgnVk9JQ0VfTU9ERScpKSByZXR1cm5cbiAgICAgIGNvbnN0IHByZWZpeCA9IHZvaWNlUHJlZml4UmVmLmN1cnJlbnRcbiAgICAgIC8vIE5vIHZvaWNlIGFuY2hvciDigJQgdm9pY2Ugd2FzIHJlc2V0IChvciBuZXZlciBzdGFydGVkKS4gTm90aGluZyB0byBkby5cbiAgICAgIGlmIChwcmVmaXggPT09IG51bGwpIHJldHVyblxuICAgICAgY29uc3Qgc3VmZml4ID0gdm9pY2VTdWZmaXhSZWYuY3VycmVudFxuICAgICAgLy8gU3VibWl0IHJhY2U6IGZpbmlzaFJlY29yZGluZygpIOKGkiB1c2VyIHByZXNzZXMgRW50ZXIgKGlucHV0IGNsZWFyZWQpXG4gICAgICAvLyDihpIgV2ViU29ja2V0IGNsb3NlIOKGkiB0aGlzIGNhbGxiYWNrIGZpcmVzIHdpdGggc3RhbGUgcHJlZml4L3N1ZmZpeC5cbiAgICAgIC8vIElmIHRoZSBpbnB1dCBpc24ndCB3aGF0IHRoaXMgaG9vayBsYXN0IHNldCAodmlhIHRoZSBpbnRlcmltIGVmZmVjdFxuICAgICAgLy8gb3IgYW5jaG9yKSwgdGhlIHVzZXIgc3VibWl0dGVkIG9yIGVkaXRlZCDigJQgZG9uJ3QgcmUtZmlsbC4gQ29tcGFyaW5nXG4gICAgICAvLyBhZ2FpbnN0IGB0ZXh0Lmxlbmd0aGAgd291bGQgZmFsc2UtcG9zaXRpdmUgd2hlbiB0aGUgZmluYWwgaXMgbG9uZ2VyXG4gICAgICAvLyB0aGFuIHRoZSBpbnRlcmltIChBU1Igcm91dGluZWx5IGFkZHMgcHVuY3R1YXRpb24vY29ycmVjdGlvbnMpLlxuICAgICAgaWYgKGlucHV0VmFsdWVSZWYuY3VycmVudCAhPT0gbGFzdFNldElucHV0UmVmLmN1cnJlbnQpIHJldHVyblxuICAgICAgY29uc3QgbmVlZHNTcGFjZSA9XG4gICAgICAgIHByZWZpeC5sZW5ndGggPiAwICYmICEvXFxzJC8udGVzdChwcmVmaXgpICYmIHRleHQubGVuZ3RoID4gMFxuICAgICAgY29uc3QgbmVlZHNUcmFpbGluZ1NwYWNlID1cbiAgICAgICAgc3VmZml4Lmxlbmd0aCA+IDAgJiYgIS9eXFxzLy50ZXN0KHN1ZmZpeCkgJiYgdGV4dC5sZW5ndGggPiAwXG4gICAgICBjb25zdCBsZWFkaW5nU3BhY2UgPSBuZWVkc1NwYWNlID8gJyAnIDogJydcbiAgICAgIGNvbnN0IHRyYWlsaW5nU3BhY2UgPSBuZWVkc1RyYWlsaW5nU3BhY2UgPyAnICcgOiAnJ1xuICAgICAgY29uc3QgbmV3SW5wdXQgPSBwcmVmaXggKyBsZWFkaW5nU3BhY2UgKyB0ZXh0ICsgdHJhaWxpbmdTcGFjZSArIHN1ZmZpeFxuICAgICAgLy8gUG9zaXRpb24gY3Vyc29yIGFmdGVyIHRoZSB0cmFuc2NyaWJlZCB0ZXh0IChiZWZvcmUgc3VmZml4KVxuICAgICAgY29uc3QgY3Vyc29yUG9zID0gcHJlZml4Lmxlbmd0aCArIGxlYWRpbmdTcGFjZS5sZW5ndGggKyB0ZXh0Lmxlbmd0aFxuICAgICAgaWYgKGluc2VydFRleHRSZWYuY3VycmVudCkge1xuICAgICAgICBpbnNlcnRUZXh0UmVmLmN1cnJlbnQuc2V0SW5wdXRXaXRoQ3Vyc29yKG5ld0lucHV0LCBjdXJzb3JQb3MpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRJbnB1dFZhbHVlUmF3KG5ld0lucHV0KVxuICAgICAgfVxuICAgICAgbGFzdFNldElucHV0UmVmLmN1cnJlbnQgPSBuZXdJbnB1dFxuICAgICAgLy8gVXBkYXRlIHRoZSBwcmVmaXggdG8gaW5jbHVkZSB0aGlzIGNodW5rIHNvIGZvY3VzIG1vZGUgY2FuIGNvbnRpbnVlXG4gICAgICAvLyBhcHBlbmRpbmcgc3Vic2VxdWVudCB0cmFuc2NyaXB0cyBhZnRlciBpdC5cbiAgICAgIHZvaWNlUHJlZml4UmVmLmN1cnJlbnQgPSBwcmVmaXggKyBsZWFkaW5nU3BhY2UgKyB0ZXh0XG4gICAgfSxcbiAgICBbc2V0SW5wdXRWYWx1ZVJhdywgaW5wdXRWYWx1ZVJlZiwgaW5zZXJ0VGV4dFJlZl0sXG4gIClcblxuICBjb25zdCB2b2ljZSA9IHZvaWNlTnMudXNlVm9pY2Uoe1xuICAgIG9uVHJhbnNjcmlwdDogaGFuZGxlVm9pY2VUcmFuc2NyaXB0LFxuICAgIG9uRXJyb3I6IChtZXNzYWdlOiBzdHJpbmcpID0+IHtcbiAgICAgIGFkZE5vdGlmaWNhdGlvbih7XG4gICAgICAgIGtleTogJ3ZvaWNlLWVycm9yJyxcbiAgICAgICAgdGV4dDogbWVzc2FnZSxcbiAgICAgICAgY29sb3I6ICdlcnJvcicsXG4gICAgICAgIHByaW9yaXR5OiAnaW1tZWRpYXRlJyxcbiAgICAgICAgdGltZW91dE1zOiAxMF8wMDAsXG4gICAgICB9KVxuICAgIH0sXG4gICAgZW5hYmxlZDogdm9pY2VFbmFibGVkLFxuICAgIGZvY3VzTW9kZTogZmFsc2UsXG4gIH0pXG5cbiAgLy8gQ29tcHV0ZSB0aGUgY2hhcmFjdGVyIHJhbmdlIG9mIGludGVyaW0gKG5vdC15ZXQtZmluYWxpemVkKSB0cmFuc2NyaXB0XG4gIC8vIHRleHQgaW4gdGhlIGlucHV0IHZhbHVlLCBzbyB0aGUgVUkgY2FuIGRpbSBpdC5cbiAgY29uc3QgaW50ZXJpbVJhbmdlID0gdXNlTWVtbygoKTogSW50ZXJpbVJhbmdlIHwgbnVsbCA9PiB7XG4gICAgaWYgKCFmZWF0dXJlKCdWT0lDRV9NT0RFJykpIHJldHVybiBudWxsXG4gICAgaWYgKHZvaWNlUHJlZml4UmVmLmN1cnJlbnQgPT09IG51bGwpIHJldHVybiBudWxsXG4gICAgaWYgKHZvaWNlSW50ZXJpbVRyYW5zY3JpcHQubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbFxuICAgIGNvbnN0IHByZWZpeCA9IHZvaWNlUHJlZml4UmVmLmN1cnJlbnRcbiAgICBjb25zdCBuZWVkc1NwYWNlID1cbiAgICAgIHByZWZpeC5sZW5ndGggPiAwICYmXG4gICAgICAhL1xccyQvLnRlc3QocHJlZml4KSAmJlxuICAgICAgdm9pY2VJbnRlcmltVHJhbnNjcmlwdC5sZW5ndGggPiAwXG4gICAgY29uc3Qgc3RhcnQgPSBwcmVmaXgubGVuZ3RoICsgKG5lZWRzU3BhY2UgPyAxIDogMClcbiAgICBjb25zdCBlbmQgPSBzdGFydCArIHZvaWNlSW50ZXJpbVRyYW5zY3JpcHQubGVuZ3RoXG4gICAgcmV0dXJuIHsgc3RhcnQsIGVuZCB9XG4gIH0sIFt2b2ljZUludGVyaW1UcmFuc2NyaXB0XSlcblxuICByZXR1cm4ge1xuICAgIHN0cmlwVHJhaWxpbmcsXG4gICAgcmVzZXRBbmNob3IsXG4gICAgaGFuZGxlS2V5RXZlbnQ6IHZvaWNlLmhhbmRsZUtleUV2ZW50LFxuICAgIGludGVyaW1SYW5nZSxcbiAgfVxufVxuXG4vKipcbiAqIENvbXBvbmVudCB0aGF0IGhhbmRsZXMgaG9sZC10by10YWxrIHZvaWNlIGFjdGl2YXRpb24uXG4gKlxuICogVGhlIGFjdGl2YXRpb24ga2V5IGlzIGNvbmZpZ3VyYWJsZSB2aWEga2V5YmluZGluZ3MgKHZvaWNlOnB1c2hUb1RhbGssXG4gKiBkZWZhdWx0OiBzcGFjZSkuIEhvbGQgZGV0ZWN0aW9uIGRlcGVuZHMgb24gT1MgYXV0by1yZXBlYXQgZGVsaXZlcmluZyBhXG4gKiBzdHJlYW0gb2YgZXZlbnRzIGF0IDMwLTgwbXMgaW50ZXJ2YWxzLiBUd28gYmluZGluZyB0eXBlcyB3b3JrOlxuICpcbiAqICoqTW9kaWZpZXIgKyBsZXR0ZXIgKG1ldGEraywgY3RybCt4LCBhbHQrdik6KiogQ2xlYW5lc3QuIEFjdGl2YXRlcyBvblxuICogdGhlIGZpcnN0IHByZXNzIOKAlCBhIG1vZGlmaWVyIGNvbWJvIGlzIHVuYW1iaWd1b3VzIGludGVudCAoY2FuJ3QgYmVcbiAqIHR5cGVkIGFjY2lkZW50YWxseSksIHNvIG5vIGhvbGQgdGhyZXNob2xkIGFwcGxpZXMuIFRoZSBsZXR0ZXIgcGFydFxuICogYXV0by1yZXBlYXRzIHdoaWxlIGhlbGQsIGZlZWRpbmcgcmVsZWFzZSBkZXRlY3Rpb24gaW4gdXNlVm9pY2UudHMuXG4gKiBObyBmbG93LXRocm91Z2gsIG5vIHN0cmlwcGluZy5cbiAqXG4gKiAqKkJhcmUgY2hhcnMgKHNwYWNlLCB2LCB4KToqKiBSZXF1aXJlIEhPTERfVEhSRVNIT0xEIHJhcGlkIHByZXNzZXMgdG9cbiAqIGFjdGl2YXRlIChhIHNpbmdsZSBzcGFjZSBjb3VsZCBiZSBub3JtYWwgdHlwaW5nKS4gVGhlIGZpcnN0XG4gKiBXQVJNVVBfVEhSRVNIT0xEIHByZXNzZXMgZmxvdyBpbnRvIHRoZSBpbnB1dCBzbyBhIHNpbmdsZSBwcmVzcyB0eXBlc1xuICogbm9ybWFsbHkuIFBhc3QgdGhhdCwgcmFwaWQgcHJlc3NlcyBhcmUgc3dhbGxvd2VkOyBvbiBhY3RpdmF0aW9uIHRoZVxuICogZmxvdy10aHJvdWdoIGNoYXJzIGFyZSBzdHJpcHBlZC4gQmluZGluZyBcInZcIiBkb2Vzbid0IG1ha2UgXCJ2XCJcbiAqIHVudHlwYWJsZSDigJQgbm9ybWFsIHR5cGluZyAoPjEyMG1zIGJldHdlZW4ga2V5c3Ryb2tlcykgZmxvd3MgdGhyb3VnaDtcbiAqIG9ubHkgcmFwaWQgYXV0by1yZXBlYXQgZnJvbSBhIGhlbGQga2V5IHRyaWdnZXJzIGFjdGl2YXRpb24uXG4gKlxuICogS25vd24gYnJva2VuOiBtb2RpZmllcitzcGFjZSAoTlVMIOKGkiBwYXJzZWQgYXMgY3RybCtiYWNrdGljayksIGNob3Jkc1xuICogKGRpc2NyZXRlIHNlcXVlbmNlcywgbm8gaG9sZCkuIFZhbGlkYXRpb24gd2FybnMgb24gdGhlc2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1c2VWb2ljZUtleWJpbmRpbmdIYW5kbGVyKHtcbiAgdm9pY2VIYW5kbGVLZXlFdmVudCxcbiAgc3RyaXBUcmFpbGluZyxcbiAgcmVzZXRBbmNob3IsXG4gIGlzQWN0aXZlLFxufToge1xuICB2b2ljZUhhbmRsZUtleUV2ZW50OiAoZmFsbGJhY2tNcz86IG51bWJlcikgPT4gdm9pZFxuICBzdHJpcFRyYWlsaW5nOiAobWF4U3RyaXA6IG51bWJlciwgb3B0cz86IFN0cmlwT3B0cykgPT4gbnVtYmVyXG4gIHJlc2V0QW5jaG9yOiAoKSA9PiB2b2lkXG4gIGlzQWN0aXZlOiBib29sZWFuXG59KTogeyBoYW5kbGVLZXlEb3duOiAoZTogS2V5Ym9hcmRFdmVudCkgPT4gdm9pZCB9IHtcbiAgY29uc3QgZ2V0Vm9pY2VTdGF0ZSA9IHVzZUdldFZvaWNlU3RhdGUoKVxuICBjb25zdCBzZXRWb2ljZVN0YXRlID0gdXNlU2V0Vm9pY2VTdGF0ZSgpXG4gIGNvbnN0IGtleWJpbmRpbmdDb250ZXh0ID0gdXNlT3B0aW9uYWxLZXliaW5kaW5nQ29udGV4dCgpXG4gIGNvbnN0IGlzTW9kYWxPdmVybGF5QWN0aXZlID0gdXNlSXNNb2RhbE92ZXJsYXlBY3RpdmUoKVxuICAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gIGNvbnN0IHZvaWNlRW5hYmxlZCA9IGZlYXR1cmUoJ1ZPSUNFX01PREUnKSA/IHVzZVZvaWNlRW5hYmxlZCgpIDogZmFsc2VcbiAgY29uc3Qgdm9pY2VTdGF0ZSA9IGZlYXR1cmUoJ1ZPSUNFX01PREUnKVxuICAgID8gLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICAgICAgdXNlVm9pY2VTdGF0ZShzID0+IHMudm9pY2VTdGF0ZSlcbiAgICA6ICdpZGxlJ1xuXG4gIC8vIEZpbmQgdGhlIGNvbmZpZ3VyZWQga2V5IGZvciB2b2ljZTpwdXNoVG9UYWxrIGZyb20ga2V5YmluZGluZyBjb250ZXh0LlxuICAvLyBGb3J3YXJkIGl0ZXJhdGlvbiB3aXRoIGxhc3Qtd2lucyAobWF0Y2hpbmcgdGhlIHJlc29sdmVyKTogaWYgYSBsYXRlclxuICAvLyBDaGF0IGJpbmRpbmcgb3ZlcnJpZGVzIHRoZSBzYW1lIGNob3JkIHdpdGggbnVsbCBvciBhIGRpZmZlcmVudFxuICAvLyBhY3Rpb24sIHRoZSB2b2ljZSBiaW5kaW5nIGlzIGRpc2NhcmRlZCBhbmQgbnVsbCBpcyByZXR1cm5lZCDigJQgdGhlXG4gIC8vIHVzZXIgZXhwbGljaXRseSBkaXNhYmxlZCBob2xkLXRvLXRhbGsgdmlhIGJpbmRpbmcgb3ZlcnJpZGUsIHNvXG4gIC8vIGRvbid0IHNlY29uZC1ndWVzcyB0aGVtIHdpdGggYSBmYWxsYmFjay4gVGhlIERFRkFVTFQgaXMgb25seSB1c2VkXG4gIC8vIHdoZW4gdGhlcmUncyBubyBwcm92aWRlciBhdCBhbGwuIENvbnRleHQgZmlsdGVyIGlzIHJlcXVpcmVkIOKAlCBzcGFjZVxuICAvLyBpcyBhbHNvIGJvdW5kIGluIFNldHRpbmdzL0NvbmZpcm1hdGlvbi9QbHVnaW4gKHNlbGVjdDphY2NlcHQgZXRjLik7XG4gIC8vIHdpdGhvdXQgdGhlIGZpbHRlciB0aG9zZSB3b3VsZCBudWxsIG91dCB0aGUgZGVmYXVsdC5cbiAgY29uc3Qgdm9pY2VLZXlzdHJva2UgPSB1c2VNZW1vKCgpOiBQYXJzZWRLZXlzdHJva2UgfCBudWxsID0+IHtcbiAgICBpZiAoIWtleWJpbmRpbmdDb250ZXh0KSByZXR1cm4gREVGQVVMVF9WT0lDRV9LRVlTVFJPS0VcbiAgICBsZXQgcmVzdWx0OiBQYXJzZWRLZXlzdHJva2UgfCBudWxsID0gbnVsbFxuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBrZXliaW5kaW5nQ29udGV4dC5iaW5kaW5ncykge1xuICAgICAgaWYgKGJpbmRpbmcuY29udGV4dCAhPT0gJ0NoYXQnKSBjb250aW51ZVxuICAgICAgaWYgKGJpbmRpbmcuY2hvcmQubGVuZ3RoICE9PSAxKSBjb250aW51ZVxuICAgICAgY29uc3Qga3MgPSBiaW5kaW5nLmNob3JkWzBdXG4gICAgICBpZiAoIWtzKSBjb250aW51ZVxuICAgICAgaWYgKGJpbmRpbmcuYWN0aW9uID09PSAndm9pY2U6cHVzaFRvVGFsaycpIHtcbiAgICAgICAgcmVzdWx0ID0ga3NcbiAgICAgIH0gZWxzZSBpZiAocmVzdWx0ICE9PSBudWxsICYmIGtleXN0cm9rZXNFcXVhbChrcywgcmVzdWx0KSkge1xuICAgICAgICAvLyBBIGxhdGVyIGJpbmRpbmcgb3ZlcnJpZGVzIHRoaXMgY2hvcmQgKG51bGwgdW5iaW5kIG9yIHJlYXNzaWdubWVudClcbiAgICAgICAgcmVzdWx0ID0gbnVsbFxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0XG4gIH0sIFtrZXliaW5kaW5nQ29udGV4dF0pXG5cbiAgLy8gSWYgdGhlIGJpbmRpbmcgaXMgYSBiYXJlICh1bm1vZGlmaWVkKSBzaW5nbGUgcHJpbnRhYmxlIGNoYXIsIHRlcm1pbmFsXG4gIC8vIGF1dG8tcmVwZWF0IG1heSBiYXRjaCBOIGtleXN0cm9rZXMgaW50byBvbmUgaW5wdXQgZXZlbnQgKGUuZy4gXCJ2dnZcIiksXG4gIC8vIGFuZCB0aGUgY2hhciBmbG93cyBpbnRvIHRoZSB0ZXh0IGlucHV0IOKAlCB3ZSBuZWVkIGZsb3ctdGhyb3VnaCArIHN0cmlwLlxuICAvLyBNb2RpZmllciBjb21ib3MgKG1ldGEraywgY3RybCt4KSBhbHNvIGF1dG8tcmVwZWF0ICh0aGUgbGV0dGVyIHBhcnRcbiAgLy8gcmVwZWF0cykgYnV0IGRvbid0IGluc2VydCB0ZXh0LCBzbyB0aGV5J3JlIHN3YWxsb3dlZCBmcm9tIHRoZSBmaXJzdFxuICAvLyBwcmVzcyB3aXRoIG5vIHN0cmlwcGluZyBuZWVkZWQuIG1hdGNoZXNLZXlib2FyZEV2ZW50IGhhbmRsZXMgdGhvc2UuXG4gIGNvbnN0IGJhcmVDaGFyID1cbiAgICB2b2ljZUtleXN0cm9rZSAhPT0gbnVsbCAmJlxuICAgIHZvaWNlS2V5c3Ryb2tlLmtleS5sZW5ndGggPT09IDEgJiZcbiAgICAhdm9pY2VLZXlzdHJva2UuY3RybCAmJlxuICAgICF2b2ljZUtleXN0cm9rZS5hbHQgJiZcbiAgICAhdm9pY2VLZXlzdHJva2Uuc2hpZnQgJiZcbiAgICAhdm9pY2VLZXlzdHJva2UubWV0YSAmJlxuICAgICF2b2ljZUtleXN0cm9rZS5zdXBlclxuICAgICAgPyB2b2ljZUtleXN0cm9rZS5rZXlcbiAgICAgIDogbnVsbFxuXG4gIGNvbnN0IHJhcGlkQ291bnRSZWYgPSB1c2VSZWYoMClcbiAgLy8gSG93IG1hbnkgcmFwaWQgY2hhcnMgd2UgaW50ZW50aW9uYWxseSBsZXQgdGhyb3VnaCB0byB0aGUgdGV4dFxuICAvLyBpbnB1dCAodGhlIGZpcnN0IFdBUk1VUF9USFJFU0hPTEQpLiBUaGUgYWN0aXZhdGlvbiBzdHJpcCByZW1vdmVzXG4gIC8vIHVwIHRvIHRoaXMgbWFueSArIHRoZSBhY3RpdmF0aW9uIGV2ZW50J3MgcG90ZW50aWFsIGxlYWsuIEZvciB0aGVcbiAgLy8gZGVmYXVsdCAoc3BhY2UpIHRoaXMgaXMgcHJlY2lzZSDigJQgcHJlLWV4aXN0aW5nIHRyYWlsaW5nIHNwYWNlcyBhcmVcbiAgLy8gcmFyZS4gRm9yIGxldHRlciBiaW5kaW5ncyAodmFsaWRhdGlvbiB3YXJucykgdGhpcyBtYXkgb3Zlci1zdHJpcFxuICAvLyBvbmUgcHJlLWV4aXN0aW5nIGNoYXIgaWYgdGhlIGlucHV0IGFscmVhZHkgZW5kZWQgaW4gdGhlIGJvdW5kXG4gIC8vIGxldHRlciAoZS5nLiBcImhhdlwiICsgaG9sZCBcInZcIiDihpIgXCJoYVwiKS4gV2UgZG9uJ3QgdHJhY2sgdGhhdFxuICAvLyBib3VuZGFyeSDigJQgaXQncyBiZXN0LWVmZm9ydCBhbmQgdGhlIHdhcm5pbmcgc2F5cyBzby5cbiAgY29uc3QgY2hhcnNJbklucHV0UmVmID0gdXNlUmVmKDApXG4gIC8vIFRyYWlsaW5nLWNoYXIgY291bnQgcmVtYWluaW5nIGFmdGVyIHRoZSBhY3RpdmF0aW9uIHN0cmlwIOKAlCB0aGVzZVxuICAvLyBiZWxvbmcgdG8gdGhlIHVzZXIncyBhbmNob3JlZCBwcmVmaXggYW5kIG11c3QgYmUgcHJlc2VydmVkIGR1cmluZ1xuICAvLyByZWNvcmRpbmcncyBkZWZlbnNpdmUgbGVhayBjbGVhbnVwLlxuICBjb25zdCByZWNvcmRpbmdGbG9vclJlZiA9IHVzZVJlZigwKVxuICAvLyBUcnVlIHdoZW4gdGhlIGN1cnJlbnQgcmVjb3JkaW5nIHdhcyBzdGFydGVkIGJ5IGtleS1ob2xkIChub3QgZm9jdXMpLlxuICAvLyBVc2VkIHRvIGF2b2lkIHN3YWxsb3dpbmcga2V5cHJlc3NlcyBkdXJpbmcgZm9jdXMtbW9kZSByZWNvcmRpbmcuXG4gIGNvbnN0IGlzSG9sZEFjdGl2ZVJlZiA9IHVzZVJlZihmYWxzZSlcbiAgY29uc3QgcmVzZXRUaW1lclJlZiA9IHVzZVJlZjxSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGw+KG51bGwpXG5cbiAgLy8gUmVzZXQgaG9sZCBzdGF0ZSBhcyBzb29uIGFzIHdlIGxlYXZlICdyZWNvcmRpbmcnLiBUaGUgcGh5c2ljYWwgaG9sZFxuICAvLyBlbmRzIHdoZW4ga2V5LXJlcGVhdCBzdG9wcyAoc3RhdGUg4oaSICdwcm9jZXNzaW5nJyk7IGtlZXBpbmcgdGhlIHJlZlxuICAvLyBzZXQgdGhyb3VnaCAncHJvY2Vzc2luZycgc3dhbGxvd3MgbmV3IHNwYWNlIHByZXNzZXMgdGhlIHVzZXIgdHlwZXNcbiAgLy8gd2hpbGUgdGhlIHRyYW5zY3JpcHQgZmluYWxpemVzLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICh2b2ljZVN0YXRlICE9PSAncmVjb3JkaW5nJykge1xuICAgICAgaXNIb2xkQWN0aXZlUmVmLmN1cnJlbnQgPSBmYWxzZVxuICAgICAgcmFwaWRDb3VudFJlZi5jdXJyZW50ID0gMFxuICAgICAgY2hhcnNJbklucHV0UmVmLmN1cnJlbnQgPSAwXG4gICAgICByZWNvcmRpbmdGbG9vclJlZi5jdXJyZW50ID0gMFxuICAgICAgc2V0Vm9pY2VTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgaWYgKCFwcmV2LnZvaWNlV2FybWluZ1VwKSByZXR1cm4gcHJldlxuICAgICAgICByZXR1cm4geyAuLi5wcmV2LCB2b2ljZVdhcm1pbmdVcDogZmFsc2UgfVxuICAgICAgfSlcbiAgICB9XG4gIH0sIFt2b2ljZVN0YXRlLCBzZXRWb2ljZVN0YXRlXSlcblxuICBjb25zdCBoYW5kbGVLZXlEb3duID0gKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkID0+IHtcbiAgICBpZiAoIXZvaWNlRW5hYmxlZCkgcmV0dXJuXG5cbiAgICAvLyBQcm9tcHRJbnB1dCBpcyBub3QgYSB2YWxpZCB0cmFuc2NyaXB0IHRhcmdldCDigJQgbGV0IHRoZSBob2xkIGtleVxuICAgIC8vIGZsb3cgdGhyb3VnaCBpbnN0ZWFkIG9mIHN3YWxsb3dpbmcgaXQgaW50byBzdGFsZSByZWZzICgjMzM1NTYpLlxuICAgIC8vIFR3byBkaXN0aW5jdCB1bm1vdW50L3VuZm9jdXMgcGF0aHMgKGJvdGggbmVlZGVkKTpcbiAgICAvLyAgIC0gIWlzQWN0aXZlOiBsb2NhbC1qc3ggY29tbWFuZCBoaWQgUHJvbXB0SW5wdXQgKHNob3VsZEhpZGVQcm9tcHRJbnB1dClcbiAgICAvLyAgICAgd2l0aG91dCByZWdpc3RlcmluZyBhbiBvdmVybGF5IOKAlCBlLmcuIC9pbnN0YWxsLWdpdGh1Yi1hcHAsXG4gICAgLy8gICAgIC9wbHVnaW4uIE1pcnJvcnMgQ29tbWFuZEtleWJpbmRpbmdIYW5kbGVycycgaXNBY3RpdmUgZ2F0ZS5cbiAgICAvLyAgIC0gaXNNb2RhbE92ZXJsYXlBY3RpdmU6IG92ZXJsYXkgKHBlcm1pc3Npb24gZGlhbG9nLCBTZWxlY3Qgd2l0aFxuICAgIC8vICAgICBvbkNhbmNlbCkgaGFzIGZvY3VzOyBQcm9tcHRJbnB1dCBpcyBtb3VudGVkIGJ1dCBmb2N1cz1mYWxzZS5cbiAgICBpZiAoIWlzQWN0aXZlIHx8IGlzTW9kYWxPdmVybGF5QWN0aXZlKSByZXR1cm5cblxuICAgIC8vIG51bGwgbWVhbnMgdGhlIHVzZXIgb3ZlcnJvZGUgdGhlIGRlZmF1bHQgKG51bGwtdW5iaW5kL3JlYXNzaWduKSDigJRcbiAgICAvLyBob2xkLXRvLXRhbGsgaXMgZGlzYWJsZWQgdmlhIGJpbmRpbmcuIFRvIHRvZ2dsZSB0aGUgZmVhdHVyZVxuICAgIC8vIGl0c2VsZiwgdXNlIC92b2ljZS5cbiAgICBpZiAodm9pY2VLZXlzdHJva2UgPT09IG51bGwpIHJldHVyblxuXG4gICAgLy8gTWF0Y2ggdGhlIGNvbmZpZ3VyZWQga2V5LiBCYXJlIGNoYXJzIG1hdGNoIGJ5IGNvbnRlbnQgKGhhbmRsZXNcbiAgICAvLyBiYXRjaGVkIGF1dG8tcmVwZWF0IGxpa2UgXCJ2dnZcIikgd2l0aCBhIG1vZGlmaWVyIHJlamVjdCBzbyBlLmcuXG4gICAgLy8gY3RybCt2IGRvZXNuJ3QgdHJpcCBhIFwidlwiIGJpbmRpbmcuIE1vZGlmaWVyIGNvbWJvcyBnbyB0aHJvdWdoXG4gICAgLy8gbWF0Y2hlc0tleWJvYXJkRXZlbnQgKG9uZSBldmVudCBwZXIgcmVwZWF0LCBubyBiYXRjaGluZykuXG4gICAgbGV0IHJlcGVhdENvdW50OiBudW1iZXJcbiAgICBpZiAoYmFyZUNoYXIgIT09IG51bGwpIHtcbiAgICAgIGlmIChlLmN0cmwgfHwgZS5tZXRhIHx8IGUuc2hpZnQpIHJldHVyblxuICAgICAgLy8gV2hlbiBib3VuZCB0byBzcGFjZSwgYWxzbyBhY2NlcHQgVSszMDAwIChmdWxsLXdpZHRoIHNwYWNlKSDigJRcbiAgICAgIC8vIENKSyBJTUVzIGVtaXQgaXQgZm9yIHRoZSBzYW1lIHBoeXNpY2FsIGtleS5cbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPVxuICAgICAgICBiYXJlQ2hhciA9PT0gJyAnID8gbm9ybWFsaXplRnVsbFdpZHRoU3BhY2UoZS5rZXkpIDogZS5rZXlcbiAgICAgIC8vIEZhc3QtcGF0aDogbm9ybWFsIHR5cGluZyAoYW55IGNoYXIgdGhhdCBpc24ndCB0aGUgYm91bmQgb25lKVxuICAgICAgLy8gYmFpbHMgaGVyZSB3aXRob3V0IGFsbG9jYXRpbmcuIFRoZSByZXBlYXQoKSBjaGVjayBvbmx5IG1hdHRlcnNcbiAgICAgIC8vIGZvciBiYXRjaGVkIGF1dG8tcmVwZWF0IChpbnB1dC5sZW5ndGggPiAxKSB3aGljaCBpcyByYXJlLlxuICAgICAgaWYgKG5vcm1hbGl6ZWRbMF0gIT09IGJhcmVDaGFyKSByZXR1cm5cbiAgICAgIGlmIChcbiAgICAgICAgbm9ybWFsaXplZC5sZW5ndGggPiAxICYmXG4gICAgICAgIG5vcm1hbGl6ZWQgIT09IGJhcmVDaGFyLnJlcGVhdChub3JtYWxpemVkLmxlbmd0aClcbiAgICAgIClcbiAgICAgICAgcmV0dXJuXG4gICAgICByZXBlYXRDb3VudCA9IG5vcm1hbGl6ZWQubGVuZ3RoXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghbWF0Y2hlc0tleWJvYXJkRXZlbnQoZSwgdm9pY2VLZXlzdHJva2UpKSByZXR1cm5cbiAgICAgIHJlcGVhdENvdW50ID0gMVxuICAgIH1cblxuICAgIC8vIEd1YXJkOiBvbmx5IHN3YWxsb3cga2V5cHJlc3NlcyB3aGVuIHJlY29yZGluZyB3YXMgdHJpZ2dlcmVkIGJ5XG4gICAgLy8ga2V5LWhvbGQuIEZvY3VzLW1vZGUgcmVjb3JkaW5nIGFsc28gc2V0cyB2b2ljZVN0YXRlIHRvICdyZWNvcmRpbmcnLFxuICAgIC8vIGJ1dCBrZXlwcmVzc2VzIHNob3VsZCBmbG93IHRocm91Z2ggbm9ybWFsbHkgKHZvaWNlSGFuZGxlS2V5RXZlbnRcbiAgICAvLyByZXR1cm5zIGVhcmx5IGZvciBmb2N1cy10cmlnZ2VyZWQgc2Vzc2lvbnMpLiBXZSBhbHNvIGNoZWNrIHZvaWNlU3RhdGVcbiAgICAvLyBmcm9tIHRoZSBzdG9yZSBzbyB0aGF0IGlmIHZvaWNlSGFuZGxlS2V5RXZlbnQoKSBmYWlscyB0byB0cmFuc2l0aW9uXG4gICAgLy8gc3RhdGUgKG1vZHVsZSBub3QgbG9hZGVkLCBzdHJlYW0gdW5hdmFpbGFibGUpIHdlIGRvbid0IHBlcm1hbmVudGx5XG4gICAgLy8gc3dhbGxvdyBrZXlwcmVzc2VzLlxuICAgIGNvbnN0IGN1cnJlbnRWb2ljZVN0YXRlID0gZ2V0Vm9pY2VTdGF0ZSgpLnZvaWNlU3RhdGVcbiAgICBpZiAoaXNIb2xkQWN0aXZlUmVmLmN1cnJlbnQgJiYgY3VycmVudFZvaWNlU3RhdGUgIT09ICdpZGxlJykge1xuICAgICAgLy8gQWxyZWFkeSByZWNvcmRpbmcg4oCUIHN3YWxsb3cgY29udGludWVkIGtleXByZXNzZXMgYW5kIGZvcndhcmRcbiAgICAgIC8vIHRvIHZvaWNlIGZvciByZWxlYXNlIGRldGVjdGlvbi4gRm9yIGJhcmUgY2hhcnMsIGRlZmVuc2l2ZWx5XG4gICAgICAvLyBzdHJpcCBpbiBjYXNlIHRoZSB0ZXh0IGlucHV0IGhhbmRsZXIgZmlyZWQgYmVmb3JlIHRoaXMgb25lXG4gICAgICAvLyAobGlzdGVuZXIgb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpLiBNb2RpZmllciBjb21ib3MgZG9uJ3RcbiAgICAgIC8vIGluc2VydCB0ZXh0LCBzbyBub3RoaW5nIHRvIHN0cmlwLlxuICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuICAgICAgaWYgKGJhcmVDaGFyICE9PSBudWxsKSB7XG4gICAgICAgIHN0cmlwVHJhaWxpbmcocmVwZWF0Q291bnQsIHtcbiAgICAgICAgICBjaGFyOiBiYXJlQ2hhcixcbiAgICAgICAgICBmbG9vcjogcmVjb3JkaW5nRmxvb3JSZWYuY3VycmVudCxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIHZvaWNlSGFuZGxlS2V5RXZlbnQoKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gTm9uLWhvbGQgcmVjb3JkaW5nIChmb2N1cy1tb2RlKSBvciBwcm9jZXNzaW5nIGlzIGFjdGl2ZS5cbiAgICAvLyBNb2RpZmllciBjb21ib3MgbXVzdCBub3QgcmUtYWN0aXZhdGU6IHN0cmlwVHJhaWxpbmcoMCx7YW5jaG9yOnRydWV9KVxuICAgIC8vIHdvdWxkIG92ZXJ3cml0ZSB2b2ljZVByZWZpeFJlZiB3aXRoIGludGVyaW0gdGV4dCBhbmQgZHVwbGljYXRlIHRoZVxuICAgIC8vIHRyYW5zY3JpcHQgb24gdGhlIG5leHQgaW50ZXJpbSB1cGRhdGUuIFByZS0jMjIxNDQsIGEgc2luZ2xlIHRhcFxuICAgIC8vIGhpdCB0aGUgd2FybXVwIGVsc2UtYnJhbmNoIChzd2FsbG93IG9ubHkpLiBCYXJlIGNoYXJzIGZsb3cgdGhyb3VnaFxuICAgIC8vIHVuY29uZGl0aW9uYWxseSDigJQgdXNlciBtYXkgYmUgdHlwaW5nIGR1cmluZyBmb2N1cy1yZWNvcmRpbmcuXG4gICAgaWYgKGN1cnJlbnRWb2ljZVN0YXRlICE9PSAnaWRsZScpIHtcbiAgICAgIGlmIChiYXJlQ2hhciA9PT0gbnVsbCkgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3QgY291bnRCZWZvcmUgPSByYXBpZENvdW50UmVmLmN1cnJlbnRcbiAgICByYXBpZENvdW50UmVmLmN1cnJlbnQgKz0gcmVwZWF0Q291bnRcblxuICAgIC8vIOKUgOKUgCBBY3RpdmF0aW9uIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuICAgIC8vIEhhbmRsZWQgZmlyc3Qgc28gdGhlIHdhcm11cCBicmFuY2ggYmVsb3cgZG9lcyBOT1QgYWxzbyBydW5cbiAgICAvLyBvbiB0aGlzIGV2ZW50IOKAlCB0d28gc3RyaXAgY2FsbHMgaW4gdGhlIHNhbWUgdGljayB3b3VsZCBib3RoXG4gICAgLy8gcmVhZCB0aGUgc3RhbGUgaW5wdXRWYWx1ZVJlZiBhbmQgdGhlIHNlY29uZCB3b3VsZCB1bmRlci1zdHJpcC5cbiAgICAvLyBNb2RpZmllciBjb21ib3MgYWN0aXZhdGUgb24gdGhlIGZpcnN0IHByZXNzIOKAlCB0aGV5IGNhbid0IGJlXG4gICAgLy8gdHlwZWQgYWNjaWRlbnRhbGx5LCBzbyB0aGUgaG9sZCB0aHJlc2hvbGQgKHdoaWNoIGV4aXN0cyB0b1xuICAgIC8vIGRpc3Rpbmd1aXNoIHR5cGluZyBhIHNwYWNlIGZyb20gaG9sZGluZyBzcGFjZSkgZG9lc24ndCBhcHBseS5cbiAgICBpZiAoYmFyZUNoYXIgPT09IG51bGwgfHwgcmFwaWRDb3VudFJlZi5jdXJyZW50ID49IEhPTERfVEhSRVNIT0xEKSB7XG4gICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpXG4gICAgICBpZiAocmVzZXRUaW1lclJlZi5jdXJyZW50KSB7XG4gICAgICAgIGNsZWFyVGltZW91dChyZXNldFRpbWVyUmVmLmN1cnJlbnQpXG4gICAgICAgIHJlc2V0VGltZXJSZWYuY3VycmVudCA9IG51bGxcbiAgICAgIH1cbiAgICAgIHJhcGlkQ291bnRSZWYuY3VycmVudCA9IDBcbiAgICAgIGlzSG9sZEFjdGl2ZVJlZi5jdXJyZW50ID0gdHJ1ZVxuICAgICAgc2V0Vm9pY2VTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgaWYgKCFwcmV2LnZvaWNlV2FybWluZ1VwKSByZXR1cm4gcHJldlxuICAgICAgICByZXR1cm4geyAuLi5wcmV2LCB2b2ljZVdhcm1pbmdVcDogZmFsc2UgfVxuICAgICAgfSlcbiAgICAgIGlmIChiYXJlQ2hhciAhPT0gbnVsbCkge1xuICAgICAgICAvLyBTdHJpcCB0aGUgaW50ZW50aW9uYWwgd2FybXVwIGNoYXJzIHBsdXMgdGhpcyBldmVudCdzIGxlYWtcbiAgICAgICAgLy8gKGlmIHRleHQgaW5wdXQgZmlyZWQgZmlyc3QpLiBDYXAgY292ZXJzIGJvdGg7IG1pbih0cmFpbGluZylcbiAgICAgICAgLy8gaGFuZGxlcyB0aGUgbm8tbGVhayBjYXNlLiBBbmNob3IgdGhlIHZvaWNlIHByZWZpeCBoZXJlLlxuICAgICAgICAvLyBUaGUgcmV0dXJuIHZhbHVlIChyZW1haW5pbmcpIGJlY29tZXMgdGhlIGZsb29yIGZvclxuICAgICAgICAvLyByZWNvcmRpbmctdGltZSBsZWFrIGNsZWFudXAuXG4gICAgICAgIHJlY29yZGluZ0Zsb29yUmVmLmN1cnJlbnQgPSBzdHJpcFRyYWlsaW5nKFxuICAgICAgICAgIGNoYXJzSW5JbnB1dFJlZi5jdXJyZW50ICsgcmVwZWF0Q291bnQsXG4gICAgICAgICAgeyBjaGFyOiBiYXJlQ2hhciwgYW5jaG9yOiB0cnVlIH0sXG4gICAgICAgIClcbiAgICAgICAgY2hhcnNJbklucHV0UmVmLmN1cnJlbnQgPSAwXG4gICAgICAgIHZvaWNlSGFuZGxlS2V5RXZlbnQoKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTW9kaWZpZXIgY29tYm86IG5vdGhpbmcgaW5zZXJ0ZWQsIG5vdGhpbmcgdG8gc3RyaXAuIEp1c3RcbiAgICAgICAgLy8gYW5jaG9yIHRoZSB2b2ljZSBwcmVmaXggYXQgdGhlIGN1cnJlbnQgY3Vyc29yIHBvc2l0aW9uLlxuICAgICAgICAvLyBMb25nZXIgZmFsbGJhY2s6IHRoaXMgY2FsbCBpcyBhdCB0PTAgKGJlZm9yZSBhdXRvLXJlcGVhdCksXG4gICAgICAgIC8vIHNvIHRoZSBnYXAgdG8gdGhlIG5leHQga2V5cHJlc3MgaXMgdGhlIE9TIGluaXRpYWwgcmVwZWF0XG4gICAgICAgIC8vICpkZWxheSogKHVwIHRvIH4ycyksIG5vdCB0aGUgcmVwZWF0ICpyYXRlKiAofjMwLTgwbXMpLlxuICAgICAgICBzdHJpcFRyYWlsaW5nKDAsIHsgYW5jaG9yOiB0cnVlIH0pXG4gICAgICAgIHZvaWNlSGFuZGxlS2V5RXZlbnQoTU9ESUZJRVJfRklSU1RfUFJFU1NfRkFMTEJBQ0tfTVMpXG4gICAgICB9XG4gICAgICAvLyBJZiB2b2ljZSBmYWlsZWQgdG8gdHJhbnNpdGlvbiAobW9kdWxlIG5vdCBsb2FkZWQsIHN0cmVhbVxuICAgICAgLy8gdW5hdmFpbGFibGUsIHN0YWxlIGVuYWJsZWQpLCBjbGVhciB0aGUgcmVmIHNvIGEgbGF0ZXJcbiAgICAgIC8vIGZvY3VzLW1vZGUgcmVjb3JkaW5nIGRvZXNuJ3QgaW5oZXJpdCBzdGFsZSBob2xkIHN0YXRlXG4gICAgICAvLyBhbmQgc3dhbGxvdyBrZXlwcmVzc2VzLiBTdG9yZSBpcyBzeW5jaHJvbm91cyDigJQgdGhlIGNoZWNrIGlzXG4gICAgICAvLyBpbW1lZGlhdGUuIFRoZSBhbmNob3Igc2V0IGJ5IHN0cmlwVHJhaWxpbmcgYWJvdmUgd2lsbFxuICAgICAgLy8gYmUgb3ZlcndyaXR0ZW4gb24gcmV0cnkgKGFuY2hvciBhbHdheXMgb3ZlcndyaXRlcyBub3cpLlxuICAgICAgaWYgKGdldFZvaWNlU3RhdGUoKS52b2ljZVN0YXRlID09PSAnaWRsZScpIHtcbiAgICAgICAgaXNIb2xkQWN0aXZlUmVmLmN1cnJlbnQgPSBmYWxzZVxuICAgICAgICByZXNldEFuY2hvcigpXG4gICAgICB9XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyDilIDilIAgV2FybXVwIChiYXJlLWNoYXIgb25seTsgbW9kaWZpZXIgY29tYm9zIGFjdGl2YXRlZCBhYm92ZSkg4pSA4pSAXG4gICAgLy8gRmlyc3QgV0FSTVVQX1RIUkVTSE9MRCBjaGFycyBmbG93IHRvIHRoZSB0ZXh0IGlucHV0IHNvIG5vcm1hbFxuICAgIC8vIHR5cGluZyBoYXMgemVybyBsYXRlbmN5IChhIHNpbmdsZSBwcmVzcyB0eXBlcyBub3JtYWxseSkuXG4gICAgLy8gU3Vic2VxdWVudCByYXBpZCBjaGFycyBhcmUgc3dhbGxvd2VkIHNvIHRoZSBpbnB1dCBzdGF5cyBhbGlnbmVkXG4gICAgLy8gd2l0aCB0aGUgd2FybXVwIFVJLiBTdHJpcCBkZWZlbnNpdmVseSAobGlzdGVuZXIgb3JkZXIgaXMgbm90XG4gICAgLy8gZ3VhcmFudGVlZCDigJQgdGV4dCBpbnB1dCBtYXkgaGF2ZSBhbHJlYWR5IGFkZGVkIHRoZSBjaGFyKS4gVGhlXG4gICAgLy8gZmxvb3IgcHJlc2VydmVzIHRoZSBpbnRlbnRpb25hbCB3YXJtdXAgY2hhcnM7IHRoZSBzdHJpcCBpcyBhXG4gICAgLy8gbm8tb3Agd2hlbiBub3RoaW5nIGxlYWtlZC4gQ2hlY2sgY291bnRCZWZvcmUgc28gdGhlIGV2ZW50IHRoYXRcbiAgICAvLyBjcm9zc2VzIHRoZSB0aHJlc2hvbGQgc3RpbGwgZmxvd3MgdGhyb3VnaCAodGVybWluYWwgYmF0Y2hpbmcpLlxuICAgIGlmIChjb3VudEJlZm9yZSA+PSBXQVJNVVBfVEhSRVNIT0xEKSB7XG4gICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpXG4gICAgICBzdHJpcFRyYWlsaW5nKHJlcGVhdENvdW50LCB7XG4gICAgICAgIGNoYXI6IGJhcmVDaGFyLFxuICAgICAgICBmbG9vcjogY2hhcnNJbklucHV0UmVmLmN1cnJlbnQsXG4gICAgICB9KVxuICAgIH0gZWxzZSB7XG4gICAgICBjaGFyc0luSW5wdXRSZWYuY3VycmVudCArPSByZXBlYXRDb3VudFxuICAgIH1cblxuICAgIC8vIFNob3cgd2FybXVwIGZlZWRiYWNrIG9uY2Ugd2UgZGV0ZWN0IGEgaG9sZCBwYXR0ZXJuXG4gICAgaWYgKHJhcGlkQ291bnRSZWYuY3VycmVudCA+PSBXQVJNVVBfVEhSRVNIT0xEKSB7XG4gICAgICBzZXRWb2ljZVN0YXRlKHByZXYgPT4ge1xuICAgICAgICBpZiAocHJldi52b2ljZVdhcm1pbmdVcCkgcmV0dXJuIHByZXZcbiAgICAgICAgcmV0dXJuIHsgLi4ucHJldiwgdm9pY2VXYXJtaW5nVXA6IHRydWUgfVxuICAgICAgfSlcbiAgICB9XG5cbiAgICBpZiAocmVzZXRUaW1lclJlZi5jdXJyZW50KSB7XG4gICAgICBjbGVhclRpbWVvdXQocmVzZXRUaW1lclJlZi5jdXJyZW50KVxuICAgIH1cbiAgICByZXNldFRpbWVyUmVmLmN1cnJlbnQgPSBzZXRUaW1lb3V0KFxuICAgICAgKHJlc2V0VGltZXJSZWYsIHJhcGlkQ291bnRSZWYsIGNoYXJzSW5JbnB1dFJlZiwgc2V0Vm9pY2VTdGF0ZSkgPT4ge1xuICAgICAgICByZXNldFRpbWVyUmVmLmN1cnJlbnQgPSBudWxsXG4gICAgICAgIHJhcGlkQ291bnRSZWYuY3VycmVudCA9IDBcbiAgICAgICAgY2hhcnNJbklucHV0UmVmLmN1cnJlbnQgPSAwXG4gICAgICAgIHNldFZvaWNlU3RhdGUocHJldiA9PiB7XG4gICAgICAgICAgaWYgKCFwcmV2LnZvaWNlV2FybWluZ1VwKSByZXR1cm4gcHJldlxuICAgICAgICAgIHJldHVybiB7IC4uLnByZXYsIHZvaWNlV2FybWluZ1VwOiBmYWxzZSB9XG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgICAgUkFQSURfS0VZX0dBUF9NUyxcbiAgICAgIHJlc2V0VGltZXJSZWYsXG4gICAgICByYXBpZENvdW50UmVmLFxuICAgICAgY2hhcnNJbklucHV0UmVmLFxuICAgICAgc2V0Vm9pY2VTdGF0ZSxcbiAgICApXG4gIH1cblxuICAvLyBCYWNrd2FyZC1jb21wYXQgYnJpZGdlOiBSRVBMLnRzeCBkb2Vzbid0IHlldCB3aXJlIGhhbmRsZUtleURvd24gdG9cbiAgLy8gPEJveCBvbktleURvd24+LiBTdWJzY3JpYmUgdmlhIHVzZUlucHV0IGFuZCBhZGFwdCBJbnB1dEV2ZW50IOKGklxuICAvLyBLZXlib2FyZEV2ZW50IHVudGlsIHRoZSBjb25zdW1lciBpcyBtaWdyYXRlZCAoc2VwYXJhdGUgUFIpLlxuICAvLyBUT0RPKG9uS2V5RG93bi1taWdyYXRpb24pOiByZW1vdmUgb25jZSBSRVBMIHBhc3NlcyBoYW5kbGVLZXlEb3duLlxuICB1c2VJbnB1dChcbiAgICAoX2lucHV0LCBfa2V5LCBldmVudCkgPT4ge1xuICAgICAgY29uc3Qga2JFdmVudCA9IG5ldyBLZXlib2FyZEV2ZW50KGV2ZW50LmtleXByZXNzKVxuICAgICAgaGFuZGxlS2V5RG93bihrYkV2ZW50KVxuICAgICAgLy8gaGFuZGxlS2V5RG93biBzdG9wcGVkIHRoZSBhZGFwdGVyIGV2ZW50LCBub3QgdGhlIElucHV0RXZlbnQgdGhlXG4gICAgICAvLyBlbWl0dGVyIGFjdHVhbGx5IGNoZWNrcyDigJQgZm9yd2FyZCBpdCBzbyB0aGUgdGV4dCBpbnB1dCdzIHVzZUlucHV0XG4gICAgICAvLyBsaXN0ZW5lciBpcyBza2lwcGVkIGFuZCBoZWxkIHNwYWNlcyBkb24ndCBsZWFrIGludG8gdGhlIHByb21wdC5cbiAgICAgIGlmIChrYkV2ZW50LmRpZFN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpKSB7XG4gICAgICAgIGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpXG4gICAgICB9XG4gICAgfSxcbiAgICB7IGlzQWN0aXZlIH0sXG4gIClcblxuICByZXR1cm4geyBoYW5kbGVLZXlEb3duIH1cbn1cblxuLy8gVE9ETyhvbktleURvd24tbWlncmF0aW9uKTogdGVtcG9yYXJ5IHNoaW0gc28gZXhpc3RpbmcgSlNYIGNhbGxlcnNcbi8vICg8Vm9pY2VLZXliaW5kaW5nSGFuZGxlciAuLi4vPikga2VlcCBjb21waWxpbmcuIFJlbW92ZSBvbmNlIFJFUEwudHN4XG4vLyB3aXJlcyBoYW5kbGVLZXlEb3duIGRpcmVjdGx5LlxuZXhwb3J0IGZ1bmN0aW9uIFZvaWNlS2V5YmluZGluZ0hhbmRsZXIocHJvcHM6IHtcbiAgdm9pY2VIYW5kbGVLZXlFdmVudDogKGZhbGxiYWNrTXM/OiBudW1iZXIpID0+IHZvaWRcbiAgc3RyaXBUcmFpbGluZzogKG1heFN0cmlwOiBudW1iZXIsIG9wdHM/OiBTdHJpcE9wdHMpID0+IG51bWJlclxuICByZXNldEFuY2hvcjogKCkgPT4gdm9pZFxuICBpc0FjdGl2ZTogYm9vbGVhblxufSk6IG51bGwge1xuICB1c2VWb2ljZUtleWJpbmRpbmdIYW5kbGVyKHByb3BzKVxuICByZXR1cm4gbnVsbFxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQSxTQUFTQSxPQUFPLFFBQVEsWUFBWTtBQUNwQyxPQUFPLEtBQUtDLEtBQUssTUFBTSxPQUFPO0FBQzlCLFNBQVNDLFdBQVcsRUFBRUMsU0FBUyxFQUFFQyxPQUFPLEVBQUVDLE1BQU0sUUFBUSxPQUFPO0FBQy9ELFNBQVNDLGdCQUFnQixRQUFRLDZCQUE2QjtBQUM5RCxTQUFTQyx1QkFBdUIsUUFBUSw4QkFBOEI7QUFDdEUsU0FDRUMsZ0JBQWdCLEVBQ2hCQyxnQkFBZ0IsRUFDaEJDLGFBQWEsUUFDUixxQkFBcUI7QUFDNUIsU0FBU0MsYUFBYSxRQUFRLGlDQUFpQztBQUMvRDtBQUNBLFNBQVNDLFFB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