import type Charting from '../../../charting'
import Lists from '../../../lists'
import Limits from '../../limits'
import { maxWidthOf } from '../../max-width-of'
import Records from '../../records'
import type Types from '../../types'
import { statCountOf } from './stat-count-of'

/**
 * Stands every stat's parts side by side, each as wide as its widest text.
 *
 * Each stat adds a `COLUMN_GAP` before itself and each part a `WORD_GAP`,
 * which the first of each must not have.
 *
 * @param rows the rows whose stats take the columns
 * @returns where each part of each stat starts, and where each stat ends
 */
export function statColumnsOf(rows: Charting.LegendRow[]): Types.StatColumn[] {
  const statColumns: Types.StatColumn[] = []
  let end = -Limits.COLUMN_GAP

  for (const statIndex of Lists.indexesBelow(statCountOf(rows))) {
    end += Limits.COLUMN_GAP - Limits.WORD_GAP
    const parts: Types.StatColumn['parts'] = []

    for (const partIndex of Records.STAT_PART_INDEXES) {
      const width = maxWidthOf(
        rows.map(row => row.stats[statIndex]?.[partIndex] ?? ''),
      )
      end += width > 0 ? Limits.WORD_GAP + width : 0
      parts.push({ start: end - width, width })
    }

    statColumns.push({ parts, end })
  }

  return statColumns
}
