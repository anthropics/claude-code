/**
 * What an event's name starts with unless the caller named it as the CLI's
 * own (CORE_EVENT_PREFIX): the plugin-event convention.
 *
 * The calling built-in's own name is already in the event it passes.
 */
export const EVENT_PREFIX = 'tengu_plugin_'
