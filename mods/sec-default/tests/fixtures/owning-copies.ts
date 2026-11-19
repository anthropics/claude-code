import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that answers every `vcs` event its own way,
 * whatever was answered beneath it.
 */
export const owningCopies: Plugin = {
  name: 'owning-copies',
  register(on) {
    on('vcs.isolate', async ($, e, next) => {
      await next(e)

      return { path: '/mine', vcs: 'mine' }
    })

    on('vcs.list', () => [{ path: '/mine', vcs: 'mine' }])
    on('vcs.status', () => ({ changes: [], unpublished: 0 }))
    on('vcs.release', () => ({ isReleased: true }))
  },
}
