import Lists from '../../../lists'
import { METRIC_FORMATS } from '../../metric-formats'

/**
 * For each shape that `metricsIn` reads, the keys that an answer with points
 * cannot do without, each behind its opening quote.
 *
 * The expressions of the Datadog MCP server are read by code, so their key
 * stands here. Grafana's frames hold `values`, the key of Prometheus.
 */
export const KEYS_OF_SHAPES: readonly string[][] = [
  ['expression'],
  ...METRIC_FORMATS.map(format =>
    [format.series, format.time, format.value]
      .flatMap(path => path.split('.'))
      .filter(step => /^[a-z]\w*$/i.test(step)),
  ),
].map(keys => Lists.distinct(keys).map(key => `"${key}`))
