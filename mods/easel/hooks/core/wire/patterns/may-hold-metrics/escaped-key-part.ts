/**
 * An escape that can hide a key: of a letter or a quote, of the backslash or
 * a digit of another escape, or of the start of a color code.
 */
export const ESCAPED_KEY_PART = /\\u00(?:1b|22|3\d|[4-7])/i
