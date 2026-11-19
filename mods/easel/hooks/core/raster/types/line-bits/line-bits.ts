import type Shapes from '../../../shapes'

/**
 * The braille bits that one line leaves in a cell.
 */
export type LineBits = { ink: Shapes.Ink; bits: number }
