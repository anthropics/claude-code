/**
 * A file's unified diff after its opening line: one hunk, a line of context
 * and one added line.
 *
 * @param text the added line, without its marker
 * @returns the body
 */
export const oneAddedOf = (text: string) => `@@ -1 +1,2 @@\n one\n+${text}\n`
