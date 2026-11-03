import type { Hunk } from './hunk'

/**
 * One file's parsed diff body: its hunks, cut at MAX_LINES_PER_FILE
 * (`isTruncated`), or none at all past MAX_DIFF_BYTES (`isLarge`).
 */
export type FileHunks = {
  hunks: readonly Hunk[]
  isTruncated: boolean
  isLarge: boolean
}
