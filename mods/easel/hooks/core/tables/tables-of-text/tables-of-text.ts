import type Casting from '../../casting'
import Texts from '../../texts'
import Patterns from '../patterns'
import Words from '../words'
import { cutTable } from './cut-table'
import { isOneTable } from './is-one-table'
import { jsonValuesIn } from './json-values-in'
import { tablesOfJson } from './tables-of-json'
import { tablesOfPlainText } from './tables-of-plain-text'
import { tablesOfXmlRows } from './tables-of-xml-rows'
import { TRUNCATION_LINE } from './truncation-line'
import { withUnparsedLines } from './with-unparsed-lines'

/**
 * Finds every table in a text: in rows of XML, in JSON, or in lines that a
 * delimiter splits into cells.
 *
 * It is the first stage of the pipeline, and the reading of roles takes its
 * tables. A cut text gives one placeholder, `isCut`: its rows cannot be
 * trusted. Only JSON says that it is a series.
 *
 * @param rawText the text as it came, with its invisible codes
 * @param needsSeries whether tables with no series among them, the
 * placeholder of a cut part included, count as none and stay uncleaned
 * @returns the tables found, or the one placeholder of a cut text
 */
export function tablesOfText(
  rawText: string,
  needsSeries = false,
): Casting.Table[] {
  const text = rawText
    .replace(Patterns.INVISIBLE_CODES, '')
    .replaceAll('\r\n', '\n')

  const hasCutMark = TRUNCATION_LINE.test(text)

  if (hasCutMark) {
    return [cutTable()]
  }

  const xmlTables = tablesOfXmlRows(text)

  if (xmlTables.length > 0) {
    return needsSeries ? [] : Texts.cleanDeep(xmlTables)
  }

  const { values, unparsedLines } = jsonValuesIn(text)

  if (values.length === 0) {
    return needsSeries ? [] : Texts.cleanDeep(tablesOfPlainText(text))
  }

  const areRows = isOneTable(values)
  // A text inside is read whole: its table may stand beside a series.
  const tables = areRows
    ? tablesOfJson(values, tablesOfText, { source: Words.JSON_LINES_SOURCE })
    : values.flatMap(value => tablesOfJson(value, tablesOfText))
  const isUnwanted = needsSeries && !tables.some(table => table.isSeries)

  return isUnwanted
    ? []
    : Texts.cleanDeep(tables.map(withUnparsedLines(unparsedLines)))
}
