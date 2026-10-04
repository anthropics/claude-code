import Argv from '../../argv'
import type Types from '../../types'
import { currentBranchOf } from '../current-branch-of'
import { defaultBranchOf } from '../default-branch-of'
import { mergeBaseCandidatesOf } from '../merge-base-candidates-of'
import { missingBaseOf } from '../missing-base-of'

/**
 * What branch mode compares against, resolved as the built-in panel does:
 * the merge-base of HEAD and the default branch, HEAD itself, or none.
 *
 * `origin/<default>` wins unless the local ref's base descends from it; a
 * detached HEAD, a `-`-led default name or no common ancestor is `none`;
 * a failure that may pass (a ref still there, a failed rev-parse) `error`.
 *
 * @param run runs git
 * @returns the base
 */
export async function branchBaseOf(
  run: Types.GitRun,
): Promise<Types.BranchBase> {
  const [branch, defaultBranch] = await Promise.all([
    currentBranchOf(run),
    defaultBranchOf(run),
  ])

  const isUnrelated = branch === 'HEAD' || defaultBranch.startsWith('-')

  if (isUnrelated) {
    return { kind: 'none' }
  }

  if (branch === defaultBranch) {
    return { kind: 'head-is-base', baseBranch: defaultBranch }
  }

  const { candidates, hasNoCommonAncestor } = await mergeBaseCandidatesOf(
    run,
    defaultBranch,
  )

  const [first, second] = candidates

  if (first === undefined) {
    return hasNoCommonAncestor
      ? { kind: 'none' }
      : missingBaseOf(run, defaultBranch)
  }

  const isLocalBaseNewer =
    second !== undefined &&
    second !== first &&
    (
      await run([
        Argv.NO_OPTIONAL_LOCKS,
        'merge-base',
        '--is-ancestor',
        first,
        second,
      ])
    ).exitCode === 0

  const mergeBase = isLocalBaseNewer ? second : first
  const head = await run([Argv.NO_OPTIONAL_LOCKS, 'rev-parse', 'HEAD'])

  if (head.exitCode !== 0) {
    return { kind: 'error', reason: 'head_rev_parse_failed' }
  }

  const isHeadTheBase = head.stdout.trim() === mergeBase

  return isHeadTheBase
    ? { kind: 'head-is-base', baseBranch: defaultBranch }
    : { kind: 'merge-base', mergeBase, baseBranch: defaultBranch }
}
