import type { Choice } from '../choice'

/**
 * The entries of the event of one chart or refusal.
 */
export type ChartLogProps = {
  /**
   * That a chart was drawn, or the code of the refusal.
   */
  outcome: Choice

  /**
   * Which form was drawn, or of a refusal the form asked for.
   */
  form: Choice

  /**
   * What the data was read from, as one word.
   */
  format: Choice

  /**
   * Where the text of the data was found.
   */
  data_from: Choice

  /**
   * How many series, rounded.
   */
  series_bucket: number

  /**
   * How many samples hold a value, rounded.
   */
  point_bucket: number

  /**
   * The time to read the data and lay it out, rounded.
   */
  elapsed_ms_bucket: number

  /**
   * Whether the model named a form.
   */
  is_form_named: boolean

  /**
   * Whether a note says that part of the data is not drawn.
   */
  has_left_out: boolean

  /**
   * Whether bars were drawn in place of a form over time.
   */
  is_form_replaced: boolean

  /**
   * Whether the model asked for the chart.
   */
  is_asked: boolean

  /**
   * Whether a subagent made the call.
   */
  is_in_subagent: boolean

  /**
   * Whether a terminal watches the session.
   */
  is_on_terminal: boolean

  /**
   * Whether a surface other than a terminal watches it.
   */
  is_on_app: boolean
}
