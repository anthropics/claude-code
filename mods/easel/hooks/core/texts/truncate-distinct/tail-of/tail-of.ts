import Words from '../../words'

/**
 * Marks a label as cut at its start and keeps what follows the shared part.
 *
 * @param name the label
 * @param sharedCount how many code points every label starts with
 * @returns the mark of a cut, then the rest of the label
 */
export const tailOf = (name: string, sharedCount: number): string =>
  `${Words.ELLIPSIS}${[...name].slice(sharedCount).join('')}`
