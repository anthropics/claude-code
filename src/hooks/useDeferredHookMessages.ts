import { useCallback, useEffect, useRef } from 'react'
import type { HookResultMessage, Message } from '../types/message.js'

/**
 * Manages deferred SessionStart hook messages so the REPL can render
 * immediately instead of blocking on hook execution (~500ms).
 *
 * Hook messages are injected asynchronously when the promise resolves.
 * Returns a callback that onSubmit should call before the first API
 * request to ensure the model always sees hook context.
 */
export function useDeferredHookMessages(
  pendingHookMessages: Promise<HookResultMessage[]> | undefined,
  setMessages: (action: React.SetStateAction<Message[]>) => void,
): () => Promise<void> {
  const pendingRef = useRef(pendingHookMessages ?? null)
  const resolvedRef = useRef(!pendingHookMessages)

  useEffect(() => {
    const promise = pendingRef.current
    if (!promise) return
    let cancelled = false
    promise.then(msgs => {
      if (cancelled) return
      resolvedRef.current = true
      pendingRef.current = null
      if (msgs.length > 0) {
        setMessages(prev => [...msgs, ...prev])
      }
    })
    return () => {
      cancelled = true
    }
  }, [setMessages])

  return useCallback(async () => {
    if (resolvedRef.current || !pendingRef.current) return
    const msgs = await pendingRef.current
    if (resolvedRef.current) return
    resolvedRef.current = true
    pendingRef.current = null
    if (msgs.length > 0) {
      setMessages(prev => [...msgs, ...prev])
    }
  }, [setMessages])
}
