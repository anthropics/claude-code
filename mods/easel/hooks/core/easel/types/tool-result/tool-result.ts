/**
 * What a tool answered, kept with the id it is named by.
 */
export type ToolResult = {
  /**
   * What the call that was answered is named by.
   */
  id: string

  /**
   * Which of the tools gave the answer.
   */
  tool: string

  /**
   * What was answered: as the host stored it, or as the model read it
   * where nothing was stored.
   */
  text: string
}
