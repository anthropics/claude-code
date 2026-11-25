import type { WalkEntry } from '../walk-entry'

/**
 * Entries under one root, every ancestor checked: a path's entry is
 * answered only when each directory above it is itself a real directory.
 */
export type KindWalk = {
  /**
   * Answers the listed entry at a root-relative `/` path (`''`: the root);
   * see WalkEntry for the two ways it cannot say.
   */
  entryOf: (path: string) => Promise<WalkEntry>
}
