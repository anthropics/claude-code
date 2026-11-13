import type { ProcessRunResult } from 'claude-code'

/**
 * A git answering from a script: the runner, and every argv it has been
 * handed so far.
 */
export type ScriptedGit = {
  run: (argv: readonly string[]) => Promise<ProcessRunResult>
  argvs: readonly (readonly string[])[]
}
