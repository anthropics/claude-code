import type { MockClock } from 'claude-code/testing'

import type { ToastAsked } from '../toast-asked'

/**
 * What the plugins raised while a session started: each toast as asked for,
 * each transcript line, and the plugin's store as it stands; `clock` settles
 * what the start floated.
 */
export type Started = {
  toasts: ToastAsked[]
  lines: string[]
  store: Map<string, unknown>
  clock: MockClock
}
