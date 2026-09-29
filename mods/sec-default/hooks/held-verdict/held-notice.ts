/**
 * What a person reads, once for each plugin in a session, when a plugin they
 * installed allowed a call that a deny rule in their settings refuses.
 *
 * It names the option an administrator sets to let such plugins override.
 *
 * @param plugin the plugin's name, as the chain's trace names its link
 * @param tool the tool the call named
 * @param rule the deny rule that decided, as written
 * @returns the line
 */
export const heldNotice = (plugin: string, tool: string, rule: string) =>
  `${plugin} tried to allow a ${tool} call your settings deny (${rule}); ` +
  'the deny rule holds over the plugins you install ' +
  '(allowModsToOverrideDenyRules)'
