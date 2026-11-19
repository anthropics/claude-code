import type { TelemetryMarkInput } from 'claude-code'

import type Types from '../types'
import { drawnMarkOf } from './drawn-mark-of'
import { refusedMarkOf } from './refused-mark-of'

/**
 * A chart is `ok`, or `sad` where a note says what it lacks; a refusal is
 * `bad` with its code.
 *
 * @param usage what is told of the chart or refusal
 * @param isAsked whether the model asked for the chart
 * @returns the mark for the host's telemetry
 */
export function markOf(
  usage: Types.Usage,
  isAsked: boolean,
): TelemetryMarkInput {
  const feature = isAsked ? 'easel_chart' : 'easel_auto'
  const isDrawn = usage.outcome === 'drawn'

  return isDrawn ? drawnMarkOf(feature, usage) : refusedMarkOf(feature, usage)
}
