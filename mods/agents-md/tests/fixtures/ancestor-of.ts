import type { FsAncestor } from 'claude-code'

/**
 * One instruction file a walk found.
 *
 * @param dir the directory the file stands in
 * @param name the file's name as the walk asked for it
 * @param content the file's text
 * @returns the found file
 */
export const ancestorOf = (
  dir: string,
  name: string,
  content: string,
): FsAncestor => ({
  dir,
  name,
  content,
  parts: [{ path: `${dir}/${name}`, content }],
})
