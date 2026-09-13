import type Backend from '../../../hooks/backend'

/**
 * A backend host under test with the programs its runner was asked to run,
 * in order.
 */
export type RecordingBackendHost = {
  host: Backend.BackendHost
  programs: readonly (string | undefined)[]
}
