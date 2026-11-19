import type Charting from '../../../../charting'
import type Shapes from '../../../../shapes'
import { textShapesOf } from '../../../text-shapes-of'
import type Types from '../../../types'

/**
 * The key of one part, under the middle of the part and in its ink.
 *
 * @param part the slice and where its part stands in the band
 * @param top the row that the keys stand on
 * @returns the one shape, or none
 */
export const keyShapesOf = (
  part: Charting.Slice & Types.PartPlace,
  top: number,
): Shapes.Shape[] =>
  textShapesOf({
    at: { x: Math.floor(part.middle), y: top },
    text: part.key,
    ink: part.ink,
  })
