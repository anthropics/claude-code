import type { DrawnChart } from './drawn-chart'
import type { NoChart } from './no-chart'
import type { RefusedChart } from './refused-chart'

/**
 * Everything an entry point may answer: a chart, a refusal, or nothing.
 */
export type Outcome = DrawnChart | RefusedChart | NoChart
