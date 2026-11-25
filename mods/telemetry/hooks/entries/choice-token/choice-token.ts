/**
 * The shape of a Choice member: a token of at most 64 letters, digits, `_`
 * and `-`, in lowercase, or in either case where it reads as words (fits).
 *
 * Unlike a name or a key (TOKEN), it may start with a digit (a bucket such
 * as `110_to_143`) and carry a hyphen (a kind such as `merge-base`).
 */
export const CHOICE_TOKEN = /^[a-z0-9][a-z0-9_-]{0,63}$/
