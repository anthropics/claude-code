import type { Bar } from '../bar'
import type { Frame } from '../frame'

/**
 * A chart of one bar for each series.
 */
export type BarsChart = Frame & { form: 'bars'; rows: Bar[] }
