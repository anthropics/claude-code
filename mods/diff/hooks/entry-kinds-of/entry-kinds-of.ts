import type Git from '../git'
import type { Host } from '../host'

/**
 * A directory's entries by name with their own kinds, through the host's
 * listing (no link followed); null when it cannot be listed.
 *
 * @param engine the bound host
 * @returns the probe (GitDeps `entryKindsOf`)
 */
export const entryKindsOf =
  (engine: Host) =>
  (dir: string): Promise<ReadonlyMap<string, Git.EntryKind> | null> =>
    engine.listDir(dir).then(
      entries => new Map(entries.map(entry => [entry.name, entry.kind])),
      () => null,
    )
