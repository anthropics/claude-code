import { answersOf } from '../answers-of.js'

/**
 * Git's output in /work where that many files changed a line each.
 *
 * @param count how many files changed
 * @returns the answers by key
 */
export const filesChanged = (count: number) =>
  answersOf(
    Array.from({ length: count }, (_, at) => `1\t1\tfile${at}.ts\0`).join(''),
    Object.fromEntries(
      Array.from({ length: count }, (_, at) => [
        `file${at}.ts`,
        `@@ -1 +1 @@\n-const v = ${at}\n+const v = ${at + 1}\n`,
      ]),
    ),
  )
