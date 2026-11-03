/**
 * When a path was last written, against the session: before it began,
 * since, or never reached because the listing budget was spent.
 *
 * An undatable path (deleted, a symbolic link) reads as `session`.
 */
export type Dating = 'pre-session' | 'session' | 'unlisted'
