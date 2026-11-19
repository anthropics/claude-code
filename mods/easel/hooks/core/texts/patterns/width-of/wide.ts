/**
 * Code points drawn two cells wide: CJK, Hangul syllables, fullwidth forms,
 * and symbols that some terminals draw wide.
 */
export const WIDE = new RegExp(
  '[' +
    String.raw`\u{1100}-\u{115F}\u{2329}\u{232A}\u{2630}-\u{2637}` +
    String.raw`\u{268A}-\u{268F}\u{2E80}-\u{303E}` +
    String.raw`\u{3041}-\u{A4C6}\u{A960}-\u{A97C}\u{AC00}-\u{D7A3}` +
    String.raw`\u{F900}-\u{FAFF}\u{FE10}-\u{FE19}\u{FE30}-\u{FE6B}` +
    String.raw`\u{FF01}-\u{FF60}\u{FFE0}-\u{FFE6}\u{16FE0}-\u{18DF2}` +
    String.raw`\u{1AFF0}-\u{1B2FB}\u{1D300}-\u{1D376}\u{1F200}-\u{1F265}` +
    String.raw`\u{17A4}\u{17D8}\u{261D}\u{26F9}\u{270C}\u{270D}\u{2E3A}` +
    String.raw`\u{2E3B}\u{1F3CB}\u{1F3CC}\u{1F574}\u{1F575}\u{1F590}` +
    String.raw`\u{1F93B}\u{1F946}` +
    String.raw`\u{20000}-\u{3FFFD}` +
    ']',
  'u',
)
