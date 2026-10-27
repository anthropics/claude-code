import type Types from '../types'
import { datingsOf } from './datings-of'
import { wasDirtyAtStart } from './was-dirty-at-start'

/**
 * The tracked rows, `isPreSession` set on each whose file was modified
 * before the session began and was already dirty then (the built-in's tag).
 *
 * A file that cannot be dated (deleted this session, a symbolic link, past
 * the listing budget), or that turned up since the start (wasDirtyAtStart),
 * stays session work, so nothing real is hidden.
 *
 * @param context the fetch: its stamp probe, the session's start, its baseline
 * @param files the tracked rows
 * @returns the rows, tagged
 */
export async function tagPreSession(
  context: Types.DatingContext,
  files: readonly Types.FileStat[],
): Promise<readonly Types.FileStat[]> {
  const datings = await datingsOf(
    context,
    files.map(file => file.path),
  )

  return files.map(file => ({
    ...file,
    isPreSession:
      datings.get(file.path) === 'pre-session' &&
      wasDirtyAtStart(context, file.path),
  }))
}
