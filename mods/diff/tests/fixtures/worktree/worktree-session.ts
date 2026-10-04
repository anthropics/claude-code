import type { SessionStartInput } from 'claude-code'

/**
 * An interactive terminal session in the linked worktree /main/wt.
 */
export const WORKTREE_SESSION: SessionStartInput = {
  surface: 'terminal',
  isInteractive: true,
  cwd: '/main/wt',
}
