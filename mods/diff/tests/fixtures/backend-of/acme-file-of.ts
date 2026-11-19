import type { VcsDiffFile } from 'claude-code'

/**
 * One file of a `vcs.diff` answer: tracked text, one line changed, unless
 * the overrides say otherwise.
 *
 * @param path the file's path below the root
 * @param overrides the fields that differ
 * @returns the file
 */
export const acmeFileOf = (
  path: string,
  overrides: Partial<VcsDiffFile> = {},
): VcsDiffFile => ({
  path,
  renamedFrom: null,
  added: 1,
  removed: 1,
  isBinary: false,
  isUntracked: false,
  ...overrides,
})
