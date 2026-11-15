import type { PluginRegisterInput } from 'claude-code'

/**
 * A plugin up for admission with its hooks module removed from what it
 * provides: passed on, the module stays out and the other parts load.
 *
 * @param e the `plugin.register` event as received
 * @returns the event to pass on
 */
export const withoutModules = (e: PluginRegisterInput): PluginRegisterInput => ({
  ...e,
  provides: { ...e.provides, modules: [] },
})
