/**
 * How the bars are to be read.
 */
export type BarRowsOptions = {
  /**
   * Whether the bars are parts of a whole.
   */
  isSummed: boolean

  /**
   * The columns that the bars of the whole chart measure, drawn or not.
   */
  measures: string[]
}
