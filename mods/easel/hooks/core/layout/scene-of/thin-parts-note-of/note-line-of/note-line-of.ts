import type Shapes from '../../../../shapes'

/**
 * One line of the note about thin parts, marked so that a painter that
 * leaves no part out can tell it from the chart's own words.
 *
 * @param text the words of the line
 * @param row the row to put the line on
 * @returns the line, as a shape
 */
export const noteLineOf = (text: string, row: number): Shapes.Shape => ({
  kind: 'text',
  at: { x: 0, y: row },
  text,
  ink: 'quiet',
  isAboutPartsLeftOut: true,
})
