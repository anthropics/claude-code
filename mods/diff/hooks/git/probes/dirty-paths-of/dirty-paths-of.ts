import Argv from '../../argv'
import Parse from '../../parse'
import type Types from '../../types'
import { STATUS_PATH_OFFSET } from './status-path-offset'

/**
 * Every path dirty in the working tree right now, tracked changes and
 * untracked files alike, as `git status -z` lists them; null unread.
 *
 * Read once, by the backend's first fetch (it walks the whole tree), so a
 * later fetch can tell a path that was dirty then from one that turned up
 * since (GitDeps `baseline`). Renames unpaired: each side is its own path.
 *
 * @param run runs git against the pinned repository
 * @returns the paths, root-relative, or null on a failed or cut listing
 */
export async function dirtyPathsOf(
  run: Types.GitRun,
): Promise<ReadonlySet<string> | null> {
  const listing = await run([
    Argv.NO_OPTIONAL_LOCKS,
    'status',
    '--porcelain',
    '-z',
    '--untracked-files=all',
    '--no-renames',
    '--ignore-submodules=dirty',
  ])

  const records = listing.stdout.split('\0').filter(record => record !== '')

  return Parse.isWholeAnswer(listing)
    ? new Set(records.map(record => record.slice(STATUS_PATH_OFFSET)))
    : null
}
