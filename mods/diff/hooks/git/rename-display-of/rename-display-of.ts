/**
 * A rename as `git diff --stat` prints it: the shared leading and trailing
 * directories once, the differing middles in braces, `old => new` between.
 *
 * `docs/{notes => renamed}`, `{src => lib}/main`, or with nothing shared
 * `old => new`; a prefix or suffix only counts up to a slash, as git counts
 * it (pprint_rename).
 *
 * @param oldPath the path before the rename
 * @param newPath the path after it
 * @returns the one-line rename
 */
export function renameDisplayOf(oldPath: string, newPath: string): string {
  let prefix = 0
  let suffix = 0

  for (let at = 0; at < oldPath.length && at < newPath.length; at++) {
    if (oldPath[at] !== newPath[at]) {
      break
    }

    if (oldPath[at] === '/') {
      prefix = at + 1
    }
  }

  const floor = prefix - (prefix > 0 ? 1 : 0)

  for (
    let back = 1;
    oldPath.length - back >= floor && newPath.length - back >= floor;
    back++
  ) {
    const character = oldPath[oldPath.length - back]

    if (character !== newPath[newPath.length - back]) {
      break
    }

    if (character === '/') {
      suffix = back
    }
  }

  const middleOf = (path: string) =>
    path.slice(prefix, Math.max(prefix, path.length - suffix))

  const middle = `${middleOf(oldPath)} => ${middleOf(newPath)}`
  const isBraced = prefix + suffix > 0
  const head = oldPath.slice(0, prefix)
  const tail = oldPath.slice(oldPath.length - suffix)

  return isBraced ? `${head}{${middle}}${tail}` : middle
}
