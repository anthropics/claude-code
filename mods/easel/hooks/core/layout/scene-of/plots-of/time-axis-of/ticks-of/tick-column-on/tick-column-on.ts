import type Types from '../../../../../types'

/**
 * Turns a time into the column of its tick, counted from the left edge of
 * the plots.
 *
 * @param area the plots above the axis
 * @param positionOf where a time falls along the axis
 * @returns the column of a time's tick
 */
export const tickColumnOn =
  (area: Types.PlotArea, positionOf: (ms: number) => number) =>
  (ms: number): number =>
    Math.floor(area.tickXOf(positionOf(ms)) - area.left)
