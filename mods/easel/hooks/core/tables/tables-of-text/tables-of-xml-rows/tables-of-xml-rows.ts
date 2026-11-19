import Casting from '../../../casting'
import Lists from '../../../lists'
import { cellsUnder } from '../../cells-under'
import { namedTable } from '../../named-table'
import Words from '../../words'
import { cutTable } from '../cut-table'
import { isXmlCut } from './is-xml-cut'
import { xmlRecordOf } from './xml-record-of'

/**
 * Rows of named fields, as some query tools answer.
 *
 * Only a text that opens with a tag is read so: a row quoted in prose or under
 * a table is no answer in XML. The text is split at the tags, so that a tag
 * left open costs one pass and no more.
 *
 * @param text a text with its invisible codes taken out
 * @returns the one table or the placeholder of a cut text, or none
 */
export function tablesOfXmlRows(text: string): Casting.Table[] {
  const isXml = text.trimStart().startsWith('<')

  if (!isXml) {
    return []
  }

  const records = text
    .split(Words.XML_ROW_CLOSE)
    .slice(0, -1)
    .filter(chunk => chunk.includes(Words.XML_ROW_OPEN))
    .map(xmlRecordOf)
  const columns = Lists.distinct(records.flatMap(record => [...record.keys()]))
  const isTable =
    columns.length > 0 && !Casting.isTooLarge(columns.length, records.length)

  if (!isTable) {
    return []
  }

  return isXmlCut(text)
    ? [cutTable()]
    : [
        namedTable(
          Words.XML_SOURCE,
          columns,
          records.map(record => cellsUnder(columns, record)),
        ),
      ]
}
