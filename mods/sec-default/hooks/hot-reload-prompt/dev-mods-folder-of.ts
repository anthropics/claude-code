/**
 * The session's dev-mods folder a plugin sits in or is: `dev-mods/<session id>`, the
 * last such pair of folders in its path. A POSIX root splits on `/` alone, so a child
 * named `dev-mods\<id>` cannot supply the pair and borrow another session's yes. The
 * question covers the folder, and the session id keeps a yes from another session's:
 * a resume keeps its id, a fork takes a new one.
 *
 * Read off the path and not against the config home, so a home spelled another
 * way can never let such a mod past the question; another folder with such a pair
 * in its path is asked about too. Short enough to be a `$.store` key whatever
 * the home's length, and the store sits under the same home.
 *
 * @param root the plugin's directory, absolute
 * @returns the folder's name, or undefined for a plugin that sits anywhere else
 */
export function devModsFolderOf(root: string) {
  const segments = root
    .split(root.startsWith('/') ? '/' : /[/\\]/)
    .filter(segment => segment !== '')
  const at = segments.slice(0, -1).lastIndexOf('dev-mods')

  return at === -1 ? undefined : `dev-mods/${segments[at + 1]}`
}
