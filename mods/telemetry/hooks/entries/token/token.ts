/**
 * The shape of an event name, a feature name and a reason: a snake_case token
 * of at most 64 characters, starting with a letter. A property key has it
 * too, in either case (fits); a Choice member's is CHOICE_TOKEN.
 */
export const TOKEN = /^[a-z][a-z0-9_]{0,63}$/

/**
 * What mixed-case text is spelled with: letters and `_`, and at most one
 * number, of one or two digits, after a lowercase letter.
 */
const MIXED = /^[A-Za-z_]*(?:[a-z]\d{1,2}[A-Za-z_]*)?$/

/**
 * A word: a common short one, or three letters and up that can be pronounced.
 */
const WORD =
  /^(?:as|at|by|id|in|is|ms|of|on|or|to|(?=.*[aeiouy])(?!.*[^aeiouy]{6}).{3,})$/i

/**
 * Whether text has a lowercase shape as it is, or would in lowercase and
 * reads as words, camelCase or PascalCase, with at most one abbreviation.
 *
 * Generated ids and keys mix their cases at random, and seldom read so.
 *
 * @param shape TOKEN or CHOICE_TOKEN
 * @param text the key or the member as the caller spelled it
 * @returns whether the text goes into a row as it is spelled
 */
export function fits(shape: RegExp, text: string): boolean {
  if (shape.test(text)) {
    return true
  }

  if (!shape.test(text.toLowerCase()) || !MIXED.test(text)) {
    return false
  }

  const [abbreviation = '', another] = (
    text.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g) ?? []
  ).filter(part => part === part.toUpperCase() || !WORD.test(part))

  return abbreviation.length <= 4 && another === undefined
}

/**
 * The lowercase spellings text is compared under: as it stands, and with its
 * camelCase words parted by `_`. Lowercase text is both.
 *
 * @param text a key or a member that fits
 * @returns the two spellings
 */
export const folded = (text: string): readonly [string, string] => [
  text.toLowerCase(),
  text.replace(/[a-z\d](?=[A-Z])|[A-Z](?=[A-Z][a-z])/g, '$&_').toLowerCase(),
]
