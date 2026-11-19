import type Reading from '../../../reading'
import type { PlotArea } from '../plot-area'
import type { Room } from '../room'
import type { Flag } from './flag'

/**
 * What `timeAxisOf` takes: the room to fill, the time that the axis
 * spans, the area above it and the marks to label under it.
 */
export type TimeAxisToLay = {
  room: Room
  timeline: Reading.Timeline
  area: PlotArea
  flags: Flag[]
}
