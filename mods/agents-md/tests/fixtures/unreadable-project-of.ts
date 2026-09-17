import type { On } from 'claude-code'

import { startedOf } from './started-of.js'
import type { Started } from './types'

/**
 * A project whose walk fails, its session starting untouched (startedOf).
 *
 * @param on the test's `on`
 * @returns the toasts and lines the plugins raised, in order
 */
export function unreadableProjectOf(on: On): Started {
  const started = startedOf(on)

  on('fs.ancestors', () => {
    throw new Error('no walk today')
  })

  return started
}
