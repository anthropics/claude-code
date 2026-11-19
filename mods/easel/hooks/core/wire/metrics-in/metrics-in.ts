import { METRIC_FORMATS } from '../metric-formats'
import { metricsOf } from '../metrics-of'
import type Types from '../types'
import { arePaired } from './are-paired'
import { expandedDatadogMcp } from './expanded-datadog-mcp'
import { grafanaMetrics } from './grafana-metrics'
import { groupedDatadog } from './grouped-datadog'
import { seriesListOf } from './series-list-of'
import { seriesToldApart } from './series-told-apart'

/**
 * Reads the JSON that metrics services answer with into one record per
 * point.
 *
 * Datadog's tags are read as labels only where that gives points and tells
 * as many series apart as its own texts do. So no answer loses its chart to
 * the better names, however it is written.
 *
 * @param root the parsed JSON of an answer
 * @returns the points of the first format that gives any, else `undefined`
 */
export function metricsIn(root: unknown): Types.Metrics | undefined {
  const grafana = grafanaMetrics(root)
  const hasGrafanaPoints = grafana.points.length > 0

  if (hasGrafanaPoints) {
    return grafana
  }

  const plainRoot = expandedDatadogMcp(root)
  const labelledRoot = groupedDatadog(plainRoot)
  const readings =
    labelledRoot === plainRoot ? [plainRoot] : [labelledRoot, plainRoot]

  for (const format of METRIC_FORMATS) {
    for (const reading of readings) {
      const seriesList = seriesListOf(reading, format)
      const metrics = metricsOf(format, arePaired(seriesList) ? seriesList : [])
      const isKept =
        metrics.points.length > 0 &&
        seriesToldApart(reading, format) >= seriesToldApart(plainRoot, format)

      if (isKept) {
        return metrics
      }
    }
  }

  return undefined
}
