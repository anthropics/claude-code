import type Git from '../../git'

/**
 * A fetch's rows as the pane groups them: the session's own that are
 * listed, how many tests and generated files there are, the pre-session,
 * the read-denied, those not answered for.
 */
export type Partition = {
  shown: readonly Git.FileStat[]
  preSession: readonly Git.FileStat[]
  noiseCount: number
  denied: readonly Git.FileStat[]
  unchecked: readonly Git.FileStat[]
}
