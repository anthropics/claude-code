/**
 * The axis that ticks are laid on: its width, and where an instant sits.
 */
export type TickAxis = {
  /**
   * How many columns the axis is wide.
   */
  columns: number

  /**
   * Where an instant sits on the axis.
   */
  columnOf: (ms: number) => number

  /**
   * True where a label is centred on its tick.
   */
  areCentred: boolean
}
