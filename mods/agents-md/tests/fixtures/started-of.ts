import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'

import type { Started, ToastAsked } from './types'

/**
 * A session that starts untouched beneath the plugins, every toast and
 * transcript line they raise kept for the test to read, on a mock clock the
 * test settles or moves before it reads them, over a store holding `stored`
 * that the test reads back as `store`.
 *
 * @param on the test's `on`
 * @param stored what the plugin's store already holds, by key
 * @returns the toasts and lines raised, in order, the store, and the clock
 */
export function startedOf(
  on: On,
  stored: Readonly<Record<string, unknown>> = {},
): Started {
  const toasts: ToastAsked[] = []
  const lines: string[] = []
  const store = new Map<string, unknown>(Object.entries(stored))

  on('session.start', ($, e) => ({ cwd: e.cwd }))

  on('ui.toast', ($, e) => {
    toasts.push(e)

    return { value: undefined }
  })

  on('ui.log', ($, e) => {
    lines.push(e.text)

    return { value: undefined }
  })

  on('store.get', ($, e) => ({ value: store.get(e.key) }))

  on('store.set', ($, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })

  return { toasts, lines, store, clock: mock.clock(on) }
}
