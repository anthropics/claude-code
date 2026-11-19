import Limits from '../../limits'
import type Types from '../../types'

/**
 * Gathers what holds for a legend whichever of its stats are shown.
 *
 * A name that the header shows is not repeated: no name is kept, and a blank
 * stands in, as far as the left of the plot.
 *
 * @param needs the rows, the width, their lane, the header's texts, the left
 * @returns the rows, their lane, their names and the widths that stay
 */
export function legendBasisOf(needs: Types.LegendNeeds): Types.LegendBasis {
  const onlyRow = needs.rows.length === 1 ? needs.rows[0] : undefined
  const isNamedInHeader =
    onlyRow !== undefined && needs.headerTexts.includes(onlyRow.name)
  const hasKeys = needs.rows.some(row => row.key)
  const keyWidth = hasKeys ? Limits.KEY_WIDTH : 0

  return {
    rows: needs.rows,
    lane: needs.lane,
    fullNames: isNamedInHeader ? [] : needs.rows.map(row => row.name),
    isNamedInHeader,
    indent: Math.max(0, needs.left - Limits.COLUMN_GAP),
    keyWidth,
    widthPastKey: needs.columns - keyWidth - Limits.COLUMN_GAP,
  }
}
