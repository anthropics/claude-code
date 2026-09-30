import { answersOf } from './answers-of.js'

/**
 * Git's output in /work where a source file and a lockfile changed, the
 * lockfile a generated file the docked pane hides until asked.
 */
export const WITH_LOCKFILE = answersOf('1\t1\tapp.ts\0' + '1\t1\tbun.lock\0', {
  'app.ts': '@@ -1 +1 @@\n-const a = 1\n+const a = 2\n',
  'bun.lock': '@@ -1 +1 @@\n-"left": "1.0.0"\n+"left": "1.0.1"\n',
})
