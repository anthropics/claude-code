import type { Args, On } from 'claude-code'
import { mock } from 'claude-code/testing'

import Beneath from './beneath'
import { gitIn } from './git-in.js'
import { HINT_DRAWN } from './hint-drawn.js'
import { keeping } from './keeping.js'
import { REPOSITORY } from './repository.js'
import { startsSession } from './starts-session.js'

/**
 * A session in a repository git answers for from a script (REPOSITORY, in
 * /work, when none is given), keeping what the plugin does there.
 *
 * Kept: each git run, ring move, pane opened, left waiting or closed, status
 * line. The clock starts at 0 and the engine draws the hint; the rest of the
 * world is the test's (Beneath). Rewriting the script changes git's answers.
 *
 * @param on the test's `on`
 * @param script git's output for each invocation whose line holds the key
 * @param beneath the store, settings, environment, transcript, whether an
 *   open is seated
 * @returns the runs, the ring's moves, the panes opened, left waiting and
 *   closed, the statuses, the clock
 */
export function inRepository(
  on: On,
  script: Readonly<Record<string, string>> = REPOSITORY,
  beneath: Beneath.Beneath = {},
) {
  const runs: Args<'process.run'>[] = []
  const focused: Args<'ui.focus'>[] = []
  const statuses: (string | undefined)[] = []
  const waiting: Args<'ui.open'>[] = []
  const opened = keeping<Args<'ui.open'>>()
  const closed = keeping<Args<'ui.close'>>()
  const clock = startsSession(on)

  on('process.run', ($, e) => {
    runs.push(e)

    return { value: gitIn(e.argv, script) }
  })

  on('ui.focus', (_engine, e) => {
    focused.push(e)

    return {}
  })

  on('ui.status', ($, e) => {
    statuses.push(e.text)

    return { value: undefined }
  })

  on('ui.open', (engine, e) => {
    const isWaiting = beneath.isLeftWaiting?.() === true

    if (!isWaiting) {
      return opened.hook(engine, e)
    }

    waiting.push(e)

    return Beneath.LEFT_WAITING
  })

  on('ui.close', closed.hook)
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.render', { component: 'PromptHint' }, () => HINT_DRAWN)
  on('session.messages', () => ({ value: [...(beneath.messages?.() ?? [])] }))
  on('settings.read', () => ({ value: beneath.settings ?? {} }))
  mock.store(on, beneath.stored ?? {})
  mock.env(on, beneath.env ?? {})

  return {
    runs,
    focused,
    opened: opened.kept,
    waiting,
    closed: closed.kept,
    statuses,
    clock,
  }
}
