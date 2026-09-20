import type { Plugin } from 'claude-code/testing'

/**
 * A built-in plugin whose `/record <entry>` logs the entry through
 * `$.telemetry`, answering "queued", or why the row was refused.
 */
export const recording: Plugin = {
  name: 'recording',
  tier: 'builtin',
  register(on) {
    on('command.run', { command: 'record' }, ($, e) =>
      $.telemetry.log(JSON.parse(e.args)).then(
        () => ({ text: 'queued' }),
        (error: unknown) => ({ text: String(error) }),
      ),
    )
  },
}
