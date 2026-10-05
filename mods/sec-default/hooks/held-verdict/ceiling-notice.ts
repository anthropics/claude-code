import type { Args } from 'claude-code'

/**
 * What a person reads, once for each plugin in a session, when a plugin they
 * installed answered over the ceiling their organization set on a tool.
 *
 * No option lifts it: an administrator changes the ceiling where it is set.
 *
 * @param plugin the plugin's name, or its batch's, as the trace names it
 * @param e the question: the tool the call named and its ceiling
 * @returns the line
 */
export const ceilingNotice = (plugin: string, e: Args<'tool.check'>) =>
  `${plugin} tried to lift the limit your organization set on ${e.tool} ` +
  `(${e.ceiling}); the limit holds over the plugins you install`
