import type { Key } from '../ink.js'
import { getKeyName, matchesBinding } from './match.js'
import { chordToString } from './parser.js'
import type {
  KeybindingContextName,
  ParsedBinding,
  ParsedKeystroke,
} from './types.js'

export type ResolveResult =
  | { type: 'match'; action: string }
  | { type: 'none' }
  | { type: 'unbound' }

export type ChordResolveResult =
  | { type: 'match'; action: string }
  | { type: 'none' }
  | { type: 'unbound' }
  | { type: 'chord_started'; pending: ParsedKeystroke[] }
  | { type: 'chord_cancelled' }

/**
 * Resolve a key input to an action.
 * Pure function - no state, no side effects, just matching logic.
 *
 * @param input - The character input from Ink
 * @param key - The Key object from Ink with modifier flags
 * @param activeContexts - Array of currently active contexts (e.g., ['Chat', 'Global'])
 * @param bindings - All parsed bindings to search through
 * @returns The resolution result
 */
export function resolveKey(
  input: string,
  key: Key,
  activeContexts: KeybindingContextName[],
  bindings: ParsedBinding[],
): ResolveResult {
  // Find matching bindings (last one wins for user overrides)
  let match: ParsedBinding | undefined
  const ctxSet = new Set(activeContexts)

  for (const binding of bindings) {
    // Phase 1: Only single-keystroke bindings
    if (binding.chord.length !== 1) continue
    if (!ctxSet.has(binding.context)) continue

    if (matchesBinding(input, key, binding)) {
      match = binding
    }
  }

  if (!match) {
    return { type: 'none' }
  }

  if (match.action === null) {
    return { type: 'unbound' }
  }

  return { type: 'match', action: match.action }
}

/**
 * Get display text for an action from bindings (e.g., "ctrl+t" for "app:toggleTodos").
 * Searches in reverse order so user overrides take precedence.
 */
export function getBindingDisplayText(
  action: string,
  context: KeybindingContextName,
  bindings: ParsedBinding[],
): string | undefined {
  // Find the last binding for this action in this context
  const binding = bindings.findLast(
    b => b.action === action && b.context === context,
  )
  return binding ? chordToString(binding.chord) : undefined
}

/**
 * Build a ParsedKeystroke from Ink's input/key.
 */
function buildKeystroke(input: string, key: Key): ParsedKeystroke | null {
  const keyName = getKeyName(input, key)
  if (!keyName) return null

  // QUIRK: Ink sets key.meta=true when escape is pressed (see input-event.ts).
  // This is legacy terminal behavior - we should NOT record this as a modifier
  // for the escape key itself, otherwise chord matching will fail.
  const effectiveMeta = key.escape ? false : key.meta

  return {
    key: keyName,
    ctrl: key.ctrl,
    alt: effectiveMeta,
    shift: key.shift,
    meta: effectiveMeta,
    super: key.super,
  }
}

/**
 * Compare two ParsedKeystrokes for equality. Collapses alt/meta into
 * one logical modifier — legacy terminals can't distinguish them (see
 * match.ts modifiersMatch), so "alt+k" and "meta+k" are the same key.
 * Super (cmd/win) is distinct — only arrives via kitty keyboard protocol.
 */
export function keystrokesEqual(
  a: ParsedKeystroke,
  b: ParsedKeystroke,
): boolean {
  return (
    a.key === b.key &&
    a.ctrl === b.ctrl &&
    a.shift === b.shift &&
    (a.alt || a.meta) === (b.alt || b.meta) &&
    a.super === b.super
  )
}

/**
 * Check if a chord prefix matches the beginning of a binding's chord.
 */
function chordPrefixMatches(
  prefix: ParsedKeystroke[],
  binding: ParsedBinding,
): boolean {
  if (prefix.length >= binding.chord.length) return false
  for (let i = 0; i < prefix.length; i++) {
    const prefixKey = prefix[i]
    const bindingKey = binding.chord[i]
    if (!prefixKey || !bindingKey) return false
    if (!keystrokesEqual(prefixKey, bindingKey)) return false
  }
  return true
}

/**
 * Check if a full chord matches a binding's chord.
 */
function chordExactlyMatches(
  chord: ParsedKeystroke[],
  binding: ParsedBinding,
): boolean {
  if (chord.length !== binding.chord.length) return false
  for (let i = 0; i < chord.length; i++) {
    const chordKey = chord[i]
    const bindingKey = binding.chord[i]
    if (!chordKey || !bindingKey) return false
    if (!keystrokesEqual(chordKey, bindingKey)) return false
  }
  return true
}

/**
 * Resolve a key with chord state support.
 *
 * This function handles multi-keystroke chord bindings like "ctrl+k ctrl+s".
 *
 * @param input - The character input from Ink
 * @param key - The Key object from Ink with modifier flags
 * @param activeContexts - Array of currently active contexts
 * @param bindings - All parsed bindings
 * @param pending - Current chord state (null if not in a chord)
 * @returns Resolution result with chord state
 */
export function resolveKeyWithChordState(
  input: string,
  key: Key,
  activeContexts: KeybindingContextName[],
  bindings: ParsedBinding[],
  pending: ParsedKeystroke[] | null,
): ChordResolveResult {
  // Cancel chord on escape
  if (key.escape && pending !== null) {
    return { type: 'chord_cancelled' }
  }

  // Build current keystroke
  const currentKeystroke = buildKeystroke(input, key)
  if (!currentKeystroke) {
    if (pending !== null) {
      return { type: 'chord_cancelled' }
    }
    return { type: 'none' }
  }

  // Build the full chord sequence to test
  const testChord = pending
    ? [...pending, currentKeystroke]
    : [currentKeystroke]

  // Filter bindings by active contexts (Set lookup: O(n) instead of O(n·m))
  const ctxSet = new Set(activeContexts)
  const contextBindings = bindings.filter(b => ctxSet.has(b.context))

  // Check if this could be a prefix for longer chords. Group by chord
  // string so a later null-override shadows the default it unbinds —
  // otherwise null-unbinding `ctrl+x ctrl+k` still makes `ctrl+x` enter
  // chord-wait and the single-key binding on the prefix never fires.
  const chordWinners = new Map<string, string | null>()
  for (const binding of contextBindings) {
    if (
      binding.chord.length > testChord.length &&
      chordPrefixMatches(testChord, binding)
    ) {
      chordWinners.set(chordToString(binding.chord), binding.action)
    }
  }
  let hasLongerChords = false
  for (const action of chordWinners.values()) {
    if (action !== null) {
      hasLongerChords = true
      break
    }
  }

  // If this keystroke could start a longer chord, prefer that
  // (even if there's an exact single-key match)
  if (hasLongerChords) {
    return { type: 'chord_started', pending: testChord }
  }

  // Check for exact matches (last one wins)
  let exactMatch: ParsedBinding | undefined
  for (const binding of contextBindings) {
    if (chordExactlyMatches(testChord, binding)) {
      exactMatch = binding
    }
  }

  if (exactMatch) {
    if (exactMatch.action === null) {
      return { type: 'unbound' }
    }
    return { type: 'match', action: exactMatch.action }
  }

  // No match and no potential longer chords
  if (pending !== null) {
    return { type: 'chord_cancelled' }
  }

  return { type: 'none' }
}
