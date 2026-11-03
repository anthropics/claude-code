/**
 * Why a plugin a person installed may not add a tool under a name that is,
 * or begins as, a server the organization delivers: the setting, the rule.
 *
 * @param plugin the plugin's name, which its tools would be called by
 * @returns the refusal
 */
export const serverNameRefusal = (plugin: string) =>
  `managedMcpServers (managed): a tool of ${plugin} would be named as a ` +
  "tool of one of the organization's servers"
