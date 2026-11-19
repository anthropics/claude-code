/**
 * Floors a count of columns and holds it under a bound. A count that is no
 * number at all takes the stand-in.
 *
 * @param given The count as a surface passed it.
 * @param most The bound it is held under.
 * @param instead The stand-in for a count that is no number.
 * @returns A whole count of columns, never over the bound.
 */
export const wholeColumns = (
  given: number,
  most: number,
  instead: number,
): number => (Number.isNaN(given) ? instead : Math.min(Math.floor(given), most))
