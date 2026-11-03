import type Types from '../types'

/**
 * The comparisons git offers, in picker order: all three.
 */
export const GIT_BASE_MODES: readonly Types.BaseMode[] = Object.freeze([
  'session',
  'uncommitted',
  'branch',
])
