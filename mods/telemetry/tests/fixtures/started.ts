import type { SessionStartInput } from 'claude-code'

/**
 * The session as it starts: a person at the prompt in the checkout.
 */
export const STARTED: SessionStartInput = {
  cwd: '/work',
  surface: 'terminal',
  isInteractive: true,
}
