import type Backend from '../../../hooks/backend'

/**
 * A backend probe under test with the hosts it was asked about, in order.
 */
export type RecordingProbe = {
  probe: Backend.BackendProbe
  asked: readonly Backend.BackendHost[]
}
