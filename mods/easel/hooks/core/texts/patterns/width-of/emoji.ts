/**
 * Fitted, like `WIDE` and `ZERO_WIDTH`, to `stringWidth`, which the
 * host measures with and a plugin cannot call. A test compares the two.
 */
export const EMOJI =
  /\p{Emoji_Presentation}|\p{Extended_Pictographic}\u{FE0F}|\u{20E3}/u
