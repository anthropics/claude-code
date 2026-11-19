import { METRIC_FORMATS } from '../metric-formats'
import Words from '../words'

/**
 * Every source that a table of metrics can carry: the formats read by
 * paths, then Grafana.
 */
export const METRIC_SOURCES: readonly string[] = [
  ...METRIC_FORMATS.map(format => format.name),
  Words.GRAFANA,
]
