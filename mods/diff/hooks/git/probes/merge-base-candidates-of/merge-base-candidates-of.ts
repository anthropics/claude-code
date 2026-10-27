import Argv from '../../argv'
import type Types from '../../types'
import { isSha } from '../is-sha'
import type { MergeBaseCandidates } from './merge-base-candidates'

/**
 * The merge-bases of HEAD with `origin/<default>` and with `<default>`, in
 * that order, each present only when git printed an object name.
 *
 * Also whether any call ran and exited 1: no common ancestor, a stable
 * state rather than a failure.
 *
 * @param run runs git
 * @param defaultBranch the default branch's name
 * @returns the candidate object names and the no-ancestor flag
 */
export async function mergeBaseCandidatesOf(
  run: Types.GitRun,
  defaultBranch: string,
): Promise<MergeBaseCandidates> {
  const results = [
    await run([
      Argv.NO_OPTIONAL_LOCKS,
      'merge-base',
      'HEAD',
      `origin/${defaultBranch}`,
    ]),
    await run([Argv.NO_OPTIONAL_LOCKS, 'merge-base', 'HEAD', defaultBranch]),
  ]

  return {
    candidates: results
      .filter(result => result.exitCode === 0)
      .map(result => result.stdout.trim())
      .filter(isSha),
    hasNoCommonAncestor: results.some(result => result.exitCode === 1),
  }
}
