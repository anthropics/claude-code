import type Shapes from '../../../../shapes'
import { pixelsAcross } from '../../../pixels-across'
import { baselineOf } from './baseline-of'

/**
 * Where a line of words starts: its first cell across, and the baseline
 * of its row down.
 *
 * @param shape the line of words, placed in cells
 * @returns the `x` and `y` attributes, in pixels
 */
export const textPlace = (shape: Shapes.TextShape): string =>
  `x="${pixelsAcross(shape.at.x)}" y="${baselineOf(shape)}"`
