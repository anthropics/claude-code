/**
 * The axis meets the grid in a tee where a grid follows it, and is a plain
 * rule where none does.
 *
 * @param gridWidth how many cells the grid takes beside the axis
 * @returns the glyph of the axis in one row
 */
export const axisGlyphOf = (gridWidth: number): string =>
  gridWidth > 0 ? '┤' : '│'
