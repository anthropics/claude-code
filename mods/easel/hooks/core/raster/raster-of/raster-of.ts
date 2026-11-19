import type Shapes from '../../shapes'
import { cellOfSpans } from '../cell-of-spans'
import { GRID_CELL } from '../grid-cell'
import Limits from '../limits'
import Records from '../records'
import { spansOf } from '../spans-of'
import type Types from '../types'
import { axisGlyphOf } from './axis-glyph-of'
import { canvasOf } from './canvas-of'
import { isStackPainted } from './is-stack-painted'
import { paintBar } from './paint-bar'
import { paintLine } from './paint-line'
import { paintText } from './paint-text'
import { runsOf } from './runs-of'
import { stripGlyphOf } from './strip-glyph-of'

/**
 * The terminal painter: turns the laid-out shapes into rows of coloured
 * text.
 *
 * A later shape overwrites an earlier one, but a line is painted only in
 * cells that are blank, hold the grid or hold another line.
 *
 * @param scene the shapes to paint and the size to paint them in
 * @returns the runs of each row, the top row first
 */
export function rasterOf(scene: Shapes.Scene): Types.Run[][] {
  const canvas = canvasOf(scene)
  let hasLeftAPartOut = false
  let unusedRowCount = 0

  for (const shape of scene.shapes) {
    switch (shape.kind) {
      case 'text': {
        const isUnusedNote = shape.isAboutPartsLeftOut && !hasLeftAPartOut

        isUnusedNote ? (unusedRowCount += 1) : paintText(canvas, shape)

        break
      }
      case 'bar':
        paintBar(canvas, shape)
        break
      case 'stack':
        hasLeftAPartOut = !isStackPainted(canvas, shape) || hasLeftAPartOut
        break
      case 'line':
        paintLine(canvas, shape)
        break
      case 'strip': {
        const { at, heights, ink } = shape

        heights.forEach((height, offset) => {
          if (height !== null) {
            canvas.set(
              { x: at.x + offset, y: at.y },
              { glyph: stripGlyphOf(height), ink },
            )
          }
        })

        break
      }
      case 'band': {
        const { at, rows, parts } = shape
        const spans = spansOf(parts, part => part.width, 0)

        for (
          let start = 0;
          start < (spans.at(-1)?.to ?? 0);
          start += Limits.EIGHTHS_PER_CELL
        ) {
          const cell = cellOfSpans(spans, start, Records.LEFT_BLOCKS)

          for (let row = 0; cell !== undefined && row < rows; row++) {
            canvas.set(
              { x: at.x + start / Limits.EIGHTHS_PER_CELL, y: at.y + row },
              cell,
            )
          }
        }

        break
      }
      case 'axisRow': {
        const { at, gridWidth } = shape
        canvas.set(at, { glyph: axisGlyphOf(gridWidth), ink: 'quiet' })

        for (let offset = 1; offset < gridWidth; offset++) {
          canvas.set({ x: at.x + offset, y: at.y }, GRID_CELL)
        }

        break
      }
    }
  }

  return canvas
    .rows()
    .slice(0, scene.rows - unusedRowCount)
    .map(runsOf)
}
