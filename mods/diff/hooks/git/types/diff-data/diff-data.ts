import type { BaseMode } from '../base-mode'
import type { DiffSource } from '../diff-source'
import type { DiffStats } from '../diff-stats'
import type { FileStat } from '../file-stat'
import type { Repository } from '../repository'

/**
 * One settled fetch: the rows, the totals, what they compare, and what a
 * file's hunks are read against so both agree, over the working tree's top.
 *
 * `isUnborn`: a repository before its first commit (rows are the staged
 * and new files, `baseRef` is `--cached`); `stalePaths`: files whose staged
 * body is behind the working tree; `isUntrackedWithheld`: MergedResult's.
 */
export type DiffData = {
  repository: Pick<Repository, 'toplevel'>
  mode: BaseMode
  stats: DiffStats
  files: readonly FileStat[]
  source: DiffSource
  isUnborn: boolean
  baseRef: string
  stalePaths: readonly string[]
  isUntrackedWithheld: boolean
}
