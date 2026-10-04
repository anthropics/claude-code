import type Git from '../../../../../git'

/**
 * One hunk of a file in the docked body: whose it is, the hunk, and the
 * rows each of its lines takes wrapped at the body's width, summed too.
 */
export type HunkSegment = {
  kind: 'hunk'
  path: string
  hunk: Git.Hunk
  lineRows: readonly number[]
  rows: number
}
