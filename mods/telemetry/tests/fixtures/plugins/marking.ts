import type { Plugin } from 'claude-code/testing'

/**
 * A built-in plugin whose `/mark <entry>` marks the entry through
 * `$.telemetry`, answering "queued", or why the mark was refused.
 */
export const marking: Plugin = {
  name: 'marking',
  tier: 'builtin',
  register(on) {
    on('command.run', { command: 'mark' }, ($, e) =>
      $.telemetry.mark(JSON.parse(e.args)).then(
        () => ({ text: 'queued' }),
        (error: unknown) => ({ text: String(error) }),
      ),
    )
  },
}
