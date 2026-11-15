import type { Settings } from 'claude-code'

/**
 * Managed settings that turn on the test's plugin named `guard`, by the id
 * the test engine gives it.
 */
export const ENABLING_GUARD: Settings = {
  enabledPlugins: { 'guard@claude-plugin-test': true },
}
