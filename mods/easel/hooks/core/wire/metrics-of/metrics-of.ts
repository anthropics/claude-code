import Casting from '../../casting'
import Lists from '../../lists'
import type Types from '../types'
import { pointedMetrics } from './pointed-metrics'

/**
 * Every point gets a copy of the labels, so a short text can name millions
 * of cells: the size of the table is tested before any point is made.
 *
 * @param source the format the series were read as
 * @param seriesList the series read, each with its labels and its cells
 * @returns one record per point, or no point when the table is too large
 */
export function metricsOf(
  source: Types.MetricSource,
  seriesList: Types.Series[],
): Types.Metrics {
  const isTableTooLarge = Casting.isTooLarge(
    Math.max(
      0,
      ...seriesList.map(
        series => series.labels.length + series.cellsByKey.length,
      ),
    ),
    Lists.sumOf(seriesList.map(series => series.pointCount)),
  )

  return pointedMetrics(source, seriesList, isTableTooLarge ? [] : seriesList)
}
