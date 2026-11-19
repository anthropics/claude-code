import type Charting from '../../charting'
import type Shapes from '../../shapes'
import Limits from '../limits'
import { wrappedTextOf } from '../wrapped-text-of'
import { bodyOf } from './body-of'
import { headerOf } from './header-of'
import { sceneFrom } from './scene-from'
import { sceneOfWords } from './scene-of-words'
import { thinPartsNoteOf } from './thin-parts-note-of'

/**
 * Lays out one scene for every surface. Each part is put under the last, and
 * the parts are joined in the order to paint them.
 *
 * It places the words that it is handed and makes no words but the time
 * ticks. A size or an x is in cells, a y in rows. A position is a share, from
 * 0 to 1.
 *
 * @param chart what to draw, with every word already made
 * @param columns the width to fill, in cells
 * @returns the shapes and their size, or only words where the width is small
 */
export function sceneOf(chart: Charting.Chart, columns: number): Shapes.Scene {
  if (columns < Limits.MIN_CHART_COLUMNS) {
    return sceneOfWords(chart, columns)
  }

  const header = headerOf({ columns, rows: 0 }, chart.header)
  const body = bodyOf(chart, { columns, rows: header.rows }, header.texts)

  if (body === undefined) {
    return sceneOfWords(chart, columns)
  }

  const notes = wrappedTextOf(
    { columns, rows: body.rows },
    [...chart.notes, ...body.notes],
    'quiet',
  )
  const isOfColumns = chart.form === 'columns'
  const thinPartsNote = isOfColumns
    ? thinPartsNoteOf({ columns, rows: notes.rows }, chart.thinPartsNote)
    : { shapes: [], rows: notes.rows }

  return sceneFrom(columns, {
    shapes: [
      ...header.shapes,
      ...body.shapes,
      ...notes.shapes,
      ...thinPartsNote.shapes,
    ],
    rows: thinPartsNote.rows,
  })
}
