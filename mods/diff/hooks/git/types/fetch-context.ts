import type { BaseMode } from './base-mode'
import type { GitDeps } from './git-deps'
import type { GitRun } from './git-run'
import type { Repository } from './repository'
import type { StampProbe } from './stamp-probe'

/**
 * What every tier of one fetch shares: the host, its pinned git, the
 * repository, the mode asked for, and one stamp probe over the tree.
 *
 * One probe, so tracked and untracked dating draw on the same listings
 * and one budget.
 */
export type FetchContext = {
  deps: GitDeps
  run: GitRun
  repository: Repository
  mode: BaseMode
  stamps: StampProbe
}
