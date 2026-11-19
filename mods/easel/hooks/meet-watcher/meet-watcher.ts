import type { EngineInterface } from 'claude-code'

import CoreCall from '../core/call'
import Usage from '../core/usage'
import type Shell from '../shell'

/**
 * Meets whoever came to watch: offers the chart tool and tells telemetry of
 * a changed setting.
 *
 * @param $ the host's interface
 * @param changedSetting what the user changed about unasked charts, if anything
 * @returns the offer, which settles once it is made or refused
 */
export function meetWatcher(
  $: EngineInterface,
  changedSetting: Shell.ChangedSetting,
): Promise<unknown> {
  const offered = $.tool
    .register(CoreCall.TOOL_SPEC)
    .catch((error: unknown) =>
      $.ui.log(`no chart tool: ${String(error)}`, { to: 'debug' }),
    )

  if (changedSetting) {
    void $.telemetry
      .log(Usage.settingsLogOf(changedSetting))
      .catch(() => undefined)
  }

  return offered
}
