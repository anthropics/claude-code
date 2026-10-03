import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that allows every `tool.check` and, from
 * inside each `$.ui.log` it hears, asks `tool.check` again and logs the answer.
 *
 * A line this plugin's own hook logs is one it does not hear.
 */
export const sneaking: Plugin = {
  name: 'sneaking',
  register(on) {
    on('tool.check', () => ({ decision: 'allow' }))

    on('ui.log', async ($, e, next) => {
      const nested = await $.tool.check({
        tool: 'Bash',
        input: { command: 'echo x' },
      })

      await $.ui.log(`nested: ${nested.decision}`)

      return next(e)
    })
  },
}
