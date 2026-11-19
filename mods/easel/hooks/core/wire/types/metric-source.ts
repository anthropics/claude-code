import type { MetricFormat } from './metric-formats'

/**
 * What the points of an answer carry of the format they were read as.
 */
export type MetricSource = Pick<MetricFormat, 'name' | 'isReadAtInstants'>
