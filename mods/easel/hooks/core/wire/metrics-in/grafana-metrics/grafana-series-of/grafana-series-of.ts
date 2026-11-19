import Lists from '../../../../lists'
import { entriesAt } from '../../../entries-at'
import type Types from '../../../types'
import { grafanaFieldsOf } from './grafana-fields-of'
import { measureIn } from './measure-in'

/**
 * Number fields with the same labels share a point per time.
 *
 * Queries reuse names such as `Value`, so among several queries the only
 * series of one takes the name Grafana shows for it, any other field its
 * own name and query letter.
 *
 * @param frame one frame of a query, with its schema and its values
 * @param isOnlyFrame whether its query has no other frame
 * @param isOnlyQuery whether the answer has no other query
 * @returns one series per set of labels among the number fields
 */
export function grafanaSeriesOf(
  frame: unknown,
  isOnlyFrame: boolean,
  isOnlyQuery: boolean,
): Types.Series[] {
  const fields = grafanaFieldsOf(frame)
  const numberFields = fields.filter(field => field.type === 'number')
  const textFields = fields.filter(field => field.type === 'string')
  const times = fields.find(field => field.type === 'time')?.cells ?? []

  return [
    ...Lists.groupBy(
      numberFields.map(
        measureIn(frame, isOnlyQuery, isOnlyFrame && numberFields.length === 1),
      ),
      field => JSON.stringify(field.labels),
    ).values(),
  ].map(group => ({
    labels: entriesAt(group[0], 'labels'),
    y: group.map(measure => measure.name),
    pointCount: times.length,
    cellsByKey: [
      ...[...textFields, ...group].map((field): [string, unknown[]] => [
        field.name,
        field.cells,
      ]),
      ['time', times],
    ],
  }))
}
