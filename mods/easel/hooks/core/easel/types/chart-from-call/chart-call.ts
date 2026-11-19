import type { ToolResult } from '../tool-result'

/**
 * What the asked-for entry point is handed: the tool's input, what the other
 * tools have answered, and the clock of the session.
 */
export type ChartCall = {
  /**
   * What the model wrote for the tool, not yet checked.
   */
  input: unknown

  /**
   * The finished calls of the conversation before this one, oldest first.
   * The chart tool's own answers among them are passed over.
   */
  results: ToolResult[]

  /**
   * The IANA name of where the reader's clock is.
   */
  zone: string

  /**
   * A redraw passes the time of the call again, or null if it was lost.
   */
  nowMs: number | null
}
