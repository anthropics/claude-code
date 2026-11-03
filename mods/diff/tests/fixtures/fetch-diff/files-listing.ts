import type Git from '../../../hooks/git'

/**
 * What the working tree lists as: the files the cases name are plain
 * files; the link, the leak and the submodule are something else.
 */
export const FILES_LISTING: readonly (readonly [string, Git.EntryKind])[] = [
  ['old.ts', 'file'],
  ['new.ts', 'file'],
  ['scratch.txt', 'file'],
  ['stale.txt', 'file'],
  ['fresh.txt', 'file'],
  ['a.ts', 'file'],
  ['staged.ts', 'file'],
  ['link.ts', 'other'],
  ['leak', 'other'],
  ['sub', 'other'],
]
