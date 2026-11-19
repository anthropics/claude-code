/**
 * An emoji needs its joiners and variation selectors to stay one picture.
 */
export const INVISIBLE_IN_EMOJI =
  /[\p{Cc}\u{E0000}-\u{E007F}\u{202A}-\u{202E}\u{2066}-\u{2069}]/gu
