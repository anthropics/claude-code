const slashed = (path: string) =>
  (/^[A-Za-z]:\\/.test(path) ? path.replaceAll('\\', '/') : path).replace(
    /\/$/,
    '',
  )

/**
 * The top of the folder the session stands in now: its working copy's root,
 * else the pane's own top when the folder is under it, else the folder.
 *
 * @param cwd the session's current folder
 * @param detected the root `$.vcs.detect` names for it, or null
 * @param toplevel the top of the working tree the pane reads
 * @returns the root; `toplevel` itself when they are one folder
 */
export function liveRootOf(
  cwd: string,
  detected: string | null,
  toplevel: string,
): string {
  const top = slashed(toplevel)
  const isUnderTop = `${slashed(cwd)}/`.startsWith(`${top}/`)
  const root = detected ?? (isUnderTop ? toplevel : cwd)

  return slashed(root) === top ? toplevel : root
}
