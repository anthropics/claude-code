/**
 * What registering a plugin's tool answers: the name it is called by.
 *
 * @param plugin the plugin that asked
 * @param name the tool's own name
 * @returns the `tool.register` result
 */
export const registeredToolOf = (plugin: string, name: string) => ({
  value: { tool: `mcp__plugin_${plugin}__${name}` },
})
