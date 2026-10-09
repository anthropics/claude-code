import type { TargetTier } from 'claude-code'

/**
 * A failure handler's `next` for a hook that had not called it: the call
 * runs the links beneath, `to` at `append` the run past the user tier.
 *
 * Continued at any other tier it rejects, naming the tier.
 *
 * @param beneath what the run through every tier settles to
 * @param past what the run past the user tier settles to
 * @param tier the tier of whoever raised the dispatch
 * @returns the stand-in
 */
export const uncalled = <R>(beneath: R, past: R, tier: unknown = 'user') =>
  Object.assign((_e: unknown) => Promise.resolve(beneath), {
    to(_e: unknown, at: TargetTier) {
      const isPastUsers = at === 'append'

      return isPastUsers
        ? Promise.resolve(past)
        : Promise.reject(new Error(`continued at ${at}`))
    },
    called: false,
    error: { kind: 'throw' },
    origin: { tier },
  })
