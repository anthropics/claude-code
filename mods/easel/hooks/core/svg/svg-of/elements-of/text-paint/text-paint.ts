import type Shapes from '../../../../shapes'

/**
 * The colour of a line of words. A title is written in bold as well.
 *
 * @param shape the line of words, which names its colour
 * @returns the `fill` attribute, and the weight where there is one
 */
export const textPaint = (shape: Shapes.TextShape): string =>
  `fill="var(--${shape.ink})"` +
  (shape.ink === 'title' ? ' font-weight="600"' : '')
