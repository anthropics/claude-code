import { useEffect, useRef } from 'react'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import { useOptionalKeybindingContext } from './KeybindingContext.js'
import type { KeybindingContextName } from './types.js'

// TODO(keybindings-migration): Remove fallback parameter after migration is complete
// and we've confirmed no 'keybinding_fallback_used' events are being logged.
// The fallback exists as a safety net during migration - if bindings fail to load
// or an action isn't found, we fall back to hardcoded values. Once stable, callers
// should be able to trust that getBindingDisplayText always returns a value for
// known actions, and we can remove this defensive pattern.

/**
 * Hook to get the display text for a configured shortcut.
 * Returns the configured binding or a fallback if unavailable.
 *
 * @param action - The action name (e.g., 'app:toggleTranscript')
 * @param context - The keybinding context (e.g., 'Global')
 * @param fallback - Fallback text if keybinding context unavailable
 * @returns The configured shortcut display text
 *
 * @example
 * const expandShortcut = useShortcutDisplay('app:toggleTranscript', 'Global', 'ctrl+o')
 * // Returns the user's configured binding, or 'ctrl+o' as default
 */
export function useShortcutDisplay(
  action: string,
  context: KeybindingContextName,
  fallback: string,
): string {
  const keybindingContext = useOptionalKeybindingContext()
  const resolved = keybindingContext?.getDisplayText(action, context)
  const isFallback = resolved === undefined
  const reason = keybindingContext ? 'action_not_found' : 'no_context'

  // Log fallback usage once per mount (not on every render) to avoid
  // flooding analytics with events from frequent re-renders.
  const hasLoggedRef = useRef(false)
  useEffect(() => {
    if (isFallback && !hasLoggedRef.current) {
      hasLoggedRef.current = true
      logEvent('tengu_keybinding_fallback_used', {
        action:
          action as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        context:
          context as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        fallback:
          fallback as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        reason:
          reason as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
    }
  }, [isFallback, action, context, fallback, reason])

  return isFallback ? fallback : resolved
}
