/**
 * What the shell takes out of a line before a program reads it.
 */
export const QUOTING = /["'`\\]/g

/**
 * A call's input as the text that the test reads: every string in it, a list's
 * as one line, as written and again with continued lines joined and quotes and
 * escapes taken out, so that `cu''rl` and `"jo"@x.test` count. Both readings,
 * since a backslash or backtick need not be either: `C:\\bin\\curl`. A key is
 * quoted, as in a headers dict: `headers: {From: ...}` reads as the word it is.
 *
 * @param input the tool call's input
 * @returns the text
 */
export function textOf(input: unknown): string {
  const parts: string[] = []
  // A loop, last entry first: a hook that runs out of stack is skipped.
  const left: ({ text: string } | { value: unknown } | { done: object })[] = [
    { value: input },
  ]
  const inside = new Set<object>()

  for (let next = left.pop(); next !== undefined; next = left.pop()) {
    if ('text' in next) {
      parts.push(next.text)
    } else if ('done' in next) {
      inside.delete(next.done)
    } else if (typeof next.value === 'string') {
      parts.push(bothReadingsOf(next.value))
    } else if (
      typeof next.value === 'object' &&
      next.value !== null &&
      // A value inside itself is being read already.
      !inside.has(next.value)
    ) {
      inside.add(next.value)
      left.push({ done: next.value })

      if (Array.isArray(next.value)) {
        for (let at = next.value.length - 1; at >= 0; at--) {
          left.push({ value: next.value[at] }, { text: at === 0 ? '' : ' ' })
        }
      } else {
        const entries = [...Object.entries(next.value).entries()]

        for (const [at, [key, value]] of entries.reverse()) {
          left.push({ value }, { text: `${at === 0 ? '' : '\n'}"${key}": ` })
        }
      }
    }
  }

  return parts.join('')
}

/**
 * One string of the input, as written and as the shell would leave it.
 *
 * @param text the string
 * @returns the two readings, on a line each
 */
function bothReadingsOf(text: string): string {
  const plain = text
    .replace(/[\\`]\r?\n/g, '')
    .replace(/\$(?=["'])/g, '')
    .replace(QUOTING, '')

  return `${text}\n${plain}`
}
