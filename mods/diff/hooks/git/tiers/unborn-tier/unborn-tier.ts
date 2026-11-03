import Probes from '../../probes'
import type Types from '../../types'
import { diffDataOf } from '../diff-data-of'
import { withUntracked } from '../with-untracked'
import { EMPTY_NUMSTAT } from './empty-numstat'

/**
 * The one permanent cause of a failed vs-HEAD diff, told apart from the
 * passing ones: an unborn HEAD, as the built-in panel tells it apart.
 *
 * Its rows are the staged files with unstaged edits folded in, then the
 * session's untracked files; hunks read against `--cached`, a file edited
 * after staging has no honest body; a withheld `--numstat`: no data.
 *
 * @param context the fetch
 * @returns data marked unborn, or unavailable
 */
export async function unbornTier(
  context: Types.FetchContext,
): Promise<Types.FetchOutcome> {
  const { run } = context

  if (!(await Probes.isUnbornHead(run))) {
    return { kind: 'unavailable' }
  }

  const staged = await Probes.statsOf(context, '--cached')

  if (!staged) {
    return { kind: 'unavailable' }
  }

  const isOverlaid = staged.files.length > 0

  const unstaged = isOverlaid
    ? await Probes.unstagedNumstat(run)
    : EMPTY_NUMSTAT

  if (!unstaged) {
    return { kind: 'unavailable' }
  }

  const merged = await withUntracked(
    context,
    Probes.overlayUnstaged(staged, unstaged),
    'session-only',
  )

  return {
    kind: 'data',
    data: diffDataOf(context, merged, {
      source: { kind: 'working-tree', base: 'HEAD' },
      baseRef: '--cached',
      isUnborn: true,
      stalePaths: unstaged.files.map(file => file.path),
    }),
  }
}
