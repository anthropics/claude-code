/**
 * The row's `github_action_ref`: what follows `claude-code-action/` in the
 * action's path, as the CLI reads it; undefined when the path names none.
 *
 * @param actionPath GITHUB_ACTION_PATH as read
 * @returns the ref, or undefined
 */
export const actionRefOf = (actionPath: string | undefined) =>
  actionPath?.includes('claude-code-action/')
    ? actionPath.split('claude-code-action/')[1]
    : undefined
