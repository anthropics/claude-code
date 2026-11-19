import Words from '../../words'

/**
 * `-1,204.5`, `$1.2B`, `3e-4`, `12 req/s`, `250ms`, `(42)` for minus 42.
 */
export const NUMBER_PATTERN = new RegExp(
  Words.NUMBER_SIGN +
    Words.NUMBER_DIGITS +
    Words.NUMBER_EXPONENT +
    Words.NUMBER_SUFFIX,
  'i',
)
