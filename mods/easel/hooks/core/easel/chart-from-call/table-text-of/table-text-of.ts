import Json from '../../../json'
import Patterns from '../../patterns'

/**
 * Cleaning keeps only the first line of a text, so a table that is passed as
 * a text is taken from the raw input. The reader cleans every cell itself.
 *
 * @param uncleaned The tool's input as it came.
 * @returns The text under data where it is a table, else undefined.
 */
export function tableTextOf(uncleaned: unknown): string | undefined {
  const rawData = Json.isRecord(uncleaned) ? uncleaned.data : undefined
  const isTable =
    typeof rawData === 'string' && Patterns.TABLE_TEXT.test(rawData.trim())

  return isTable ? rawData : undefined
}
