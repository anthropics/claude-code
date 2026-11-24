import type { Telemetry } from '../../types'

/**
 * What `telemetryOf` builds: the `$.telemetry` noun for each caller, and
 * the flush the plugin's session.end hook calls to send what still waits.
 */
export type Sender = {
  /**
   * The noun as an installed plugin is served it, by its id, or with none as
   * a built-in is.
   */
  telemetryFor: (pluginId?: string) => Telemetry

  /**
   * Sends every queued row now, in one batch; resolves once it settled.
   */
  flush: () => Promise<void>
}
