/**
 * The result of a call as it is to be charted.
 */
export type ShownResult = {
  /**
   * The id of the call.
   */
  id: string

  /**
   * The query that names a series with no label.
   */
  query: string

  /**
   * The text to read, of its row or of the transcript.
   */
  text: string
}
