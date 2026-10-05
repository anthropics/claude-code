import type AdmissionFailure from '../../admission-failure'

/**
 * What a failure handler's `next` carries of why its hook failed (Caught's).
 */
export type Failed = {
  readonly error: AdmissionFailure.FailureRead
}
