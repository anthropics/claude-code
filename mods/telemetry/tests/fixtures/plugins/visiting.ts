import type { Plugin } from 'claude-code/testing'

/**
 * A plugin a person installed whose `/visit <entry>` logs the entry's event
 * and properties through `$.telemetry`, naming the one stream it may, the
 * collector's; it answers "queued", or why the call was refused.
 */
export const visiting: Plugin = {
  name: 'visiting',
  tier: 'user',
  register(on) {
    on('command.run', { command: 'visit' }, ($, e) => {
      const { event, props } = JSON.parse(e.args)

      return $.telemetry.log({ to: 'collector', event, props }).then(
        () => ({ text: 'queued' }),
        (error: unknown) => ({ text: String(error) }),
      )
    })
  },
}
