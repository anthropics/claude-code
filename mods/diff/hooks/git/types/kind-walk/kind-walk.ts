import type { WalkKind } from '../walk-kind'

/**
 * Entry kinds under one root, every ancestor checked: a path's kind is
 * answered only when each directory above it is itself a real directory.
 */
export type KindWalk = {
  /**
   * Answers the entry's kind at a root-relative `/` path (`''`: the root);
   * see WalkKind for the two ways it cannot say.
   */
  kindOf: (path: string) => Promise<WalkKind>
}
