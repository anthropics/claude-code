import type Types from '../../types'
import { stampIfFile } from '../stamp-if-file'

/**
 * When each path was last modified against the session's start, dating a
 * path only when it is a real file under real directories at every level.
 *
 * Listings report an entry's own kind, so a symbolic link anywhere on the
 * path is never listed, descended or stat'ed: session work (the engine
 * lstats); a path the listing budget never reached is the caller's to place.
 *
 * @param context the fetch's stamp probe over the working tree's top, and
 *   when the session began
 * @param paths repository-relative paths, `/`-separated as git prints them
 * @returns each path's Dating
 */
export async function datingsOf(
  context: Types.DatingContext,
  paths: readonly string[],
): Promise<ReadonlyMap<string, Types.Dating>> {
  const { sessionStartMs } = context.deps

  const stamps: readonly Types.Stamp[] = await Promise.all(
    paths.map(path => stampIfFile(context.stamps, path)),
  )

  function datingOf(stamp: Types.Stamp): Types.Dating {
    if (stamp === 'over-budget') {
      return 'unlisted'
    }

    const isEarlier = (stamp ?? Number.POSITIVE_INFINITY) < sessionStartMs

    return isEarlier ? 'pre-session' : 'session'
  }

  return new Map(paths.map((path, at) => [path, datingOf(stamps[at] ?? null)]))
}
