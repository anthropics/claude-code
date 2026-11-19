/**
 * A cell that starts with a digit, after any signs, brackets or blanks.
 */
export const OPENS_LIKE_A_NUMBER = /^[^\p{L}\p{N}]*\p{N}/u
