import { useEffect, useRef } from 'react'
import { useNotifications } from '../context/notifications.js'
import { getShortcutDisplay } from '../keybindings/shortcutFormat.js'
import { hasImageInClipboard } from '../utils/imagePaste.js'

const NOTIFICATION_KEY = 'clipboard-image-hint'
// Small debounce to batch rapid focus changes
const FOCUS_CHECK_DEBOUNCE_MS = 1000
// Don't show the hint more than once per this interval
const HINT_COOLDOWN_MS = 30000

/**
 * Hook that shows a notification when the terminal regains focus
 * and the clipboard contains an image.
 *
 * @param isFocused - Whether the terminal is currently focused
 * @param enabled - Whether image paste is enabled (onImagePaste is defined)
 */
export function useClipboardImageHint(
  isFocused: boolean,
  enabled: boolean,
): void {
  const { addNotification } = useNotifications()
  const lastFocusedRef = useRef(isFocused)
  const lastHintTimeRef = useRef(0)
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only trigger on focus regain (was unfocused, now focused)
    const wasFocused = lastFocusedRef.current
    lastFocusedRef.current = isFocused

    if (!enabled || !isFocused || wasFocused) {
      return
    }

    // Clear any pending check
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current)
    }

    // Small debounce to batch rapid focus changes
    checkTimeoutRef.current = setTimeout(
      async (checkTimeoutRef, lastHintTimeRef, addNotification) => {
        checkTimeoutRef.current = null

        // Check cooldown to avoid spamming the user
        const now = Date.now()
        if (now - lastHintTimeRef.current < HINT_COOLDOWN_MS) {
          return
        }

        // Check if clipboard has an image (async osascript call)
        if (await hasImageInClipboard()) {
          lastHintTimeRef.current = now
          addNotification({
            key: NOTIFICATION_KEY,
            text: `Image in clipboard · ${getShortcutDisplay('chat:imagePaste', 'Chat', 'ctrl+v')} to paste`,
            priority: 'immediate',
            timeoutMs: 8000,
          })
        }
      },
      FOCUS_CHECK_DEBOUNCE_MS,
      checkTimeoutRef,
      lastHintTimeRef,
      addNotification,
    )

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current)
        checkTimeoutRef.current = null
      }
    }
  }, [isFocused, enabled, addNotification])
}
