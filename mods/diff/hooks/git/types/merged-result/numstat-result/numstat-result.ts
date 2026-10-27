import type { DiffStats } from '../../diff-stats'
import type { FileStat } from '../../file-stat'

/**
 * A parsed `--numstat`: the totals over every row, and the first MAX_FILES
 * rows.
 */
export type NumstatResult = {
  stats: DiffStats
  files: readonly FileStat[]
}
