import type { Key } from '../ink.js'
import type { ParsedBinding, ParsedKeystroke } from './types.js'

/**
 * Modifier keys from Ink's Key type that we care about for matching.
 * Note: `fn` from Key is intentionally excluded as it's rarely used and
 * not commonly configurable in terminal applications.
 */
type InkModifiers = Pick<Key, 'ctrl' | 'shift' | 'meta' | 'super'>

/**
 * Extract modifiers from an Ink Key object.
 * This function ensures we're explicitly extracting the modifiers we care about.
 */
function getInkModifiers(key: Key): InkModifiers {
  return {
    ctrl: key.ctrl,
    shift: key.shift,
    meta: key.meta,
    super: key.super,
  }
}

/**
 * Extract the normalized key name from Ink's Key + input.
 * Maps Ink's boolean flags (key.escape, key.return, etc.) to string names
 * that match our ParsedKeystroke.key format.
 */
export function getKeyName(input: string, key: Key): string | null {
  if (key.escape) return 'escape'
  if (key.return) return 'enter'
  if (key.tab) return 'tab'
  if (key.backspace) return 'backspace'
  if (key.delete) return 'delete'
  if (key.upArrow) return 'up'
  if (key.downArrow) return 'down'
  if (key.leftArrow) return 'left'
  if (key.rightArrow) return 'right'
  if (key.pageUp) return 'pageup'
  if (key.pageDown) return 'pagedown'
  if (key.wheelUp) return 'wheelup'
  if (key.wheelDown) return 'wheeldown'
  if (key.home) return 'home'
  if (key.end) return 'end'
  if (input.length === 1) return input.toLowerCase()
  return null
}

/**
 * Check if all modifiers match between Ink Key and ParsedKeystroke.
 *
 * Alt and Meta: Ink historically set `key.meta` for Alt/Option. A `meta`
 * modifier in config is treated as an alias for `alt` — both match when
 * `key.meta` is true.
 *
 * Super (Cmd/Win): distinct from alt/meta. Only arrives via the kitty
 * keyboard protocol on supporting terminals. A `cmd`/`super` binding will
 * simply never fire on terminals that don't send it.
 */
function modifiersMatch(
  inkMods: InkModifiers,
  target: ParsedKeystroke,
): boolean {
  // Check ctrl modifier
  if (inkMods.ctrl !== target.ctrl) return false

  // Check shift modifier
  if (inkMods.shift !== target.shift) return false

  // Alt and meta both map to key.meta in Ink (terminal limitation)
  // So we check if EITHER alt OR meta is required in target
  const targetNeedsMeta = target.alt || target.meta
  if (inkMods.meta !== targetNeedsMeta) return false

  // Super (cmd/win) is a distinct modifier from alt/meta
  if (inkMods.super !== target.super) return false

  return true
}

/**
 * Check if a ParsedKeystroke matches the given Ink input + Key.
 *
 * The display text will show platform-appropriate names (opt on macOS, alt elsewhere).
 */
export function matchesKeystroke(
  input: string,
  key: Key,
  target: ParsedKeystroke,
): boolean {
  const keyName = getKeyName(input, key)
  if (keyName !== target.key) return false

  const inkMods = getInkModifiers(key)

  // QUIRK: Ink sets key.meta=true when escape is pressed (see input-event.ts).
  // This is a legacy behavior from how escape sequences work in terminals.
  // We need to ignore the meta modifier when matching the escape key itself,
  // otherwise bindings like "escape" (without modifiers) would never match.
  if (key.escape) {
    return modifiersMatch({ ...inkMods, meta: false }, target)
  }

  return modifiersMatch(inkMods, target)
}

/**
 * Check if Ink's Key + input matches a parsed binding's first keystroke.
 * For single-keystroke bindings only (Phase 1).
 */
export function matchesBinding(
  input: string,
  key: Key,
  binding: ParsedBinding,
): boolean {
  if (binding.chord.length !== 1) return false
  const keystroke = binding.chord[0]
  if (!keystroke) return false
  return matchesKeystroke(input, key, keystroke)
}
