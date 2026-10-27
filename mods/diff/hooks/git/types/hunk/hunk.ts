/**
 * One hunk of a unified diff: where it starts on each side and its lines,
 * each still carrying its `+`, `-` or space marker.
 */
export type Hunk = {
  oldStart: number
  newStart: number
  lines: readonly string[]
}
