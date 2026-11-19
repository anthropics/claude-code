import type Types from '../../types'

/**
 * A chart over time also holds notes that are written for the model alone.
 *
 * @param chart the chart to put in words
 * @returns the notes the model reads, those drawn first
 */
export const modelNotesOf = (chart: Types.Chart): string[] =>
  'plots' in chart ? [...chart.notes, ...chart.modelOnlyNotes] : chart.notes
