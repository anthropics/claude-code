/**
 * A `$` whose every call throws where it is made.
 */
export const THROWING = Object.freeze({
  settings: {
    read() {
      throw new Error('settings unreadable')
    },
  },
  ui: {
    log() {
      throw new Error('log unwritable')
    },
  },
})
