import { answersOf } from './answers-of.js'

/**
 * Git's output in /work where two old files differ from HEAD: one dirty
 * before the session began, one moved into place since (not dirty then).
 */
export const MOVED_IN = answersOf(
  '1\t1\told.ts\0' + '1\t1\tmoved.ts\0',
  {
    'old.ts': '@@ -1 +1 @@\n-a\n+b\n',
    'moved.ts': '@@ -1 +1 @@\n-c\n+d\n',
  },
  ['old.ts'],
)
