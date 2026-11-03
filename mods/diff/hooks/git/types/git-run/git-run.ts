import type { RunResult } from '../run-result'

/**
 * Runs git with `argv` (no `git` in it) against the session's pinned
 * repository and never rejects: a failure is a RunResult of exit code -1.
 */
export type GitRun = (argv: readonly string[]) => Promise<RunResult>
