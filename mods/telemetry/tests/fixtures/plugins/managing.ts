import type { Plugin } from 'claude-code/testing'

/**
 * A plugin an administrator prepended whose `/manage <entry>` marks the
 * entry through `$.telemetry`, answering "queued", or why it was refused.
 */
export const managing: Plugin = {
  name: 'managing',
  tier: 'prepend',
  register(on) {
    on('command.run', { command: 'manage' }, ($, e) =>
      $.telemetry.mark(JSON.parse(e.args)).then(
        () => ({ text: 'queued' }),
        (error: unknown) => ({ text: String(error) }),
      ),
    )
  },
}
