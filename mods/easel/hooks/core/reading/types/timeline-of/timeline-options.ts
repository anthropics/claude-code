import type Calendar from '../../../calendar'
import type Casting from '../../../casting'

/**
 * What `timelineOf` lays the time axis from.
 */
export type TimelineOptions = {
  times: number[]
  grid: Calendar.SampleGrid | null
  readAs: Casting.Roles['form']
  zone: string
  isZoned: boolean
}
