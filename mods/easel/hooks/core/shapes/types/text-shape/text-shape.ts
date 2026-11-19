import type { Ink } from '../ink'
import type { Point } from '../point'

/**
 * One line of words, written from its first cell in one ink.
 */
export type TextShape = {
  kind: 'text'
  at: Point
  text: string
  ink: Ink

  /**
   * Only a painter knows if it left one out. Such texts are the last rows.
   */
  isAboutPartsLeftOut: boolean
}
