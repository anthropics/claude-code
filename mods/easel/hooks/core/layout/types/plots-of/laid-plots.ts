import type Shapes from '../../../shapes'

/**
 * What the body of a chart laid: its shapes, the first row that is free
 * under it and the notes to show below.
 */
export type LaidPlots = {
  shapes: Shapes.Shape[]
  rows: number
  notes: string[]
}
