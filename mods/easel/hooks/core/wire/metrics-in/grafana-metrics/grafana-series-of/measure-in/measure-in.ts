import Json from '../../../../../json'
import type Types from '../../../../types'
import { withUnit } from '../../../../with-unit'

/**
 * A number field under the name its series is shown by, its cells in its
 * unit.
 *
 * Queries reuse field names, so a field is named with its query's letter
 * unless the frame is the only one and shows a name for its one number field.
 *
 * @param frame the frame that the fields are of
 * @param isOnlyQuery whether the answer holds one query
 * @param isAloneInFrame whether the frame is the only one, of one number field
 * @returns what names one field and reads its cells
 */
export const measureIn =
  (frame: unknown, isOnlyQuery: boolean, isAloneInFrame: boolean) =>
  (field: Types.GrafanaField): Types.GrafanaField => {
    const shownName =
      field.displayName ?? Json.valuesAt(frame, 'schema.name')[0]
    const isShownNameTaken = isAloneInFrame && Boolean(shownName)
    const nameInQuery = isShownNameTaken
      ? String(shownName)
      : `${field.name} ${Json.valuesAt(frame, 'schema.refId')[0]}`

    return {
      ...field,
      name: isOnlyQuery ? field.name : nameInQuery,
      cells: field.cells.map(cell => withUnit(cell, field.unit)),
    }
  }
