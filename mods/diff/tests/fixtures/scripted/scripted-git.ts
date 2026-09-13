import type Git from '../../../hooks/git'

/**
 * A git answering from a script: the runner, and every argv it has been
 * handed so far.
 */
export type ScriptedGit = {
  run: Git.GitRun
  argvs: readonly (readonly string[])[]
}
