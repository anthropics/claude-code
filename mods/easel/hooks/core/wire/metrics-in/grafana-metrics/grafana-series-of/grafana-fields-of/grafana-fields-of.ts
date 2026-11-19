import Json from '../../../../../json'
import Texts from '../../../../../texts'
import type Types from '../../../../types'

/**
 * Grafana keeps what the fields are in a schema and their cells apart, in
 * the same order: each field is read with the cells at its index.
 *
 * @param frame one frame of a query, with its schema and its values
 * @returns its fields, each with its cells
 */
export const grafanaFieldsOf = (frame: unknown): Types.GrafanaField[] =>
  Json.valuesAt(frame, 'schema.fields.[]').map((field, fieldIndex) => ({
    name: String(Json.valuesAt(field, 'name')[0]),
    displayName: Json.valuesAt(field, 'config.displayNameFromDS')[0],
    type: Json.valuesAt(field, 'type')[0],
    labels: Json.valuesAt(field, 'labels')[0],
    unit: Texts.cleanLabel(
      String(Json.valuesAt(field, 'config.unit')[0] ?? ''),
    ),
    cells: Json.valuesAt(frame, `data.values.${fieldIndex}.[]`),
  }))
