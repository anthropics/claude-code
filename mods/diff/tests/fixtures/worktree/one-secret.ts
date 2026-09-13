import { SECRET_DIFF } from './secret-diff.js'
import { WORKTREE_LINES } from './worktree-lines.js'

/**
 * Git's output in the linked worktree /main/wt, whose one change is a
 * secrets file, for each invocation whose command line holds the key.
 *
 * @returns the answers, fresh each call so a test may rewrite them
 */
export const oneSecret = (): Record<string, string> => ({
  'rev-parse --path-format=absolute': WORKTREE_LINES,
  'HEAD --shortstat': ' 1 file changed, 1 insertion(+)',
  'HEAD --numstat': '1\t0\t.env\0',
  'ls-files': '',
  '-- .env': SECRET_DIFF,
})
