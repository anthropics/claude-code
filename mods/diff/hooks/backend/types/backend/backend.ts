import type { BaseMode } from '../../../git/types/base-mode/base-mode'
import type { DiffData } from '../../../git/types/diff-data/diff-data'
import type { FetchOutcome } from '../../../git/types/fetch-outcome'
import type { FileHunks } from '../../../git/types/file-hunks'
import type { FileStat } from '../../../git/types/file-stat/file-stat'
import type { Repository } from '../../../git/types/repository/repository'
import type { BackendWords } from '../backend-words'

/**
 * The version-control system behind the pane, pinned once per session: its
 * working tree, what it compares, how it words them, and the pane's reads.
 *
 * Git is the plugin's own backend; any other system is read through
 * `$.vcs`, or through a probe a host installed for it (backendOf).
 */
export type Backend = {
  /**
   * The working tree's top; every row's path is relative to it.
   */
  repository: Pick<Repository, 'toplevel'>

  /**
   * What the picker offers to compare against, in its order.
   */
  baseModes: readonly BaseMode[]

  /**
   * The pane's words for what this backend compares and runs.
   */
  words: BackendWords

  /**
   * One fetch of the working tree against the mode's base (Git.fetchDiff).
   */
  fetchDiff: (mode: BaseMode) => Promise<FetchOutcome>

  /**
   * The rows' hunks by path against the base their fetch read, null where
   * they could not be read (Git.fetchHunks).
   */
  fetchHunks: (
    data: DiffData,
    files: readonly FileStat[],
  ) => Promise<ReadonlyMap<string, FileHunks | null>>

  /**
   * A string that changes when the checked-out commit moves
   * (Git.headKeyOf); empty when it cannot be read this tick.
   */
  headKeyOf: () => Promise<string>

  /**
   * Makes the next headKeyOf ask anew, where a key otherwise stands a while.
   */
  expireHeadKey?: () => void
}
