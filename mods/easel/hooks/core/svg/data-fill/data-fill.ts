import type Shapes from '../../shapes'

/**
 * Paints a mark of the data. Tests select by `data-series`.
 *
 * @param ink the colour, which is also the series of the mark
 * @param attributes more to write, each starting with a space
 * @returns the fill and what tells the series
 */
export const dataFill = (ink: Shapes.Ink, attributes = ''): string =>
  `fill="var(--${ink})"${attributes} data-series="${ink}"`
