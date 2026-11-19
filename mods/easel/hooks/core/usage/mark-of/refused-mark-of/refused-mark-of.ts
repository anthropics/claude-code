import type { TelemetryMarkInput } from 'claude-code'

import type Types from '../../types'

/**
 * A refusal is `bad`, and the reason it gives is its code.
 *
 * @param feature the feature's name in the host's telemetry
 * @param usage what is told of the refusal
 * @returns the mark of a chart that was not drawn
 */
export const refusedMarkOf = (
  feature: 'easel_chart' | 'easel_auto',
  usage: Types.Usage,
): TelemetryMarkInput => ({ feature, kind: 'bad', reason: usage.outcome })
