/**
 * A path with one separator spelling and no trailing separator, so two
 * spellings of one path compare equal (`C:/repo/x` and `C:\repo\x`).
 *
 * @param path an absolute path as a walk or the model spelled it
 * @returns the path with `/` for every separator, no trailing one
 */
export const normalSpellingOf = (path: string): string =>
  path.replaceAll('\\', '/').replace(/(?<=.)\/+$/, '')
