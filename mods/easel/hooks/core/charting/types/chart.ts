import type { BarsChart } from './bars-chart'
import type { ShareChart } from './share-chart'
import type { SparksChart } from './sparks-chart'
import type { TimeChart } from './time-chart'

/**
 * One of four shapes, told apart by `form`.
 */
export type Chart = TimeChart | BarsChart | ShareChart | SparksChart
