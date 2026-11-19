import type CoreCall from '../../../call'
import type Casting from '../../../casting'
import type { Series } from '../series'
import type { Timeline } from '../timeline'

/**
 * What `formProblemIn` looks for a problem in.
 */
export type FormProblemOptions = {
  roles: Casting.Roles
  request: CoreCall.ChartRequest
  series: Series[]
  timeline: Timeline
}
