import type { GitDeps } from '../git-deps'
import type { StampProbe } from '../stamp-probe'

/**
 * What dating a path against the session takes: the session's start, one
 * stamp probe over the tree's top, and when read, the paths dirty then.
 */
export type DatingContext = {
  deps: Pick<GitDeps, 'sessionStartMs' | 'baseline'>
  stamps: StampProbe
}
