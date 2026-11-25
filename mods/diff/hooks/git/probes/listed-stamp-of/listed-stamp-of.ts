import type Types from '../../types'
import { stampIfFile } from '../stamp-if-file'

/**
 * A file's modification time as its directory's listing gave it, for a poll
 * whose next look lists again; stampIfFile answers where the listing gave none.
 *
 * @param probe the walk over the base directory and the timestamp probe
 * @param path the file, relative to the walk's root
 * @returns the timestamp, `over-budget`, or null
 */
export async function listedStampOf(
  probe: Types.StampProbe,
  path: string,
): Promise<Types.Stamp> {
  const listed = await probe.walk.entryOf(path)
  const isFile = listed !== 'over-budget' && listed?.kind === 'file'

  return (isFile && listed.mtimeMs) || stampIfFile(probe, path)
}
