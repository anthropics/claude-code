import type { SessionStartInput } from 'claude-code'

/**
 * An interactive terminal session in /work.
 */
export const SESSION: SessionStartInput = {
  surface: 'terminal',
  isInteractive: true,
  cwd: '/work',
}
