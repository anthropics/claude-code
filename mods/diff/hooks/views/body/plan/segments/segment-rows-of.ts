import type { Segment } from '../../types'

/**
 * The rows a segment takes: a hunk's as counted when it was laid out, one
 * for anything else.
 *
 * @param segment the segment
 * @returns the rows
 */
export const segmentRowsOf = (segment: Segment): number =>
  segment.kind === 'hunk' ? segment.rows : 1
