import type { TelemetryMarkInput } from 'claude-code'

import type Types from '../../types'

/**
 * A chart is `ok`. It is `sad` where a note says that part of the data is not
 * in it, or that it is not in the form the model named.
 *
 * @param feature the feature's name in the host's telemetry
 * @param usage what is told of the chart
 * @returns the mark of a chart that was drawn
 */
export function drawnMarkOf(
  feature: 'easel_chart' | 'easel_auto',
  usage: Types.Usage,
): TelemetryMarkInput {
  if (usage.hasLeftOut) {
    return { feature, kind: 'sad', reason: 'data_left_out' }
  }

  return usage.isFormReplaced
    ? { feature, kind: 'sad', reason: 'form_replaced' }
    : { feature, kind: 'ok' }
}
