/**
 * The GitHub Actions ids a row's `env` block carries when the session runs
 * in a workflow: the actor, the repository and its owner, by number.
 */
export type GithubActionsFields = {
  readonly actorId: string | undefined
  readonly repositoryId: string | undefined
  readonly repositoryOwnerId: string | undefined
}
