import Limits from '../../limits'
import Records from '../../records'
import Words from '../../words'

/**
 * A strip shows each height as the block that fills that much of a cell
 * from below.
 *
 * @param height how much of the cell is filled, from zero to one
 * @returns the glyph of that height, the full block where none is nearer
 */
export const stripGlyphOf = (height: number): string =>
  Records.BOTTOM_BLOCKS[Math.round(height * Limits.EIGHTHS_PER_CELL)] ??
  Words.FULL_BLOCK
