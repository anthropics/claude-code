import type { On } from 'claude-code'

/**
 * Answers every `$.ui.log` beneath the plugins and keeps each line as
 * `<to>: <text>`, in order.
 *
 * @param on the test's `on`
 * @returns the lines logged so far
 */
export function logged(on: On) {
  const lines: string[] = []

  on('ui.log', ($, e) => {
    lines.push(`${e.to}: ${e.text}`)

    return { value: undefined }
  })

  return lines
}
