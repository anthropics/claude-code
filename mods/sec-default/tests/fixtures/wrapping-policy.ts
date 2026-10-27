import type { Settings } from 'claude-code'

/**
 * Managed settings that name a launcher with the key of its own, which the
 * engine writes into `CLAUDE_CODE_PROCESS_WRAPPER`, and set no `env`.
 */
export const WRAPPING_POLICY: Settings = {
  processWrapper: '/opt/corp/launch',
}
