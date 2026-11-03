import type { TelemetryMarkKind } from '../../../types'
import type { Fields } from '../fields'

/**
 * One mark past every check: the feature, how it went, why when not ok,
 * and its properties as they go into the row.
 */
export type Mark = {
  kind: TelemetryMarkKind
  feature: string
  reason?: string
  props: Fields['props']
}
