/**
 * One mark of a value axis and what is written beside it.
 */
export type Tick = {
  /**
   * 0 at the low end of the axis and 1 at the high end.
   */
  position: number

  label: string
}
