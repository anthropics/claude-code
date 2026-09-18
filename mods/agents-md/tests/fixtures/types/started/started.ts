import type { MockClock } from 'claude-code/testing'

import type { ToastAsked } from '../toast-asked'

/**
 * What the plugins raised while a session ran: each toast as asked for, each
 * transcript line, the first name of each walk they asked for; `clock`
 * settles what they floated.
 */
export type Started = {
  toasts: ToastAsked[]
  lines: string[]
  walks: string[]
  clock: MockClock
}
