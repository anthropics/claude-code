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
 * trusted.
 *
 * @param rawText the text as it came, with its invisible codes
 * @returns the tables found, or the one placeholder of a cut text
 */
export function tablesOfText(rawText: string): Casting.Table[] {
  const text = rawText
    .replace(Patterns.INVISIBLE_CODES, '')
    .replaceAll('\r\n', '\n')

  const hasCutMark = TRUNCATION_LINE.test(text)

  if (hasCutMark) {
    return [cutTable()]
  }

  const xmlTables = tablesOfXmlRows(text)

  if (xmlTables.length > 0) {
    return Texts.cleanDeep(xmlTables)
  }

  const { values, unparsedLines } = jsonValuesIn(text)

  if (values.length === 0) {
    return Texts.cleanDeep(tablesOfPlainText(text))
  }

  const areRows = isOneTable(values)

  return Texts.cleanDeep(
    (areRows
      ? tablesOfJson(values, tablesOfText, {
          source: Words.JSON_LINES_SOURCE,
        })
      : values.flatMap(value => tablesOfJson(value, tablesOfText))
    ).map(withUnparsedLines(unparsedLines)),
  )
}
