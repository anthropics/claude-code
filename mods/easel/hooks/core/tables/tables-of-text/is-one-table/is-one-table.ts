import Json from '../../../json'
import Lists from '../../../lists'

/**
 * Several records with the same keys in one order are the rows of one table.
 *
 * @param values the JSON values found in a text
 * @returns whether they are such records, and more than one
 */
export const isOneTable = (values: unknown[]): boolean =>
  values.length > 1 &&
  values.every(Json.isRecord) &&
  Lists.distinct(values.map(record => Object.keys(record).join())).length === 1
