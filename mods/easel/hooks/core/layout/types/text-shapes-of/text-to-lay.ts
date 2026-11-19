import type Shapes from '../../../shapes'

/**
 * What `textShapesOf` takes: the place, the words, their ink.
 */
export type TextToLay = {
  at: Shapes.Point
  text: string
  ink: Shapes.Ink
}
