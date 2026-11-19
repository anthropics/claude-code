import type { BandPart } from '../band-part'
import type { Point } from '../point'

/**
 * Some rows filled from left to right by parts that lie side by side.
 */
export type BandShape = {
  kind: 'band'
  at: Point
  rows: number
  parts: BandPart[]
}
