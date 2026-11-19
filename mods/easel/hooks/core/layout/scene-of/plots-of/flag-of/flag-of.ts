import type Charting from '../../../../charting'
import Texts from '../../../../texts'
import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * Makes the flag of a mark: where its line stands and its label, cut in
 * the middle to the width that a flag may take.
 *
 * @param area the cells of the series, which give a position in time its x
 * @returns the way from a mark to its flag
 */
export const flagOf =
  (area: Types.PlotArea) =>
  (mark: Charting.Mark): Types.Flag => ({
    x: area.tickXOf(mark.position),
    text: Texts.truncateMiddle(mark.label, Limits.MAX_FLAG_WIDTH),
  })
