/**
 * The answer that turns the folder's mods on; any other refuses them.
 */
export const TURN_THEM_ON = 'Turn them on'

/**
 * The answer that keeps them out for the session.
 */
export const NOT_NOW = 'Not now'

/**
 * What the person is asked before a mod in the session's folder loads. It names
 * the organization because in most modes it follows the engine's question.
 */
export const HOT_RELOAD_QUESTION =
  'Your organization asks you to confirm before mods Claude writes turn on. Turn them on in this session?'

/**
 * Where a person's yes for a folder is kept: this plugin's `$.store`, across the
 * sessions that resume it.
 *
 * @param folder the folder (devModsFolderOf)
 * @returns the key
 */
export const yesKey = (folder: string) => `hot-reload-yes:${folder}`

/**
 * What a person reads after answering no.
 *
 * @param name the mod's name, as its own manifest gives it
 * @returns the refusal line
 */
export const declinedRefusal = (name: string) =>
  `you answered ${NOT_NOW} (forceHotReloadPrompt); ${name} was not loaded`

/**
 * The refusal where no answer could be had: nobody bound to ask, a session
 * that cannot prompt, a question that rejected, or this plugin's hook failing.
 *
 * @param name the mod's name, as its own manifest gives it
 * @returns the refusal line
 */
export const unaskedRefusal = (name: string) =>
  `nobody answered the question about it (forceHotReloadPrompt); ${name} was not loaded`
