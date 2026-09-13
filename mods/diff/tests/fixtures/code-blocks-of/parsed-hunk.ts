/**
 * One hunk read back out of a `Code` source: its header's four numbers and
 * the marked lines under it.
 */
export type ParsedHunk = {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: readonly string[]
}
