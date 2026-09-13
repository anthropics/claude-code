import type { Backend } from '../../../hooks/backend'
import Git from '../../../hooks/git'

/**
 * A backend that holds a working copy at a toplevel and fetches nothing,
 * its lister word the toplevel so a test can tell which probe pinned.
 *
 * @param toplevel the working copy's root
 * @returns the backend
 */
export const stubBackendOf = (toplevel: string): Backend => ({
  repository: { toplevel },
  baseModes: ['uncommitted'],
  words: { ...Git.GIT_WORDS, lister: toplevel },
  fetchDiff: () => Promise.resolve({ kind: 'unavailable' }),
  fetchFileHunks: () => Promise.resolve(null),
  headKeyOf: () => Promise.resolve(''),
})
