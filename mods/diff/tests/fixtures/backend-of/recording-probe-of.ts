import type Backend from '../../../hooks/backend'
import type { RecordingProbe } from './recording-probe.js'
import { stubBackendOf } from './stub-backend-of.js'

/**
 * A backend probe that notes each host it is asked about and answers a stub
 * backend at the toplevel, or declines (null) when given none.
 *
 * @param toplevel the working copy's root, or null to decline
 * @returns the probe and the hosts it was asked about, in order
 */
export function recordingProbeOf(toplevel: string | null): RecordingProbe {
  const asked: Backend.BackendHost[] = []
  const answer = toplevel === null ? null : stubBackendOf(toplevel)

  return {
    asked,
    probe: host => {
      asked.push(host)

      return Promise.resolve(answer)
    },
  }
}
