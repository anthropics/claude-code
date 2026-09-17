import type { FsAncestor, On } from 'claude-code'

import { startedOf } from './started-of.js'
import type { Started } from './types'

/**
 * A project whose walks up from the working directory find the given files,
 * one list per set of names, its session starting untouched (startedOf).
 *
 * @param on the test's `on`
 * @param agents what a walk for AGENTS.md and .claude/AGENTS.md finds
 * @param claude what a walk for CLAUDE.md, .claude/CLAUDE.md and
 * CLAUDE.local.md finds
 * @param stored what the plugin's store already holds, by key
 * @returns the toasts and lines the plugins raised, in order
 */
export function projectOf(
  on: On,
  agents: readonly FsAncestor[],
  claude: readonly FsAncestor[],
  stored: Readonly<Record<string, unknown>> = {},
): Started {
  const started = startedOf(on, stored)

  on('fs.ancestors', ($, e) => ({
    value: e.names.includes('AGENTS.md') ? agents : claude,
  }))

  return started
}
