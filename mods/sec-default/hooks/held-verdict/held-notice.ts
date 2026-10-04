/**
 * What a person reads, once for each plugin in a session, when a plugin they
 * installed answered allow or ask over a deny rule in their settings.
 *
 * It names the option an administrator sets to let such plugins override.
 *
 * @param plugin the plugin's name, or its batch's, as the trace names it
 * @param tool the tool the call named
 * @param rule the deny rule that decided, as written
 * @returns the line
 */
export const heldNotice = (plugin: string, tool: string, rule: string) =>
  `${plugin} tried to lift a deny rule in your settings from a ${tool} ` +
  `call (${rule}); the deny rule holds over the plugins you install ` +
  '(allowModsToOverrideDenyRules)'
