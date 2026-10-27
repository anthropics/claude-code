import type { FsEntry } from 'claude-code'

import { distinct } from './distinct'
import { VCS_MARKERS } from './vcs-markers'

/**
 * The row's `vcs`: the version-control systems whose marker is in the
 * session's directory, Perforce too when P4PORT is set, comma-joined.
 *
 * @param list lists a directory
 * @param cwd the session's directory
 * @param hasP4Port whether P4PORT is set
 * @returns the systems found, or undefined for none or an unlistable directory
 */
export async function vcsOf(
  list: (path: string) => Promise<readonly FsEntry[]>,
  cwd: string,
  hasP4Port: boolean,
): Promise<string | undefined> {
  let entries: readonly FsEntry[]

  try {
    entries = await list(cwd)
  } catch {
    entries = []
  }

  const names = new Set(entries.map(entry => entry.name))

  const found = distinct([
    ...(hasP4Port ? ['perforce'] : []),
    ...VCS_MARKERS.flatMap(([marker, system]) =>
      names.has(marker) ? [system] : [],
    ),
  ])

  return found.length > 0 ? found.join(',') : undefined
}
