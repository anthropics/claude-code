import type { Settings } from 'claude-code'

/**
 * Managed settings that pin `corp_proxy`: `CORP_PROXY` in another case.
 */
export const LOWER_CASE_PINNING_POLICY: Settings = {
  env: { corp_proxy: 'http://proxy.corp.example.com' },
}
