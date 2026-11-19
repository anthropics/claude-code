import type { EngineInterface } from 'claude-code'

import type Easel from '../core/easel'
import Usage from '../core/usage'
import type Shell from '../shell'

/**
 * Tells telemetry of one chart or refusal: a mark, and an event with the
 * surfaces that watch.
 *
 * Not awaited, and no failure is passed on: a chart matters more. The host
 * refuses the telemetry of an installed plugin.
 *
 * @param $ the host's interface
 * @param usage what is told of the chart or refusal
 * @param call who asked, from which agent, and how long the work took
 * @returns nothing: both are sent without waiting
 */
export function recordUse(
  $: EngineInterface,
  usage: Easel.DrawnChart['usage'],
  call: Shell.UsedCall,
): void {
  void $.telemetry
    .mark(Usage.markOf(usage, call.isAsked))
    .catch(() => undefined)
  void $.session
    .surfaces()
    .catch(() => [])
    .then(surfaces =>
      $.telemetry.log(
        Usage.logOf(usage, {
          isAsked: call.isAsked,
          isInSubagent: call.agentId !== undefined,
          surfaces,
          elapsedMs: call.elapsedMs,
        }),
      ),
    )
    .catch(() => undefined)
}
