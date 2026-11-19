import type Shapes from '../../shapes'

/**
 * A stretch of one row in one ink, over a second ink where it has one.
 */
export type Run = { text: string; ink: Shapes.Ink; background?: Shapes.Ink }
