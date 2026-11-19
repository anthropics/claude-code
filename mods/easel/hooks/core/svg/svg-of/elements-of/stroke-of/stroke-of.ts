import type Shapes from '../../../../shapes'

/**
 * Paints a stroke of the data. Tests select by `data-series`.
 *
 * @param shape the stroke, whose colour is also its series
 * @returns the `stroke` attribute and what tells the series
 */
export const strokeOf = (shape: Shapes.LineShape): string =>
  `stroke="var(--${shape.ink})" data-series="${shape.ink}"`
