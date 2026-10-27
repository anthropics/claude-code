/**
 * The environment laid over every git child the plugin spawns: the C
 * locale, so `--shortstat` and git's messages parse the same everywhere.
 *
 * Nothing else is pinned, as for the built-in panel's own diff children:
 * a partial clone lazy-fetches as it would for `git diff` at the prompt.
 */
export const GIT_CHILD_ENV = { LC_ALL: 'C', LANGUAGE: '' } as const
