import type Easel from '../../../core/easel'
import type { FinishedCall } from '../finished-call'

/**
 * What the hooks keep of the session's calls from one draw to the next.
 */
export type ChartCache = {
  /**
   * What each finished call draws, under the id of the call.
   */
  charts: Map<string, Easel.Outcome>

  /**
   * The ids of the finished calls that draw nothing.
   */
  chartlessIds: Set<string>

  /**
   * The time and query of each automatic chart's call, under the call's id.
   */
  autoChartCalls: Map<string, Easel.ResultCall>

  /**
   * The tool of each call made since the hooks were loaded that may hold a
   * chart, under the call's id.
   */
  calledTools: Map<string, string>

  /**
   * The same of the calls before those, once a row under a label needs one.
   */
  earlierTools?: Promise<Map<string, string>>

  /**
   * Whether a screen reader is on, once the variable and the settings were
   * read for it: `unread` until the first chart on a terminal.
   */
  screenReader: 'unread' | 'on' | 'off'

  /**
   * A read of the main transcript, which many rows share till a tool answers.
   */
  transcript?: Promise<FinishedCall[]>
}
