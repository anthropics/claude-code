import Limits from '../../hooks/limits'

/**
 * How `$.process.run` refuses a git that outran its timeout.
 */
export const GIT_HUNG =
  'git aborted: still running after ' + `${Limits.GIT_TIMEOUT_MS}ms`
