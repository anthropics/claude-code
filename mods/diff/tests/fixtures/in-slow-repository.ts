import type { Args, On } from 'claude-code'
import { mock } from 'claude-code/testing'

import { gitIn } from './git-in.js'
import { HINT_DRAWN } from './hint-drawn.js'
import { keeping } from './keeping.js'
import { REPOSITORY } from './repository.js'
import { startsSession } from './starts-session.js'

/**
 * A session in a repository as inRepository keeps one, where git takes a
 * millisecond of the clock to answer each `--numstat`: time for a test to
 * land an edit or a `/clear` while the diff is being read.
 *
 * What git answers is settled as the read starts, from the script as it
 * stands then.
 *
 * @param on the test's `on`
 * @param script git's output for each invocation whose line holds the key
 * @returns the clock's time as each read started, the panes opened, the
 *   clock
 */
export function inSlowRepository(
  on: On,
  script: Readonly<Record<string, string>> = REPOSITORY,
) {
  const reads: number[] = []
  const opened = keeping<Args<'ui.open'>>()
  const clock = startsSession(on)

  on('process.run', async ($, e) => {
    const value = gitIn(e.argv, script)

    if (e.argv.includes('--numstat')) {
      reads.push(await clock.now())
      await clock.sleep(1)
    }

    return { value }
  })

  on('ui.open', opened.hook)
  on('ui.close', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.render', { component: 'PromptHint' }, () => HINT_DRAWN)
  on('session.messages', () => ({ value: [] }))
  mock.store(on, {})

  return { reads, opened: opened.kept, clock }
}
