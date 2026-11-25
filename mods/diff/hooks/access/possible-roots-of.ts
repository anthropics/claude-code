/**
 * Every folder that may be the top of the one the session stands in, for
 * when `$.vcs.detect` does not say: that folder and each above it, up to the
 * pane's own top.
 *
 * @param cwd the session's current folder
 * @param toplevel the top of the working tree the pane reads
 * @returns `toplevel`, then the folders from `cwd` up
 */
export function possibleRootsOf(cwd: string, toplevel: string): string[] {
  const isDriven = /^[A-Za-z]:\\|^\\\\/.test(cwd)
  const slashed = isDriven ? cwd.replaceAll('\\', '/') : cwd
  const parts = slashed.replace(/\/$/, '').split('/')
  const upward = parts.map((_, up) => parts.slice(0, parts.length - up))
  const folders = upward.map(kept => kept.join('/') || '/')
  const top = folders.indexOf(toplevel)

  return [toplevel, ...(top === -1 ? folders : folders.slice(0, top))]
}
