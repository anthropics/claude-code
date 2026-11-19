import Lists from '../../../lists'
import Patterns from '../../patterns'
import type Types from '../../types'
import { bracketedBlockOf } from './bracketed-block-of'
import { parsedJson } from './parsed-json'

/**
 * Reads JSON from the whole, then from one block, then line by line.
 *
 * The block runs from the first lone bracket to the last: pretty-printed
 * JSON in prose.
 *
 * @param text the text, with no invisible codes
 * @returns the values found, and how many record lines do not parse
 */
export function jsonValuesIn(text: string): Types.JsonValues {
  const wholeText = parsedJson(text)

  if (wholeText !== undefined) {
    return { values: [wholeText], unparsedLines: 0 }
  }

  const lines = text.split('\n')
  const blockValue = parsedJson(bracketedBlockOf(lines).join('\n'))

  if (blockValue !== undefined) {
    return { values: [blockValue], unparsedLines: 0 }
  }

  const jsonLines = lines.filter(line => Patterns.JSON_LINE.test(line))
  const parsedLines = jsonLines.map(line => parsedJson(line))

  return {
    values: parsedLines.filter(value => value !== undefined),
    unparsedLines: Lists.countOf(
      Lists.zip(jsonLines, parsedLines),
      ([line, value]) => value === undefined && Patterns.RECORD_LINE.test(line),
    ),
  }
}
