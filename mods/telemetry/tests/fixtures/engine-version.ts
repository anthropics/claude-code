import type { SessionVersion } from 'claude-code'

/**
 * What the engine answers `$.session.version()` in the plain session: a
 * development build, its release and its build time.
 */
export const ENGINE_VERSION: SessionVersion = {
  version: '2.1.300-dev.20260920.t101500.sha1a2b3c4',
  base: '2.1.300-dev',
  builtAt: '2026-09-20T10:15:00Z',
}
