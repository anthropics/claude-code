import Texts from '../../texts'

/**
 * No text gives 0, where `Math.max` alone would give `-Infinity`.
 *
 * @param texts the texts to measure
 * @returns the cells that the widest of them takes
 */
export const maxWidthOf = (texts: string[]): number =>
  Math.max(0, ...texts.map(Texts.widthOf))
