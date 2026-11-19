import type Types from '../../../types'

/**
 * Shapes a chart of one small line for each series.
 *
 * @param frame the words around the drawing
 * @param rows one small line for each series
 * @param medianStep the median distance between two samples, as a position
 * @returns the chart of small lines
 */
export const sparksChartIn = (
  frame: Types.Frame,
  rows: Types.Plot['rows'],
  medianStep: number,
): Types.SparksChart => ({
  form: 'sparks',
  header: frame.header,
  rows,
  medianStep,
  notes: frame.notes,
})
