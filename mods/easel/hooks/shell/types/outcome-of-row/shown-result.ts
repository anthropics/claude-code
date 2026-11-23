/**
 * The result of a call as the conversation holds it.
 */
export type ShownResult = {
  /**
   * The id of the call.
   */
  id: string

  /**
   * What the call was asked.
   */
  input: unknown

  /**
   * The text of its row, or of the transcript where the row is cut.
   */
  text: string
}
