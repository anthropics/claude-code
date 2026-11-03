import type { MockClock } from 'claude-code/testing'

import type { ToastAsked } from '../toast-asked'

/**
 * What the plugins raised while a session ran: each toast as asked for, each
 * transcript line, each line sent to the debug log alone, the first name of
 * each walk they asked for; `clock` settles what they floated.
 */
export type Started = {
  toasts: ToastAsked[]
  lines: string[]
  debugLines: string[]
  walks: string[]
  clock: MockClock
}
