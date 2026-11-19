import Patterns from '../../patterns'
import Words from '../../words'

/**
 * Cuts a string that is far too long before any costly work is done on it,
 * and marks the cut.
 *
 * A cut that falls inside a surrogate pair drops the half that is left.
 *
 * @param raw the string as it came
 * @param maxCodeUnits the most code units kept
 * @returns the string, or its start with the mark of a cut after it
 */
export function boundedTo(raw: string, maxCodeUnits: number): string {
  const isOverlong = raw.length > maxCodeUnits

  return isOverlong
    ? raw.slice(0, maxCodeUnits).replace(Patterns.HIGH_SURROGATE_AT_END, '') +
        Words.ELLIPSIS
    : raw
}
