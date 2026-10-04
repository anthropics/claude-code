import type { TelemetryMarkKind } from '../../../types'

/**
 * The three kinds a mark may be, in the order the feature events name them.
 */
export const MARK_KINDS: readonly TelemetryMarkKind[] = ['ok', 'sad', 'bad']
