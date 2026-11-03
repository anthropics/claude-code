/**
 * A file's unified diff after its opening line: one hunk of one added line
 * that many characters long.
 *
 * @param length how long the added line is
 * @returns the body
 */
export const longLineOf = (length: number) =>
  `@@ -0,0 +1 @@\n+${'x'.repeat(length)}\n`
