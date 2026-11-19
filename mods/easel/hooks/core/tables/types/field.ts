/**
 * A span of positions in aligned lines.
 */
export type Field = {
  from: number

  /**
   * The position after the last.
   */
  until: number
}
