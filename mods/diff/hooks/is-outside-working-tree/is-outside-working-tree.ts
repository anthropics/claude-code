import Git from '../git'
import { normalPathOf } from './normal-path-of.js'

/**
 * Whether a file a tool edited lies outside the pinned working tree, by
 * how the paths are spelled alone (normalPathOf): no row could show it.
 *
 * A relative path is read from the session's directory. Where that
 * directory is itself not spelled under the top (a symbolic link on the
 * way to it), spelling proves nothing and nothing is outside.
 *
 * @param path the path the tool was called with
 * @param tree the session's directory and the working tree's top
 * @returns true only for a path surely outside the tree
 */
export function isOutsideWorkingTree(
  path: string,
  tree: { cwd: string; toplevel: string },
): boolean {
  const top = normalPathOf(tree.toplevel)
  const absolute = Git.isAbsolutePath(path) ? path : `${tree.cwd}/${path}`

  const isUnderTop = (spelled: string) =>
    top === '' || spelled === top || spelled.startsWith(`${top}/`)

  return (
    isUnderTop(normalPathOf(tree.cwd)) && !isUnderTop(normalPathOf(absolute))
  )
}
