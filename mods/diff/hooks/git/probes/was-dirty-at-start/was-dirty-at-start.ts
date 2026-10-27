import type Types from '../../types'

/**
 * Whether a path may predate the session at all: it was dirty when the
 * baseline was read (the first fetch), or nothing says otherwise (none was).
 *
 * A path missing from the baseline turned up since, so its old timestamp
 * (a rename keeps the file's, a move keeps the source's) does not date it,
 * as the built-in's change-time check does not let it.
 *
 * @param context the fetch's dating context
 * @param path the root-relative path
 * @returns false only when a baseline exists and lacks the path
 */
export const wasDirtyAtStart = (context: Types.DatingContext, path: string) =>
  context.deps.baseline?.has(path) ?? true
