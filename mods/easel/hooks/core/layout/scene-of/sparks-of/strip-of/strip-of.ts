import type Shapes from '../../../../shapes'

/**
 * Cells of some heights in a row, drawn in one colour.
 *
 * @param at where the strip starts
 * @param heights the height of each cell, or null where it has none
 * @param ink what the strip is drawn in
 * @returns the shape
 */
export const stripOf = (
  at: Shapes.Point,
  heights: Shapes.StripShape['heights'],
  ink: Shapes.Ink,
): Shapes.StripShape => ({ kind: 'strip', at, heights, ink })
