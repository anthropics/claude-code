import type { Plugin } from 'claude-code/testing'

/**
 * A plugin whose `/mark <entry>` marks the entry through `$.telemetry`,
 * answering "sent", or why the mark was refused.
 */
export const marking: Plugin = {
  name: 'marking',
  register(on) {
    on('command.run', { command: 'mark' }, ($, e) =>
      $.telemetry.mark(JSON.parse(e.args)).then(
        () => ({ text: 'sent' }),
        (error: unknown) => ({ text: String(error) }),
      ),
    )
  },
}
