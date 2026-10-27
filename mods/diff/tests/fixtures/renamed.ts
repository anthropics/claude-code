import { answersOf } from './answers-of.js'

/**
 * Git's output in /work where one file was renamed inside its directory,
 * its contents untouched.
 */
export const RENAMED = answersOf(
  '0\t0\t\0docs/notes.txt\0docs/renamed-notes.txt\0',
  {},
)
