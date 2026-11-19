import type Shapes from '../../shapes'
import type Types from '../types'
import { textShape } from './text-shape'

/**
 * A text at a place of a scene; blank words make no shape.
 *
 * @param options the place, the words and their ink
 * @returns the one shape, or none
 */
export function textShapesOf(toLay: Types.TextToLay): Shapes.Shape[] {
  const isBlank = toLay.text.trim() === ''

  return isBlank ? [] : [textShape(toLay)]
}
