import type { SessionStartInput } from 'claude-code'

/**
 * An interactive terminal session two directories under /repo.
 */
export const SESSION: SessionStartInput = {
  surface: 'terminal',
  isInteractive: true,
  cwd: '/repo/a/b',
}
