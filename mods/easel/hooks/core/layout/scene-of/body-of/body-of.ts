import type Charting from '../../../charting'
import Limits from '../../limits'
import type Types from '../../types'
import { barsOf } from '../bars-of'
import { plotsLayoutOf } from '../plots-layout-of'
import { plotsOf } from '../plots-of'
import { shareOf } from '../share-of'
import { sparksOf } from '../sparks-of'

/**
 * Lays what a chart draws under its header, by its form.
 *
 * @param chart what to draw, with every word already made
 * @param room the width to fill and the first row under the header
 * @param headerTexts the texts that the header shows
 * @returns what was laid and the notes of the plots, or nothing where plots
 *   have no room
 */
export function bodyOf(
  chart: Charting.Chart,
  room: Types.Room,
  headerTexts: string[],
): Types.LaidPlots | undefined {
  switch (chart.form) {
    case 'bars':
      return { ...barsOf(room, chart.rows, headerTexts), notes: [] }
    case 'share':
      return { ...shareOf(room, chart.rows), notes: [] }
    case 'sparks':
      return { ...sparksOf(room, chart, headerTexts), notes: [] }
    case 'line':
    case 'columns': {
      const plotsLayout = plotsLayoutOf(chart, room.columns)
      const hasRoom = plotsLayout.area.width >= Limits.MIN_PLOT_WIDTH

      return hasRoom
        ? plotsOf({ room, chart, plotsLayout, headerTexts })
        : undefined
    }
  }
}
