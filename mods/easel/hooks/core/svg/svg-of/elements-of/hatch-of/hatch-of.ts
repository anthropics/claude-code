import type Shapes from '../../../../shapes'

/**
 * What marks a bar of a value below zero: a paler fill inside a stroke of
 * the same colour, so that it shows without colour too.
 *
 * @param shape the bar, which tells whether it is hatched
 * @returns the attributes, starting with a space, or nothing
 */
export const hatchOf = (shape: Shapes.BarShape): string =>
  shape.isHatched ? ` fill-opacity=".45" stroke="var(--${shape.ink})"` : ''
