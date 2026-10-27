import Probes from '../probes'
import type Types from '../types'
import { diffDataOf } from './diff-data-of'
import { unbornTier } from './unborn-tier'
import { withUntracked } from './with-untracked'
import { WORKING_TREE_BASIS } from './working-tree-basis'

/**
 * Session and uncommitted mode: the working tree against HEAD, the built-in
 * panel's working-tree tier.
 *
 * Session mode tags the rows that predate the session and keeps
 * pre-session untracked files as tagged rows; uncommitted keeps the
 * session's untracked files and answers even when empty.
 *
 * @param context the fetch
 * @returns the outcome
 */
export async function workingTreeTier(
  context: Types.FetchContext,
): Promise<Types.FetchOutcome> {
  const workingTree = await Probes.statsOf(context, 'HEAD')

  if (!workingTree) {
    return unbornTier(context)
  }

  const isSession = context.mode === 'session'

  const files = isSession
    ? await Probes.tagPreSession(context, workingTree.files)
    : workingTree.files

  const data = diffDataOf(
    context,
    await withUntracked(
      context,
      { stats: workingTree.stats, files },
      isSession ? 'with-pre-session' : 'session-only',
    ),
    WORKING_TREE_BASIS,
  )

  return { kind: 'data', data }
}
