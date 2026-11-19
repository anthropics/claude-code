import Json from '../../../../json'

/**
 * A column of a record of lists is a list of plain values, as long as the
 * first one.
 *
 * @param rowCount the length of the record's first list
 * @returns the test of one value of the record
 */
export const isColumnOf =
  (rowCount: number) =>
  (list: unknown): list is unknown[] =>
    Array.isArray(list) && list.length === rowCount && !list.some(Json.isRecord)
