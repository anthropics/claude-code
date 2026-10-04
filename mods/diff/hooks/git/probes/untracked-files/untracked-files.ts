import Argv from '../../argv'
import Parse from '../../parse'
import type Types from '../../types'
import type { UntrackedPlace } from '../untracked-place'
import { untrackedRowsOf } from '../untracked-rows-of'

/**
 * The untracked, unignored files as 0/0 rows (untrackedRowsOf), listed
 * with `ls-files -z`. A listing not given whole: no answer.
 *
 * @param context the fetch: its pinned git, stamp probe and session start
 * @param place the free row slots and the scope
 * @returns the rows to merge after the tracked ones, or null when the
 * `-z` listing failed, timed out or was cut
 */
export async function untrackedFiles(
  context: Pick<Types.FetchContext, 'run'> & Types.DatingContext,
  place: UntrackedPlace,
): Promise<readonly Types.FileStat[] | null> {
  if (place.slots <= 0) {
    return []
  }

  const listing = await context.run([
    Argv.NO_OPTIONAL_LOCKS,
    'ls-files',
    '-z',
    '--others',
    '--exclude-standard',
    '--full-name',
  ])

  return Parse.isWholeAnswer(listing)
    ? untrackedRowsOf(
        context,
        listing.stdout.split('\0').filter(path => path !== ''),
        place,
      )
    : null
}
