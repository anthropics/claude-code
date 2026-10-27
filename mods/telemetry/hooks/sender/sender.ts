import type { Telemetry } from '../../types'

/**
 * What `telemetryOf` builds: the `$.telemetry` noun, and the flush the
 * plugin's session.end hook calls to send what still waits.
 */
export type Sender = {
  telemetry: Telemetry

  /**
   * Sends every queued row now, in one batch; resolves once it settled.
   */
  flush: () => Promise<void>
}
