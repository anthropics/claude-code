/**
 * A `$` whose every call rejects: no policy is read, no line is logged.
 */
export const UNREADABLE = Object.freeze({
  settings: {
    read: () => Promise.reject(new Error('settings unreadable')),
  },
  ui: { log: () => Promise.reject(new Error('log unwritable')) },
})
