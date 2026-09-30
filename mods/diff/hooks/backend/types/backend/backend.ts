import type Git from '../../../git'
import type { BackendWords } from '../backend-words'

/**
 * The version-control system behind the pane, pinned once per session: its
 * working tree, what it compares, how it words them, and the pane's reads.
 *
 * Git is the plugin's own backend; a host may install probes for others,
 * consulted where no git working tree holds the directory (backendOf).
 */
export type Backend = {
  /**
   * The working tree's top; every row's path is relative to it.
   */
  repository: Pick<Git.Repository, 'toplevel'>

  /**
   * What the picker offers to compare against, in its order.
   */
  baseModes: readonly Git.BaseMode[]

  /**
   * The pane's words for what this backend compares and runs.
   */
  words: BackendWords

  /**
   * One fetch of the working tree against the mode's base (Git.fetchDiff).
   */
  fetchDiff: (mode: Git.BaseMode) => Promise<Git.FetchOutcome>

  /**
   * The rows' hunks by path against the base their fetch read, null where
   * they could not be read (Git.fetchHunks).
   */
  fetchHunks: (
    data: Git.DiffData,
    files: readonly Git.FileStat[],
  ) => Promise<ReadonlyMap<string, Git.FileHunks | null>>

  /**
   * A string that changes when the checked-out commit moves
   * (Git.headKeyOf); empty when it cannot be read this tick.
   */
  headKeyOf: () => Promise<string>
}
