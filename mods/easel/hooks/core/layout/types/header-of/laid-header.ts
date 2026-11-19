import type Shapes from '../../../shapes'

/**
 * What the header laid: its shapes, the first row that is free under it and
 * every text that it shows.
 */
export type LaidHeader = {
  shapes: Shapes.Shape[]
  rows: number
  texts: string[]
}
