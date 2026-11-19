import Texts from '../../../../../texts'

/**
 * A tally and its unit as the one member of a list, or an empty list for a
 * tally of zero.
 *
 * @param count how many there are
 * @param noun what is counted, in the singular
 * @param detail what follows the tally
 * @returns the one phrase, or nothing where there is nothing to count
 */
export const countIfAny = (
  count: number,
  noun: string,
  detail = '',
): string[] => (count > 0 ? [`${Texts.counted(count, noun)}${detail}`] : [])
