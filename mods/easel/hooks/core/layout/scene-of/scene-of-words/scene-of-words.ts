import Charting from '../../../charting'
import type Shapes from '../../../shapes'
import { wrappedTextOf } from '../../wrapped-text-of'
import { sceneFrom } from '../scene-from'

/**
 * The whole scene where a drawing has no room: what a model would read.
 *
 * @param chart what to say in words
 * @param columns the width to wrap to, in cells
 * @returns a scene of text shapes only
 */
export const sceneOfWords = (
  chart: Charting.Chart,
  columns: number,
): Shapes.Scene =>
  sceneFrom(
    columns,
    wrappedTextOf({ columns, rows: 0 }, Charting.modelTextOf(chart), 'words'),
  )
