/**
 * What the diff compares the working tree against: HEAD partitioned by the
 * session's start, HEAD plainly, or the merge-base with the default branch.
 */
export type BaseMode = 'session' | 'uncommitted' | 'branch'
