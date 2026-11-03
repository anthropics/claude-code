import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that passes every row a conversation keeps
 * on with no content at all.
 */
export const blankingRows: Plugin = {
  name: 'blanking-rows',
  register(on) {
    on('session.append', ($, e, next) =>
      next({ ...e, message: { ...e.message, content: [] } }),
    )
  },
}
