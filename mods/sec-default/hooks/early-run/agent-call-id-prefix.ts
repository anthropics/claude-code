import { PLUGIN_CALL_ID_PREFIX } from './plugin-call-id-prefix.js'

/**
 * What the id of a plugin's `$.agent.call` begins with: a call the engine
 * checks as it checks the model's.
 *
 * The engine's own spelling, which a test in its repository holds this to.
 */
export const AGENT_CALL_ID_PREFIX = 'toolu_plugin_agent_'

/** Whether the id is a plugin's `$.tool.call`'s, which no permission check asks about. */
export const isUnasked = (id: string): boolean =>
  id.startsWith(PLUGIN_CALL_ID_PREFIX) && !id.startsWith(AGENT_CALL_ID_PREFIX)

/** The plugin that made a `$.agent.call`; none for the model's call. */
export const makerOf = (
  id: string,
  origin: { plugin: string },
): string | undefined =>
  id.startsWith(AGENT_CALL_ID_PREFIX) ? origin.plugin : undefined
