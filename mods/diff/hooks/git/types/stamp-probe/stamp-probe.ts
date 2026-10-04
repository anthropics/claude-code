import type { GitDeps } from '../git-deps'
import type { KindWalk } from '../kind-walk'

/**
 * What stamping a file behind a kind walk takes: the walk, the absolute
 * base its paths are under, and the timestamp probe.
 */
export type StampProbe = {
  walk: KindWalk
  base: string
  mtimeOf: GitDeps['mtimeOf']
}
