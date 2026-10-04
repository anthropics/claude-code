import type { On } from 'claude-code'

import { registeredToolOf } from './registered-tool-of.js'

/**
 * A session starting, where each tool a plugin asks for is registered and
 * kept by the name of the plugin that asked.
 *
 * @param on the test's `on`
 * @returns the plugins whose tools were registered, in order
 */
export function toolsRegistered(on: On) {
  const registered: string[] = []

  on('session.start', ($, e) => ({ cwd: e.cwd }))

  on('tool.register', ($, e, next) => {
    registered.push(next.origin.plugin)

    return registeredToolOf(next.origin.plugin, e.name)
  })

  return registered
}
