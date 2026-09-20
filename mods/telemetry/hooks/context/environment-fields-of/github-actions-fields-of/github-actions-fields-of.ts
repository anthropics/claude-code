import type { Facts } from '../../../facts'
import type EnvironmentFields from '../../environment-fields'

/**
 * The GitHub Actions ids for the row's `env` block; undefined when the
 * workflow names none of the three.
 *
 * @param facts the variables as read once for the session
 * @returns the ids, or undefined
 */
export function githubActionsFieldsOf(
  facts: Facts,
): EnvironmentFields.GithubActionsFields | undefined {
  const hasAny =
    facts.githubActorId !== undefined ||
    facts.githubRepositoryId !== undefined ||
    facts.githubRepositoryOwnerId !== undefined

  return hasAny
    ? {
        actorId: facts.githubActorId,
        repositoryId: facts.githubRepositoryId,
        repositoryOwnerId: facts.githubRepositoryOwnerId,
      }
    : undefined
}
