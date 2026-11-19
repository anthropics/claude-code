import type CoreCall from '../../call'
import Casting from '../../casting'
import Tables from '../../tables'
import Texts from '../../texts'
import Limits from '../limits'
import Patterns from '../patterns'
import { readFailure } from '../read-failure'
import type Types from '../types'
import Words from '../words'
import { candidateTables } from './candidate-tables'
import { dataOf } from './data-of'
import { holdsOnlyWords } from './holds-only-words'

/**
 * Turns a tool result and a chart call into the series to draw. After the
 * call is checked, only this stage can refuse: later ones draw its answer.
 *
 * A call that names no column, as for an unasked chart, picks no table. Then
 * the result must hold one table that can be read in only one way.
 *
 * @param text what the result holds, as characters
 * @param request the chart that was asked for
 * @param clock the zone and the time of the call
 * @returns the series and their timeline, or the refusal
 */
export function readData(
  text: string,
  request: CoreCall.ChartRequest,
  clock: Types.CallClock,
): Types.Data | Types.ReadFailure {
  const isTooLong = text.length >= Limits.MAX_INPUT_CHARS

  if (isTooLong) {
    return readFailure({
      code: 'too_long',
      why:
        `The data is 64 KiB or longer: too long to chart, and it may be ` +
        `cut short. ${Words.ASK_FOR_LESS}`,
    })
  }

  const tables = Tables.tablesOfText(text)
  const hasCutTable = tables.some(table => table.isCut)

  if (hasCutTable) {
    return readFailure({
      code: 'cut_short',
      why:
        `That result was cut short or saved to a file, so part of it is ` +
        `missing. ${Words.ASK_FOR_LESS}`,
    })
  }

  const hasTable = tables.length > 0

  if (!hasTable) {
    const isUnclosedJson =
      Patterns.OPENS_AS_JSON.test(text) && !Patterns.CLOSES_AS_JSON.test(text)

    return readFailure(
      isUnclosedJson
        ? {
            code: 'cut_short',
            why:
              `That result is JSON that does not close, so it was cut ` +
              `short. ${Words.ASK_FOR_LESS}`,
          }
        : {
            code: 'no_table_read',
            why:
              `That result holds no rows: it has no table and no list of ` +
              `records of ${Casting.MAX_COLUMNS} columns or fewer. Pass the ` +
              `rows as data, as JSON records or as the text of a CSV, TSV ` +
              `or markdown table, with only the columns to chart`,
          },
    )
  }

  const [table, ...otherCandidates] = candidateTables(tables, request)
  const isPickUnclear = table === undefined || otherCandidates.length > 0

  if (isPickUnclear) {
    return readFailure(
      {
        code: 'table_unpicked',
        why:
          `That result is not a table: there are ${tables.length} in it. ` +
          `To pick one, name a column that only it has, or pass its rows ` +
          `as data`,
      },
      tables.slice(0, Limits.MAX_TABLES_SUMMARIZED),
    )
  }

  const data = dataOf(table, request, clock)
  const unparsedLines = table.unparsedLines ?? 0
  const otherTables = tables.filter(
    other => other !== table && !holdsOnlyWords(other),
  )
  const hasOtherTables = otherTables.length > 0
  const hasLooseLines = unparsedLines > 0
  const leftOut = [
    ...(hasOtherTables
      ? [Texts.counted(otherTables.length, 'other table')]
      : []),
    ...(hasLooseLines
      ? [`${Texts.counted(unparsedLines, 'line')} outside any table`]
      : []),
  ]
  const isAllThereIs = data.kind === 'refused' || leftOut.length === 0

  return isAllThereIs
    ? data
    : {
        ...data,
        leftOutNotes: [
          ...data.leftOutNotes,
          `only part of that result is charted: it also holds ` +
            leftOut.join(' and '),
        ],
      }
}
