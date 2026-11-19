import type Shapes from '../../../shapes'
import type Types from '../../types'

/**
 * One line of words as a shape, said to be about no parts left out.
 *
 * @param toLay the place, the words and their ink
 * @returns the shape of the words
 */
export const textShape = (toLay: Types.TextToLay): Shapes.Shape => ({
  kind: 'text',
  at: toLay.at,
  text: toLay.text,
  ink: toLay.ink,
  isAboutPartsLeftOut: false,
})
