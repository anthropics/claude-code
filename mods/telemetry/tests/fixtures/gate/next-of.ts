import type { Tier } from 'claude-code'

/**
 * A continuation as the gate is handed it: answers `served` when gone on
 * to, stamped with a caller in the tier given, or with no origin at all.
 *
 * @param tier the caller's tier; undefined for a call that names no origin
 * @returns the continuation
 */
export const nextOf = (tier: Tier | undefined) =>
  Object.assign(() => 'served', {
    origin: tier === undefined ? undefined : { plugin: 'caller', tier },
  })
