import type Shapes from '../../shapes'
import { isVisible } from '../is-visible'
import Limits from '../limits'
import Words from '../words'
import { elementsOf } from './elements-of'
import { FIXED_CSS } from './fixed-css'
import { paletteCss } from './palette-css'

/**
 * The image painter: turns what was laid out into one SVG document.
 *
 * A text about parts left out is dropped, with its row, where no stack
 * left a part out.
 *
 * @param scene the shapes laid out, and the size of their grid in cells
 * @returns the document, one shape to a line
 */
export function svgOf(scene: Shapes.Scene): string {
  const hasLeftAPartOut = scene.shapes.some(
    shape => shape.kind === 'stack' && !shape.parts.every(isVisible),
  )
  const shapes = hasLeftAPartOut
    ? scene.shapes
    : scene.shapes.filter(
        shape => !(shape.kind === 'text' && shape.isAboutPartsLeftOut),
      )
  const width = scene.columns * Limits.CELL_WIDTH
  const height =
    (scene.rows - (scene.shapes.length - shapes.length)) * Limits.CELL_HEIGHT

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}">`,
    `<style>svg{${paletteCss('light')}}` +
      `${Words.IF_DARK}{svg{${paletteCss('dark')}}}`,
    `${FIXED_CSS}</style>`,
    ...shapes.map(elementsOf),
    `</svg>`,
  ].join('\n')
}
