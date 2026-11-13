import type { PluginRegisterInput } from 'claude-code'

/**
 * Whether a plugin has no hooks module, or one that scans empty. Neither has a
 * hook or a `$`, the only way a module touches anything, so a rule about mods has
 * nothing of it to keep out.
 *
 * @param uses what the plugin's module hooks and calls, as scanned
 * @returns true when that is nothing
 */
export const usesNothing = ({ events, calls }: PluginRegisterInput['uses']) =>
  events.length === 0 && calls.length === 0
