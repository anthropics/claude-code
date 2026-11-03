import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'

import { SESSION } from './session.js'
import type { Started, ToastAsked } from './types'

/**
 * A session that starts untouched beneath the plugins, rooted at SESSION's
 * working directory, every toast, transcript line and debug-log line they
 * raise kept for the test to read, on a mock clock the test settles before it
 * reads them.
 *
 * A `$.ui.log` line lands in `lines` when it is bound for the transcript and
 * in `debugLines` when its `to` is `debug`, so a test tells the two apart.
 *
 * @param on the test's `on`
 * @returns the toasts, lines and walks raised, in order, and the clock
 */
export function startedOf(on: On): Started {
  const toasts: ToastAsked[] = []
  const lines: string[] = []
  const debugLines: string[] = []

  on('session.start', ($, e) => ({ cwd: e.cwd }))

  on('session.root', () => ({ value: SESSION.cwd }))

  on('ui.toast', ($, e) => {
    toasts.push(e)

    return { value: undefined }
  })

  on('ui.log', ($, e) => {
    const sink = e.to === 'debug' ? debugLines : lines
    sink.push(e.text)

    return { value: undefined }
  })

  return { toasts, lines, debugLines, walks: [], clock: mock.clock(on) }
}
