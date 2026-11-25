import Classify from '../classify'
import Git from '../git'
import type { Partition } from './partition'

/**
 * A fetch's rows split as ReplDiffSidebar splits them, in its order (by
 * name): pre-session apart, tests and generated files hidden unless shown.
 *
 * @param files the fetched rows, less those left out
 * @param noise `shown` keeps tests and generated files in the list
 * @param left the rows left out: read-denied, or not answered for
 * @returns the groups
 */
export function partitionOf(
  files: readonly Git.FileStat[],
  noise: 'shown' | 'hidden',
  left: Pick<Partition, 'denied' | 'unchecked'> = {
    denied: [],
    unchecked: [],
  },
): Partition {
  const sorted = [...files].sort((a, b) =>
    Git.displayPathOf(a).localeCompare(Git.displayPathOf(b)),
  )

  const preSession = sorted.filter(file => file.isPreSession)
  const session = sorted.filter(file => !file.isPreSession)
  const quiet = session.filter(file => !Classify.isNoiseFile(file.path))

  return {
    shown: noise === 'shown' ? session : quiet,
    preSession,
    noiseCount: session.length - quiet.length,
    denied: left.denied,
    unchecked: left.unchecked,
  }
}
