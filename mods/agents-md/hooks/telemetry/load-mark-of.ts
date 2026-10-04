import { FEATURE_NAME } from './feature-name.js'
import type { LoadCounts, TelemetryMark } from './types'
import { WALK_FAILED_REASON } from './walk-failed-reason.js'

/**
 * The first context's feature mark: `ok`, or `sad` when the walk failed and
 * the context went on without AGENTS.md.
 *
 * @param counts what the first context handed on
 * @returns the mark to send
 */
export const loadMarkOf = (counts: LoadCounts): TelemetryMark =>
  counts.isWalkFailed
    ? { feature: FEATURE_NAME, kind: 'sad', reason: WALK_FAILED_REASON }
    : { feature: FEATURE_NAME, kind: 'ok' }
