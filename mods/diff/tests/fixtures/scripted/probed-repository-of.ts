import Git from '../../../hooks/git'
import { ok } from './ok.js'
import { scriptedGitOf } from './scripted-git-of.js'

/**
 * What the repository probe makes of a scripted `rev-parse` answer.
 *
 * @param stdout the scripted rev-parse output
 * @returns the probed repository, or null
 */
export const probedRepositoryOf = (stdout: string) =>
  Git.repositoryOf(scriptedGitOf({ 'rev-parse': ok(stdout) }).run)
