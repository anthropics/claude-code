import { whichSync } from './which.js'

/**
 * Find an executable by searching PATH, similar to `which`.
 * Replaces spawn-rx's findActualExecutable to avoid pulling in rxjs (~313 KB).
 *
 * Returns { cmd, args } to match the spawn-rx API shape.
 * `cmd` is the resolved path if found, or the original name if not.
 * `args` is always the pass-through of the input args.
 */
export function findExecutable(
  exe: string,
  args: string[],
): { cmd: string; args: string[] } {
  const resolved = whichSync(exe)
  return { cmd: resolved ?? exe, args }
}
