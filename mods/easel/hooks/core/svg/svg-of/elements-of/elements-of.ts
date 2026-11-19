import Lists from '../../../lists'
import type Shapes from '../../../shapes'
import { dataFill } from '../../data-fill'
import { isVisible } from '../../is-visible'
import { axisLine } from './axis-line'
import { bandPartRect } from './band-part-rect'
import { barRect } from './bar-rect'
import { escapedText } from './escaped-text'
import { gridLine } from './grid-line'
import { hatchOf } from './hatch-of'
import { linePoints } from './line-points'
import { rectElement } from './rect-element'
import { stackPartRect } from './stack-part-rect'
import { stripPoints } from './strip-points'
import { strokeOf } from './stroke-of'
import { textLengthOf } from './text-length-of'
import { textPaint } from './text-paint'
import { textPlace } from './text-place'

/**
 * Paints one thing of the drawing, as its kind asks.
 *
 * @param shape what to paint, placed and sized in cells
 * @returns its SVG elements, with no line break between them
 */
export function elementsOf(shape: Shapes.Shape): string {
  switch (shape.kind) {
    case 'text': {
      return (
        `<text ${textPlace(shape)} ${textLengthOf(shape)} ` +
        `${textPaint(shape)}>${escapedText(shape)}</text>`
      )
    }
    case 'bar': {
      return rectElement(barRect(shape), hatchOf(shape))
    }
    case 'stack': {
      return Lists.laidEndToEnd(shape.parts, part => -part.height, shape.at.y)
        .filter(laid => isVisible(laid.part))
        .map(laid => rectElement(stackPartRect(shape, laid)))
        .join('')
    }
    case 'axisRow': {
      const axis = axisLine(shape)

      return shape.gridWidth > 0 ? `${axis}${gridLine(shape)}` : axis
    }
    case 'strip': {
      return `<polygon points="${stripPoints(shape)}" ${dataFill(shape.ink)}/>`
    }
    case 'band': {
      return Lists.laidEndToEnd(shape.parts, part => part.width, shape.at.x)
        .map(laid => rectElement(bandPartRect(shape, laid)))
        .join('')
    }
    case 'line': {
      return `<polyline points="${linePoints(shape)}" ${strokeOf(shape)}/>`
    }
  }
}
