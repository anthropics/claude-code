import { answersOf } from './answers-of.js'

/**
 * Git's output in /work where two files changed, a hunk each.
 */
export const TWO_FILES = answersOf('1\t1\tapp.ts\0' + '2\t0\tlib.ts\0', {
  'app.ts': '@@ -1 +1 @@\n-const a = 1\n+const a = 2\n',
  'lib.ts': '@@ -3,0 +4,2 @@\n+export const b = 1\n+export const c = 2\n',
})
