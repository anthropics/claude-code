import type { Plugin } from 'claude-code/testing'

/**
 * A plugin a person installed whose `/visit <entry>` logs the entry through
 * `$.telemetry`, answering "queued", or why the row was refused.
 */
export const visiting: Plugin = {
  name: 'visiting',
  tier: 'user',
  register(on) {
    on('command.run', { command: 'visit' }, ($, e) =>
      $.telemetry.log(JSON.parse(e.args)).then(
        () => ({ text: 'queued' }),
        (error: unknown) => ({ text: String(error) }),
      ),
    )
  },
}
