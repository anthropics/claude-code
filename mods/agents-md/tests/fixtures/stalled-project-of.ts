import type { On } from 'claude-code'

import { startedOf } from './started-of.js'
import type { Started } from './types'

/**
 * A project whose walks never answer, its session starting untouched
 * (startedOf): what a hook that waited on a walk would hang on.
 *
 * @param on the test's `on`
 * @returns the toasts and lines the plugins raised, and the clock
 */
export function stalledProjectOf(on: On): Started {
  const started = startedOf(on)

  on('fs.ancestors', () => new Promise<never>(() => undefined))

  return started
}
