/**
 * Code points that take no cell: combining marks, zero-width characters and
 * the trailing jamo of Hangul.
 */
export const ZERO_WIDTH = new RegExp(
  '[' +
    String.raw`\p{Mn}\p{Me}\u{1160}-\u{11FF}\u{200B}-\u{200F}` +
    String.raw`\u{D7B0}-\u{D7FB}` +
    ']',
  'u',
)
