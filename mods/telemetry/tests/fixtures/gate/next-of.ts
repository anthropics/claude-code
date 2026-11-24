import type { NextOrigin, Tier } from 'claude-code'

/**
 * A continuation as the gate is handed it: answers `served` when gone on
 * to, stamped with a caller in the tier given, or with no origin at all.
 *
 * @param tier the caller's tier; undefined for a call that names no origin
 * @param told what the host tells of the caller's load beside its tier
 * @returns the continuation
 */
export const nextOf = (
  tier: Tier | undefined,
  told: Pick<NextOrigin, 'isOfficial' | 'pluginId'> = {},
) =>
  Object.assign(() => 'served', {
    origin: tier && { plugin: 'caller', tier, ...told },
  })
