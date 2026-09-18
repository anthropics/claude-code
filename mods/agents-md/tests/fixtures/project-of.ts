import type { FsAncestor, On } from 'claude-code'

import { startedOf } from './started-of.js'
import type { Started } from './types'

/**
 * A project whose walks up from the working directory find the given files,
 * one list per set of names, its session starting untouched (startedOf);
 * each walk's first name is kept in `walks`.
 *
 * @param on the test's `on`
 * @param agents what a walk for AGENTS.md and .claude/AGENTS.md finds
 * @param claude what a walk for CLAUDE.md, .claude/CLAUDE.md and
 * CLAUDE.local.md finds
 * @returns the toasts, lines and walks the plugins raised, in order
 */
export function projectOf(
  on: On,
  agents: readonly FsAncestor[],
  claude: readonly FsAncestor[],
): Started {
  const started = startedOf(on)

  on('fs.ancestors', ($, e) => {
    started.walks.push(e.names[0] ?? '')

    return { value: e.names.includes('AGENTS.md') ? agents : claude }
  })

  return started
}
