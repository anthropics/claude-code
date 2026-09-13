import type { Args, On } from 'claude-code'
import { mock } from 'claude-code/testing'

import { gitIn } from './git-in.js'
import { HINT_DRAWN } from './hint-drawn.js'
import { keeping } from './keeping.js'
import { REPOSITORY } from './repository.js'
import { startsSession } from './starts-session.js'

/**
 * A session in a repository git answers for from a script (REPOSITORY, in
 * /work, when none is given), keeping what the plugin does there.
 *
 * Kept: each git run, pane opened or closed, and status line. The clock
 * starts at 0 and the engine draws the hint. A test that rewrites the
 * script between calls changes what git answers next.
 *
 * @param on the test's `on`
 * @param script git's output for each invocation whose line holds the key
 * @param stored what the plugin's store holds at the start
 * @returns the runs, the panes opened and closed, the statuses, the clock
 */
export function inRepository(
  on: On,
  script: Readonly<Record<string, string>> = REPOSITORY,
  stored: Readonly<Record<string, unknown>> = {},
) {
  const runs: Args<'process.run'>[] = []
  const statuses: (string | undefined)[] = []
  const opened = keeping<Args<'ui.open'>>()
  const closed = keeping<Args<'ui.close'>>()
  const clock = startsSession(on)

  on('process.run', ($, e) => {
    runs.push(e)

    return { value: gitIn(e.argv, script) }
  })

  on('ui.status', ($, e) => {
    statuses.push(e.text)

    return { value: undefined }
  })

  on('ui.open', opened.hook)
  on('ui.close', closed.hook)
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.render', { component: 'PromptHint' }, () => HINT_DRAWN)
  on('session.messages', () => ({ value: [] }))
  mock.store(on, stored)

  return { runs, opened: opened.kept, closed: closed.kept, statuses, clock }
}
