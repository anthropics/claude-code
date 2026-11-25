import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'

import type Beneath from './beneath'

/**
 * Answers what every /diff session asks first: its start, with its own
 * directory, the time, each command it registers, under its name, whether
 * a file may be read, and where a path lands.
 *
 * @param on the test's `on`
 * @param now where the clock starts, in milliseconds (0 when not given)
 * @param beneath the folder, the Read verdicts and the landings, when the
 *   test has its own
 * @returns the clock the session reads, at `now` until the test moves it
 */
export function startsSession(
  on: On,
  now = 0,
  beneath: Beneath.Beneath = {},
): MockClock {
  let startedIn = ''

  on('session.start', ($, e) => {
    startedIn = e.cwd

    return { cwd: e.cwd }
  })

  on('session.cwd', () => ({ value: beneath.cwd?.() ?? startedIn }))

  on('tool.check', { tool: 'Read' }, async ($, e) => {
    const { file_path: path } = e.input as { file_path: string }

    const answer = (await beneath.readOf?.(path)) ?? 'allow'

    return answer === 'allow'
      ? { decision: 'allow' }
      : { decision: 'deny', rule: answer === 'deny' ? `Read(${path})` : 'Read' }
  })

  on('fs.stat', { resolve: true }, ($, e) => {
    const realPath = beneath.landingOf ? beneath.landingOf(e.path) : e.path

    return realPath === null
      ? { deny: `$.fs.stat(${e.path}) failed: ENOENT` }
      : {
          value: { kind: 'file', size: 2, mtimeMs: 0, isLink: false, realPath },
        }
  })

  on('command.register', ($, e) => ({ value: { command: e.name } }))

  return mock.clock(on, { now })
}
