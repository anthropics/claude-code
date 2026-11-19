import { pixelsAcross } from '../pixels-across'
import { pixelsDown } from '../pixels-down'

/**
 * A place in cells, written the way a list of points takes it.
 *
 * @param column the place across, in cells
 * @param row the place down, in cells
 * @returns `across,down` in pixels
 */
export const pixelPoint = (column: number, row: number): string =>
  `${pixelsAcross(column)},${pixelsDown(row)}`
