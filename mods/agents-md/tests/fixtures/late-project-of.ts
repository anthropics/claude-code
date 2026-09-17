import type { FsAncestor, On } from 'claude-code'

import { LATE_MS } from './late-ms.js'
import { startedOf } from './started-of.js'
import type { Started } from './types'

/**
 * A project whose walks answer only once the clock has moved LATE_MS: the
 * AGENTS.md walk with the given files, the CLAUDE.md walk with none.
 *
 * @param on the test's `on`
 * @param agents what the walk for AGENTS.md and .claude/AGENTS.md finds, late
 * @returns the toasts and lines the plugins raised, and the clock to move
 */
export function lateProjectOf(on: On, agents: readonly FsAncestor[]): Started {
  const started = startedOf(on)

  on('fs.ancestors', async ($, e) => {
    await started.clock.sleep(LATE_MS)

    return { value: e.names.includes('AGENTS.md') ? agents : [] }
  })

  return started
}
