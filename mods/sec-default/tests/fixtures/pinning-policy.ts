import type { Settings } from 'claude-code'

/**
 * Managed settings that pin one environment variable, `CORP_PROXY`.
 */
export const PINNING_POLICY: Settings = {
  env: { CORP_PROXY: 'http://proxy.corp.example.com' },
}
