import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'

import { HOST_ROW } from './host-row.js'
import { START_SECONDS } from './start-seconds.js'

/**
 * A terminal that a person watches, with nothing said before.
 *
 * @param on the test's `on`
 */
export function watchedTerminal(on: On): void {
  mock.clock(on, { now: (START_SECONDS + 3_600) * 1_000 })
  mock.env(on, {})
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('session.messages', () => ({ value: [] }))
  on('settings.read', () => ({ value: {} }))
  on('telemetry.log', () => ({ value: undefined }))
  on('telemetry.mark', () => ({ value: undefined }))
  on('ui.render', { component: 'ToolUse' }, () => ({
    type: 'Text',
    props: {},
    children: [HOST_ROW],
  }))
}
