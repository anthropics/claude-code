import { oneAddedOf } from './one-added-of.js'
import type { PrintedFile } from './printed-file.js'

/**
 * Files whose names a parse of git's lines could mistake, in git's order,
 * each opening as git prints it: quoted around a newline or a quote.
 */
export const UNUSUAL_NAMES: readonly PrintedFile[] = [
  ['a b/x b', oneAddedOf('in a folder named a b')],
  ['diff --git a b', oneAddedOf('named as an opening line')],
  ['höher.txt', oneAddedOf('outside ASCII')],
  [
    'new\nline.txt',
    oneAddedOf('a newline in the name'),
    'diff --git "a/new\\nline.txt" "b/new\\nline.txt"',
  ],
  [
    'quo"te.txt',
    oneAddedOf('a quote in the name'),
    'diff --git "a/quo\\"te.txt" "b/quo\\"te.txt"',
  ],
  ['with space.txt', oneAddedOf('a space in the name')],
  ['x b/x.txt', oneAddedOf('b/ inside the name')],
]
