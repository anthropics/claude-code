/**
 * What the shell takes out of a line before a program reads it.
 */
export const QUOTING = /["'`\\]/g

/**
 * A call's input as the text that the test reads: every string in it, a list's
 * as one line, as written and again with continued lines joined and quotes and
 * escapes taken out, so that `cu''rl` and `"jo"@x.test` count. Both readings,
 * since a backslash or backtick need not be either: `C:\\bin\\curl`.
 *
 * @param input the tool call's input
 * @returns the text
 */
export function textOf(input: unknown): string {
  if (typeof input === 'string') {
    const plain = input
      .replace(/[\\`]\r?\n/g, '')
      .replace(/\$(?=["'])/g, '')
      .replace(QUOTING, '')

    return `${input}\n${plain}`
  }

  if (typeof input !== 'object' || input === null) {
    return ''
  }

  return Object.values(input)
    .map(textOf)
    .join(Array.isArray(input) ? ' ' : '\n')
}
