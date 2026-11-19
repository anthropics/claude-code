import type Charting from '../../../charting'
import type Shapes from '../../../shapes'
import Texts from '../../../texts'
import type Types from '../../types'
import { wrappedTextOf } from '../../wrapped-text-of'
import { joinedTextShapesOf } from './joined-text-shapes-of'
import { separatorWidth } from './separator-width'

/**
 * Lays the title on the first row and each fact beside the last where it
 * fits, under it where it does not.
 *
 * @param room the width to fill and the row of the title
 * @param header the title and the facts
 * @returns the shapes, the row under them and every text that they show
 */
export function headerOf(
  room: Types.Room,
  header: Charting.Header,
): Types.LaidHeader {
  const texts = [header.title, ...header.facts].filter(text => text !== '')
  const shapes: Shapes.Shape[] = []
  let rows = room.rows
  let usedWidth = 0

  for (const [index, text] of texts.entries()) {
    const widthIfJoined = usedWidth + separatorWidth() + Texts.widthOf(text)
    const isOnOwnRow = index === 0 || widthIfJoined > room.columns

    if (isOnOwnRow) {
      const laid = wrappedTextOf(
        { columns: room.columns, rows },
        [text],
        index === 0 ? 'title' : 'quiet',
      )
      shapes.push(...laid.shapes)
      rows = laid.rows
      usedWidth = Texts.widthOf(text)
    } else {
      shapes.push(...joinedTextShapesOf(rows, usedWidth, text))
      usedWidth = widthIfJoined
    }
  }

  return { shapes, rows, texts }
}
