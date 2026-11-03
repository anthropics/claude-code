import type Types from '../../types'

/**
 * Whether a row is the last file of the whole diff git printed for its
 * fetch: the last tracked row, the untracked ones being listed apart.
 *
 * The built-in reads that diff in one piece and trims its end, so the last
 * file alone has no closing empty line to draw (withClosingLine).
 *
 * @param data the fetch the row belongs to
 * @param file the row
 * @returns whether git printed this file last
 */
export const isLastOfDiff = (
  data: Types.DiffData,
  file: Types.FileStat,
): boolean =>
  data.files.filter(row => !row.isUntracked).at(-1)?.path === file.path
