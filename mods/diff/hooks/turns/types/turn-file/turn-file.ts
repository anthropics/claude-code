import type Git from '../../../git'

/**
 * One file as a turn's edits left it: its hunks (cut at the pane's line
 * cap), the counts over every line, and whether the turn created it.
 */
export type TurnFile = {
  path: string
  hunks: readonly Git.Hunk[]
  added: number
  removed: number
  isNewFile: boolean

  /**
   * Whether the hunks were cut at MAX_LINES_PER_FILE lines.
   */
  isTruncated: boolean
}
