import type Shapes from '../../../shapes'

/**
 * What tells one drawn series from the others.
 */
export type SeriesIdentity = { key: string; ink: Shapes.Ink }
