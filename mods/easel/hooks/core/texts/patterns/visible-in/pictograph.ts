/**
 * Marks a grapheme drawn as a picture: an emoji, a flag letter or a keycap.
 */
export const PICTOGRAPH =
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u{20E3}/u
