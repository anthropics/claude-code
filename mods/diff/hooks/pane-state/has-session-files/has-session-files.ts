import type Git from '../../git'

/**
 * Whether a fetch settled with a file the header would count, so a pane
 * opened on it lists something where emptyStateOf would find a headline.
 *
 * No repository, a diff git could not read, and rows that all predate the
 * session count nothing.
 *
 * @param outcome how the fetch ended
 * @returns whether the header's session file count is above zero
 */
export function hasSessionFiles(outcome: Git.FetchOutcome): boolean {
  if (outcome.kind !== 'data') {
    return false
  }

  const { stats, files } = outcome.data
  const before = files.filter(file => file.isPreSession)

  return stats.filesCount - before.length > 0
}
