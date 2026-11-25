import type Types from '../../types'

/**
 * A KindWalk: each directory is listed once, only after its own entry
 * read as `dir` in its parent, and only while listings remain.
 *
 * Read from the root down, one listing a component: the depth is the
 * budget's, never the stack's. A symbolic link is never listed or descended
 * and what lies under it reads as null; the unlisted reads `over-budget`.
 *
 * @param entriesOf the host's directory listing
 * @param root the absolute directory the walk's paths are relative to
 * @param budget how many directories this walk may list
 * @returns the walk
 */
export function kindWalkOf(
  entriesOf: Types.GitDeps['entriesOf'],
  root: string,
  budget: number,
): Types.KindWalk {
  const listings = new Map<
    string,
    Promise<ReadonlyMap<string, Types.ListedEntry> | null>
  >()

  function listingOf(directory: string) {
    const held = listings.get(directory)
    const isOverBudget = held === undefined && listings.size >= budget

    if (isOverBudget) {
      return 'over-budget'
    }

    const listed =
      held ?? entriesOf(directory === '' ? root : `${root}/${directory}`)

    listings.set(directory, listed)

    return listed
  }

  async function entryOf(path: string): Promise<Types.WalkEntry> {
    const names = path === '' ? [] : path.split('/')

    let directory = ''

    for (const [depth, name] of names.entries()) {
      const listing = listingOf(directory)

      if (listing === 'over-budget') {
        return 'over-budget'
      }

      const entry = (await listing)?.get(name) ?? null
      const isLeaf = depth === names.length - 1

      if (isLeaf) {
        return entry
      }

      if (entry?.kind !== 'dir') {
        return null
      }

      directory = directory === '' ? name : `${directory}/${name}`
    }

    return { kind: 'dir', mtimeMs: 0 }
  }

  return { entryOf }
}
