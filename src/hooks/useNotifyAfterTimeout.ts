import { useEffect } from 'react'
import {
  getLastInteractionTime,
  updateLastInteractionTime,
} from '../bootstrap/state.js'
import { useTerminalNotification } from '../ink/useTerminalNotification.js'
import { sendNotification } from '../services/notifier.js'
// The time threshold in milliseconds for considering an interaction "recent" (6 seconds)
export const DEFAULT_INTERACTION_THRESHOLD_MS = 6000

function getTimeSinceLastInteraction(): number {
  return Date.now() - getLastInteractionTime()
}

function hasRecentInteraction(threshold: number): boolean {
  return getTimeSinceLastInteraction() < threshold
}

function shouldNotify(threshold: number): boolean {
  return process.env.NODE_ENV !== 'test' && !hasRecentInteraction(threshold)
}

// NOTE: User interaction tracking is now done in App.tsx's processKeysInBatch
// function, which calls updateLastInteractionTime() when any input is received.
// This avoids having a separate stdin 'data' listener that would compete with
// the main 'readable' listener and cause dropped input characters.

/**
 * Hook that manages desktop notifications after a timeout period.
 *
 * Shows a notification in two cases:
 * 1. Immediately if the app has been idle for longer than the threshold
 * 2. After the specified timeout if the user doesn't interact within that time
 *
 * @param message - The notification message to display
 * @param timeout - The timeout in milliseconds (defaults to 6000ms)
 */
export function useNotifyAfterTimeout(
  message: string,
  notificationType: string,
): void {
  const terminal = useTerminalNotification()

  // Reset interaction time when hook is called to make sure that requests
  // that took a long time to complete don't pop up a notification right away.
  // Must be immediate because useEffect runs after Ink's render cycle has
  // already flushed; without it the timestamp stays stale and a premature
  // notification fires if the user is idle (no subsequent renders to flush).
  useEffect(() => {
    updateLastInteractionTime(true)
  }, [])

  useEffect(() => {
    let hasNotified = false
    const timer = setInterval(() => {
      if (shouldNotify(DEFAULT_INTERACTION_THRESHOLD_MS) && !hasNotified) {
        hasNotified = true
        clearInterval(timer)
        void sendNotification({ message, notificationType }, terminal)
      }
    }, DEFAULT_INTERACTION_THRESHOLD_MS)

    return () => clearInterval(timer)
  }, [message, notificationType, terminal])
}
