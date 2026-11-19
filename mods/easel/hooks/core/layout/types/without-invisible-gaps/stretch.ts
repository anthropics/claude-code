import type Shapes from '../../../shapes'

/**
 * A run of samples with no gap between them. It is never empty.
 */
export type Stretch = [Shapes.Point, ...Shapes.Point[]]
