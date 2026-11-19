import type Shapes from '../../shapes'

/**
 * What a part laid: its shapes in the order to paint them, and the first
 * row that is free under it.
 */
export type Laid = {
  shapes: Shapes.Shape[]
  rows: number
}
