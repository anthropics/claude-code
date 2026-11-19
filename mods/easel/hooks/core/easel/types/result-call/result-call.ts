/**
 * What the host knows of the call whose answer is read unasked.
 */
export type ResultCall = {
  /**
   * When the answer came. Null on a redraw that no longer knows.
   */
  nowMs: number | null

  /**
   * What the call asked its service for, in the words of the call. Empty
   * where it has no such field.
   */
  query: string
}
