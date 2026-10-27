import type { On } from 'claude-code'

/**
 * Answers every `$.ui.log` beneath the plugins and keeps each line as
 * `<plugin> <text>`, the plugin as the engine pins the caller.
 *
 * @param on the test's `on`
 * @returns the lines logged so far
 */
export function loggedBy(on: On) {
  const lines: string[] = []

  on('ui.log', ($, e, next) => {
    lines.push(`${next.origin.plugin} ${e.text}`)

    return { value: undefined }
  })

  return lines
}
