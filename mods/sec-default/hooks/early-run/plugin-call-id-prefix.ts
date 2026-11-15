/**
 * What the id of every call a plugin makes itself begins with. A call under
 * any other id is the model's, whichever plugin started its loop.
 *
 * The engine's own spelling, which a test in its repository holds this to.
 */
export const PLUGIN_CALL_ID_PREFIX = 'toolu_plugin_'
