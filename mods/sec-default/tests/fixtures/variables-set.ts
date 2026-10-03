import type { On } from 'claude-code'

/**
 * A session starting, where each variable a plugin sets reaches the engine
 * and is kept as `<plugin> <name>=<value>`.
 *
 * @param on the test's `on`
 * @returns what was set, in order
 */
export function variablesSet(on: On) {
  const set: string[] = []

  on('session.start', ($, e) => ({ cwd: e.cwd }))

  on('env.set', ($, e, next) => {
    set.push(`${next.origin.plugin} ${e.name}=${String(e.value)}`)

    return { value: undefined }
  })

  return set
}
