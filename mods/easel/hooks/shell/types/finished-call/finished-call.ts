/**
 * A call that has its answer, as the transcript holds it.
 */
export type FinishedCall = {
  /**
   * What the call is named by.
   */
  id: string

  /**
   * The name of the tool that was called.
   */
  tool: string

  /**
   * Of the stored result or, where that holds no text or a hook rewrote it
   * since, what the model read.
   */
  text: string

  /**
   * What the model read.
   */
  readText: string

  /**
   * What the tool was called with.
   */
  input: unknown

  /**
   * The result as the host stored it, which can hold more than the text.
   */
  storedResult: unknown
}
