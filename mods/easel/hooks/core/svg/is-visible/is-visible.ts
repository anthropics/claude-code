import { pixelsDown } from '../pixels-down'
import type Types from '../types'

/**
 * False where the height is written as no pixels at all.
 *
 * @param part one of a stack, or anything as tall
 * @returns whether painting would show
 */
export const isVisible = (part: Types.Tall): boolean =>
  pixelsDown(part.height) !== pixelsDown(0)
