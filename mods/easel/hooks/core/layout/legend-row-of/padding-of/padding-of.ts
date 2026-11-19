import Texts from '../../../texts'
import type Types from '../../types'

/**
 * Measures the blank before a stat's text: none for the first part, which
 * starts its column, and what ends the column for the others.
 *
 * @param part where the part's column starts and how wide it is
 * @param partIndex which part of the stat it is
 * @param text the words to lay in the column
 * @returns the cells to leave before the words
 */
export const paddingOf = (
  part: Types.StatPart,
  partIndex: number,
  text: string,
): number => (partIndex > 0 ? part.width - Texts.widthOf(text) : 0)
