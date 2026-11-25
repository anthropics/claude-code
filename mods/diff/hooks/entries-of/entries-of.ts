import type Git from '../git'
import type { Host } from '../host'

/**
 * A directory's entries by name as they stand, through the host's
 * listing (no link followed); null when it cannot be listed.
 *
 * @param engine the bound host
 * @returns the probe (GitDeps `entriesOf`)
 */
export const entriesOf =
  (engine: Host) =>
  (dir: string): Promise<ReadonlyMap<string, Git.ListedEntry> | null> =>
    engine.listDir(dir).then(
      entries => new Map(entries.map(entry => [entry.name, entry])),
      () => null,
    )
