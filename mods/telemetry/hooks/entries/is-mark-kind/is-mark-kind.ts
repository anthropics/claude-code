import type { TelemetryMarkKind } from '../../../types'
import { MARK_KINDS } from '../mark-kinds'

/**
 * Whether the value names one of the three mark kinds.
 *
 * @param value what the caller passed as `kind`
 * @returns whether value names one of the three mark kinds
 */
export const isMarkKind = (value: unknown): value is TelemetryMarkKind =>
  MARK_KINDS.some(kind => kind === value)
