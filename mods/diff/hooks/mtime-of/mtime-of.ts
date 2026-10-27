import type { Host } from '../host'

/**
 * A path's modification time through the host, or null when the path
 * cannot be read (GitDeps `mtimeOf`).
 *
 * @param engine the bound host
 * @returns the probe
 */
export const mtimeOf =
  (engine: Host) =>
  (path: string): Promise<number | null> =>
    engine.stat(path).then(
      stat => stat.mtimeMs,
      () => null,
    )
