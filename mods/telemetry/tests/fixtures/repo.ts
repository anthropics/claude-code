import type { SessionRepo } from 'claude-code'

/**
 * The repository the session runs in: a GitHub remote over ssh.
 */
export const REPO: SessionRepo = {
  root: '/work',
  remote: 'git@github.com:anthropics/claude-code.git',
  internal: false,
  name: null,
}
