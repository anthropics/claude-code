import { useEffect, useRef } from 'react'
import { useTheme } from '../components/design-system/ThemeProvider.js'
import type { useSelection } from '../ink/hooks/use-selection.js'
import { getGlobalConfig } from '../utils/config.js'
import { getTheme } from '../utils/theme.js'

type Selection = ReturnType<typeof useSelection>

/**
 * Auto-copy the selection to the clipboard when the user finishes dragging
 * (mouse-up with a non-empty selection) or multi-clicks to select a word/line.
 * Mirrors iTerm2's "Copy to pasteboard on selection" — the highlight is left
 * intact so the user can see what was copied. Only fires in alt-screen mode
 * (selection state is ink-instance-owned; outside alt-screen, the native
 * terminal handles selection and this hook is a no-op via the ink stub).
 *
 * selection.subscribe fires on every mutation (start/update/finish/clear/
 * multiclick). Both char drags and multi-clicks set isDragging=true while
 * pressed, so a selection appearing with isDragging=false is always a
 * drag-finish. copiedRef guards against double-firing on spurious notifies.
 *
 * onCopied is optional — when omitted, copy is silent (clipboard is written
 * but no toast/notification fires). FleetView uses this silent mode; the
 * fullscreen REPL passes showCopiedToast for user feedback.
 */
export function useCopyOnSelect(
  selection: Selection,
  isActive: boolean,
  onCopied?: (text: string) => void,
): void {
  // Tracks whether the *previous* notification had a visible selection with
  // isDragging=false (i.e., we already auto-copied it). Without this, the
  // finish→clear transition would look like a fresh selection-gone-idle
  // event and we'd toast twice for a single drag.
  const copiedRef = useRef(false)
  // onCopied is a fresh closure each render; read through a ref so the
  // effect doesn't re-subscribe (which would reset copiedRef via unmount).
  const onCopiedRef = useRef(onCopied)
  onCopiedRef.current = onCopied

  useEffect(() => {
    if (!isActive) return

    const unsubscribe = selection.subscribe(() => {
      const sel = selection.getState()
      const has = selection.hasSelection()
      // Drag in progress — wait for finish. Reset copied flag so a new drag
      // that ends on the same range still triggers a fresh copy.
      if (sel?.isDragging) {
        copiedRef.current = false
        return
      }
      // No selection (cleared, or click-without-drag) — reset.
      if (!has) {
        copiedRef.current = false
        return
      }
      // Selection settled (drag finished OR multi-click). Already copied
      // this one — the only way to get here again without going through
      // isDragging or !has is a spurious notify (shouldn't happen, but safe).
      if (copiedRef.current) return

      // Default true: macOS users expect cmd+c to work. It can't — the
      // terminal's Edit > Copy intercepts it before the pty sees it, and
      // finds no native selection (mouse tracking disabled it). Auto-copy
      // on mouse-up makes cmd+c a no-op that leaves the clipboard intact
      // with the right content, so paste works as expected.
      const enabled = getGlobalConfig().copyOnSelect ?? true
      if (!enabled) return

      const text = selection.copySelectionNoClear()
      // Whitespace-only (e.g., blank-line multi-click) — not worth a
      // clipboard write or toast. Still set copiedRef so we don't retry.
      if (!text || !text.trim()) {
        copiedRef.current = true
        return
      }
      copiedRef.current = true
      onCopiedRef.current?.(text)
    })
    return unsubscribe
  }, [isActive, selection])
}

/**
 * Pipe the theme's selectionBg color into the Ink StylePool so the
 * selection overlay renders a solid blue bg instead of SGR-7 inverse.
 * Ink is theme-agnostic (layering: colorize.ts "theme resolution happens
 * at component layer, not here") — this is the bridge. Fires on mount
 * (before any mouse input is possible) and again whenever /theme flips,
 * so the selection color tracks the theme live.
 */
export function useSelectionBgColor(selection: Selection): void {
  const [themeName] = useTheme()
  useEffect(() => {
    selection.setSelectionBgColor(getTheme(themeName).selectionBg)
  }, [selection, themeName])
}
