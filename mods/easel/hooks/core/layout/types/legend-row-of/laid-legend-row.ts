import type Shapes from '../../../shapes'

/**
 * What a legend row laid: its shapes, the first row that is free under it
 * and where its lane starts.
 */
export type LaidLegendRow = {
  shapes: Shapes.Shape[]
  rows: number
  lane: Shapes.Point
}
