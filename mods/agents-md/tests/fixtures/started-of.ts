import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'

import { SESSION } from './session.js'
import type { Started, ToastAsked } from './types'

/**
 * A session that starts untouched beneath the plugins, rooted at SESSION's
 * working directory, every toast and transcript line they raise kept for the
 * test to read, on a mock clock the test settles before it reads them.
 *
 * @param on the test's `on`
 * @returns the toasts, lines and walks raised, in order, and the clock
 */
export function startedOf(on: On): Started {
  const toasts: ToastAsked[] = []
  const lines: string[] = []

  on('session.start', ($, e) => ({ cwd: e.cwd }))

  on('session.root', () => ({ value: SESSION.cwd }))

  on('ui.toast', ($, e) => {
    toasts.push(e)

    return { value: undefined }
  })

  on('ui.log', ($, e) => {
    lines.push(e.text)

    return { value: undefined }
  })

  return { toasts, lines, walks: [], clock: mock.clock(on) }
}
