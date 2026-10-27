import { answersOf } from './answers-of.js'
import { MANY_FILE_COUNT } from './many-file-count.js'

/**
 * Git's output in /work where MANY_FILE_COUNT files changed a line each:
 * more rows than the docked list shows at once.
 */
export const MANY_FILES = answersOf(
  Array.from(
    { length: MANY_FILE_COUNT },
    (_, at) => `1\t1\tfile${at}.ts\0`,
  ).join(''),
  Object.fromEntries(
    Array.from({ length: MANY_FILE_COUNT }, (_, at) => [
      `file${at}.ts`,
      `@@ -1 +1 @@\n-const v = ${at}\n+const v = ${at + 1}\n`,
    ]),
  ),
)
