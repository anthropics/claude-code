import type { Settings } from 'claude-code'

/**
 * Managed settings that deliver a server whose name holds no letter or
 * digit, so it folds to nothing.
 */
export const UNFOLDABLE_POLICY: Settings = {
  managedMcpServers: { '--': { type: 'http', url: 'https://corp.example/x' } },
}
