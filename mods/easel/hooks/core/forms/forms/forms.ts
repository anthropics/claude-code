import Limits from '../limits'
import type Types from '../types'

/**
 * Every form of chart, with its words and its limits.
 *
 * The description of the tool quotes these limits to the model, and the
 * chart keeps to them.
 */
export const FORMS = {
  line: {
    label: 'line chart',
    plural: 'series',
    defaultCount: Limits.INK_COUNT,
    maxCount: Limits.INK_COUNT,
  },
  columns: {
    label: 'column chart',
    plural: 'series',
    defaultCount: Limits.DEFAULT_COLUMN_SERIES_COUNT,
    maxCount: Limits.MAX_COLUMN_SERIES_COUNT,
  },
  sparks: {
    label: 'sparklines',
    plural: 'series',
    defaultCount: Limits.DEFAULT_SPARK_COUNT,
    maxCount: Limits.MAX_SPARK_COUNT,
  },
  bars: {
    label: 'bar chart',
    plural: 'bars',
    singular: 'bar',
    defaultCount: Limits.DEFAULT_BAR_COUNT,
    maxCount: Limits.MAX_BAR_COUNT,
  },
  share: {
    label: 'share bar',
    plural: 'parts',
    singular: 'part',
    defaultCount: Limits.INK_COUNT,
    maxCount: Limits.INK_COUNT,
  },
} satisfies Record<string, Types.Form>
