import CoreCall from '../../core/call'

/**
 * It becomes a hidden system reminder, unescaped: no text from data.
 *
 * @param context what the answer already tells the model, if anything
 * @returns the same, with the note of an automatic chart last
 */
export const withChartNote = (
  context: readonly string[] | undefined,
): string[] => [...(context ?? []), CoreCall.AUTO_CHART_NOTE]
