/**
 * A server's or a tool's name as look-alike checks compare it: spelled as
 * the engine spells a name inside a tool's (every other character a `_`,
 * no normalization), lower-cased, runs of `-` and `_` one `_`, trimmed.
 *
 * `Corp__Tools`, `corp-tools` and `corp.tools` all fold to `corp_tools`: a
 * model reads them as one name, so one of them may not pass for another.
 *
 * @param name the name as written
 * @returns the fold
 */
export const foldedName = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase()
    .replace(/[-_]+/g, '_')
    .replace(/^_|_$/g, '')
