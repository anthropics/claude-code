/**
 * `host` is one of the terminal's own sixteen colours, so that the user's
 * theme keeps the contrast. Undefined is the default text colour.
 *
 * The two painters share these inks, and both surfaces also write the `title`
 * ink in bold.
 */
export const PALETTE = {
  title: { host: undefined, light: '#1f1f1f', dark: '#f2f0eb' },
  words: { host: undefined, light: '#2b2b2b', dark: '#e6e4df' },
  quiet: { host: 'ansi256(8)', light: '#6b6b6b', dark: '#a3a19b' },
  blue: { host: 'ansi256(4)', light: '#2a6fdb', dark: '#6ea8ff' },
  orange: { host: 'ansi256(3)', light: '#b85c00', dark: '#f0a04b' },
  green: { host: 'ansi256(2)', light: '#1a7f4e', dark: '#5fc98f' },
  pink: { host: 'ansi256(5)', light: '#b0307f', dark: '#ee82c4' },
  teal: { host: 'ansi256(6)', light: '#0b7c8a', dark: '#5cc8d6' },
  red: { host: 'ansi256(1)', light: '#c0392b', dark: '#ff8a7a' },
  violet: { host: 'ansi256(13)', light: '#6f42c1', dark: '#b794f6' },
  olive: { host: 'ansi256(10)', light: '#5c7a00', dark: '#b5d94c' },
} as const
