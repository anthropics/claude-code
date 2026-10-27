import type { FsEntry } from 'claude-code'

/**
 * A directory entry's own kind as `$.fs.list` reports it, no link
 * followed: `file`, `dir`, or `other` (a symbolic link is `other`).
 */
export type EntryKind = FsEntry['kind']
