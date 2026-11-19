import type { FORMS } from '../../forms'
import type { RefusalCode } from '../../refusal'
import type Records from '../records'

/**
 * What telemetry is told of one chart or refusal: no text of the data.
 *
 * Every word is one that this plugin spells itself. Three numbers depend on
 * the data, two counts and a time, and are rounded.
 */
export type Usage = {
  /**
   * That a chart was drawn, or the code of the refusal.
   */
  outcome: 'drawn' | RefusalCode

  /**
   * Which form was drawn. Of a refusal, the form asked for.
   */
  form: keyof typeof FORMS | 'unnamed'

  /**
   * Whether the model named a form.
   */
  isFormNamed: boolean

  /**
   * From `formatOf` alone.
   */
  format: string

  /**
   * Where the text of the data was found.
   */
  dataFrom: (typeof Records.DATA_FROM)[number]

  /**
   * How many series are in the chart; none of a refusal.
   */
  seriesCount: number

  /**
   * How many samples hold a value; none of a refusal.
   */
  pointCount: number

  /**
   * Whether a note says that part of the data is not in the chart.
   */
  hasLeftOut: boolean

  /**
   * Whether bars were drawn in place of a form over time.
   */
  isFormReplaced: boolean
}
