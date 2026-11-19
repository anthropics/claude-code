import type Shapes from '../../../../shapes'
import Texts from '../../../../texts'
import { pixelsAcross } from '../../../pixels-across'

/**
 * Stretched to the width of its cells, so that words stay in their
 * columns whatever font the viewer has.
 *
 * @param shape the line of words as it is drawn
 * @returns the `textLength` attribute, in pixels
 */
export const textLengthOf = (shape: Shapes.TextShape): string =>
  `textLength="${pixelsAcross(Texts.widthOf(shape.text))}"`
