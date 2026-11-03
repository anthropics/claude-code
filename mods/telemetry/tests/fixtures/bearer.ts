import type { SessionAuthorization } from 'claude-code'

/**
 * The credential a session signed in first party holds, by its handle.
 */
export const BEARER: SessionAuthorization = {
  handle: 'the-handle',
  kind: 'bearer',
}
