import Json from '../../../json'
import { metricsOf } from '../../metrics-of'
import type Types from '../../types'
import Words from '../../words'
import { grafanaSeriesOf } from './grafana-series-of'

/**
 * Frames come per query, and each frame states its own field types, so no
 * format of paths is tried on Grafana's answers.
 *
 * Grafana's own API keys the queries under `results`. A proxy that asks one
 * query hands its frames over under `data`. A frame says in its `meta` whether
 * it is a time series, and whether it is a matrix of Prometheus, whose values
 * are read at their times.
 *
 * @param root the parsed JSON of an answer
 * @returns the points of every frame, none when the answer is not Grafana's
 */
export function grafanaMetrics(root: unknown): Types.Metrics {
  const asked = Json.valuesAt(root, 'results.*')
  const queries = (asked.length > 0 ? asked : Json.valuesAt(root, 'data')).map(
    query => Json.valuesAt(query, 'frames.[]'),
  )

  return {
    ...metricsOf(
      {
        name: Words.GRAFANA,
        isReadAtInstants: queries
          .flat()
          .every(
            frame =>
              Json.valuesAt(frame, 'schema.meta.custom.resultType')[0] ===
              'matrix',
          ),
      },
      queries.flatMap(frames =>
        frames.flatMap(frame =>
          grafanaSeriesOf(frame, frames.length === 1, queries.length === 1),
        ),
      ),
    ),
    isSeries: queries
      .flat()
      .every(frame =>
        String(Json.valuesAt(frame, 'schema.meta.type')[0]).startsWith(
          'timeseries',
        ),
      ),
  }
}
