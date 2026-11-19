/**
 * Where the labels of instants are read and stand, and what precedes them.
 */
export type Labelling = {
  /**
   * The IANA name of where the calendar is read.
   */
  zone: string

  /**
   * On an axis, where a date alone means its midnight.
   */
  areTicks: boolean

  /**
   * What the reader already knows before the first label.
   */
  fieldsBefore: readonly number[]
}
