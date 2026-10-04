import Classify from '../classify'
import Git from '../git'
import type { Partition } from './partition'

/**
 * A fetch's rows split as ReplDiffSidebar splits them, in its order (by
 * name): pre-session apart, tests and generated files hidden unless shown.
 *
 * No read-deny bucket: the pane feeds nothing to the model on its own.
 *
 * @param files the fetched rows
 * @param noise `shown` keeps tests and generated files in the list
 * @returns the groups
 */
export function partitionOf(
  files: readonly Git.FileStat[],
  noise: 'shown' | 'hidden',
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
  }
}
