/**
 * Git's output in /work for each invocation whose command line holds the
 * key, over the given `--numstat -z` records and per-file bodies.
 *
 * `status` lists the paths dirty at the start (the baseline: every path
 * with a body unless given); a body is keyed by the `-- <path>` its diff is
 * asked with.
 *
 * @param numstat the `--numstat -z` records, joined
 * @param bodies each path's unified diff after its header
 * @param dirty the paths `status` lists as dirty when the session starts
 * @returns the answers by key
 */
export const answersOf = (
  numstat: string,
  bodies: Readonly<Record<string, string>>,
  dirty: readonly string[] = Object.keys(bodies),
): Readonly<Record<string, string>> => ({
  'rev-parse --path-format=absolute': '/work\n/work/.git\n/work/.git\n',
  'status --porcelain': dirty.map(path => ` M ${path}\0`).join(''),
  'HEAD --shortstat': ` ${Object.keys(bodies).length} files changed`,
  'HEAD --numstat': numstat,
  'ls-files': '',
  ...Object.fromEntries(
    Object.entries(bodies).map(([path, body]) => [`-- ${path}`, body]),
  ),
})
