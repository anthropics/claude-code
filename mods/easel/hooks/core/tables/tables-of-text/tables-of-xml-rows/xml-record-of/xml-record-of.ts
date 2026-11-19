import type Cells from '../../../../cells'
import Words from '../../../words'
import { xmlFieldsOf } from './xml-fields-of'

/**
 * The fields of the last row that a chunk opens.
 *
 * @param chunk the text up to the tag that closes a row
 * @returns the cell of each field, by its name
 */
export function xmlRecordOf(chunk: string): Map<string, Cells.Cell> {
  const row = chunk.slice(chunk.lastIndexOf(Words.XML_ROW_OPEN))

  return new Map(row.split(Words.XML_FIELD_OPEN).slice(1).flatMap(xmlFieldsOf))
}
