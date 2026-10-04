import type { PaneModel } from './pane-model'

/**
 * The dim line under the header on an unborn HEAD that still lists rows:
 * what the rows are, since no comparison runs before the first commit.
 *
 * ReplDiffSidebar's no-commits qualifier; null with commits or no rows.
 *
 * @param model the last good fetch
 * @param filesCount the header's session file count
 * @returns the line, or null
 */
export function unbornNoteOf(
  model: Pick<PaneModel, 'data'>,
  filesCount: number,
): string | null {
  const isUnbornListing = model.data?.isUnborn === true && filesCount > 0

  return isUnbornListing
    ? 'no commits yet — showing staged and new files'
    : null
}
