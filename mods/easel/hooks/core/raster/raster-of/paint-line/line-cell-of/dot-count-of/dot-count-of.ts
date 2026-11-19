import Records from '../../../../records'

/**
 * How many dots of a braille glyph are set.
 *
 * @param bits the bits of the dots
 * @returns the count of the bits that are set
 */
export const dotCountOf = (bits: number): number =>
  Records.DOT_BITS.reduce(
    (count, bit) => ((bits & bit) === 0 ? count : count + 1),
    0,
  )
