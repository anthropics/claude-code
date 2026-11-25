import type Git from '../../hooks/git'

/**
 * A directory's listing from its entries' kinds, each file dated by
 * `mtimeOf`; undated when none is given, so a stat has to answer.
 *
 * @param kinds the entries' names and kinds
 * @param mtimeOf a listed file's time, by name
 * @returns the listing (GitDeps `entriesOf`)
 */
export function listingOf(
  kinds: Iterable<readonly [string, Git.EntryKind]>,
  mtimeOf: (name: string) => number = () => 0,
): ReadonlyMap<string, Git.ListedEntry> {
  return new Map(
    Array.from(kinds, ([name, kind]) => [
      name,
      { kind, mtimeMs: kind === 'file' ? mtimeOf(name) : 0 },
    ]),
  )
}
