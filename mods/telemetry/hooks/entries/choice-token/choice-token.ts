/**
 * The shape of a Choice member: a lowercase token of at most 64 characters,
 * of letters, digits, `_` and `-`.
 *
 * Unlike a name or a key (TOKEN), it may start with a digit (a bucket such
 * as `110_to_143`) and carry a hyphen (a kind such as `merge-base`).
 */
export const CHOICE_TOKEN = /^[a-z0-9][a-z0-9_-]{0,63}$/
