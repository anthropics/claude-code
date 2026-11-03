import type Types from '../../types'

/**
 * A path's modification time when the walk shows it as a real entry of the
 * wanted kind under real directories; otherwise nothing is stat'ed.
 *
 * A path git printed with a trailing `/` (an untracked directory, a nested
 * repository) names a directory and is dated as one.
 *
 * @param probe the walk over the base directory and the timestamp probe
 * @param path the path relative to the walk's root
 * @returns the timestamp, `over-budget`, or null
 */
export async function stampIfFile(
  probe: Types.StampProbe,
  path: string,
): Promise<Types.Stamp> {
  const isDirectory = path.endsWith('/')
  const entry = isDirectory ? path.slice(0, -1) : path
  const kind = await probe.walk.kindOf(entry)
  const isUnlisted = kind === 'over-budget'
  const isWanted = kind === (isDirectory ? 'dir' : 'file')

  return isUnlisted
    ? 'over-budget'
    : isWanted
      ? probe.mtimeOf(`${probe.base}/${entry}`)
      : null
}
