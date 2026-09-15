import type { BranchBase } from '../branch-base'
import type { EntryKind } from '../entry-kind'
import type { GitRun } from '../git-run'
import type { Repository } from '../repository'

/**
 * What the fetch reaches the host through: pinned git, the repository, a
 * directory listing, a timestamp probe, the start, a branch-base listener.
 */
export type GitDeps = {
  /**
   * Runs git against `repository`; never rejects (GitRun).
   */
  run: GitRun

  /**
   * Where the session started, resolved once and pinned on every child.
   */
  repository: Repository

  /**
   * A path's modification time in epoch milliseconds, or null when it
   * cannot be read. Called only on a path a listing showed as a file.
   */
  mtimeOf: (path: string) => Promise<number | null>

  /**
   * A directory's entries by name with their own kinds (no link followed),
   * or null when it cannot be listed.
   */
  entryKindsOf: (dir: string) => Promise<ReadonlyMap<string, EntryKind> | null>

  sessionStartMs: number

  /**
   * The paths dirty when the backend first fetched (Probes.dirtyPathsOf),
   * read then and kept; null when unlisted, absent where none is kept.
   *
   * A path absent from it turned up since (a rename's new name, a file
   * moved in), whatever timestamp it carries.
   */
  baseline?: ReadonlySet<string> | null

  /**
   * Told each time branch mode resolves its base, for telemetry.
   */
  onBranchBase: (base: BranchBase) => void
}
