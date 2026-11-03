import Entries from '../entries'

/**
 * A row's queueing as the hook on its event answers it: `{ value }` once
 * the row is queued, and a refused entry as `{ deny }` with its reason, so
 * the caller's promise rejects naming what was wrong.
 *
 * Anything else that went wrong is thrown on: the hook failed, and the
 * engine goes on beneath it as it does for any failed hook.
 *
 * @param queued the queueing, settled once the entry is checked and queued
 * @returns the hook's answer
 */
export const answerOf = (queued: Promise<void>) =>
  queued.then(
    () => ({ value: undefined }),
    (error: unknown) => {
      if (Entries.isRefusedEntry(error)) {
        return { deny: error.what }
      }

      throw error
    },
  )
