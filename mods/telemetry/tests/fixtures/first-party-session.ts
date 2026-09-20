import type { Args, On } from 'claude-code'
import { mock } from 'claude-code/testing'

import { ACCEPTED } from './accepted.js'
import { BEARER } from './bearer.js'
import { CONFIG_PATH } from './config-path.js'
import { GLOBAL_CONFIG } from './global-config.js'
import { LISTING } from './listing.js'
import { PROBED } from './probed.js'
import { REPO } from './repo.js'
import type { SentSession } from './sent-session.js'
import type { SessionOptions } from './session-options.js'

/**
 * Answers, beneath the plugins, everything the telemetry plugin reads of a
 * session signed in first party on a Mac in a git checkout, on a mock clock.
 *
 * Keeps what the plugin did: each post, file read, program run and debug
 * line, as it does it.
 *
 * @param on the test's `on`
 * @param options how this session differs from the plain one
 * @returns what the plugin did, and the clock
 */
export function firstPartySession(
  on: On,
  options: SessionOptions = {},
): SentSession {
  const posts: Args<'http.fetch'>[] = []
  const reads: string[] = []
  const runs: Args<'process.run'>[] = []
  const lines: string[] = []
  const clock = mock.clock(on)

  const files: Readonly<Record<string, string>> = {
    [CONFIG_PATH]: GLOBAL_CONFIG,
    ...options.files,
  }

  const answers = options.answers ?? [ACCEPTED]
  const authorizations = options.authorizations ?? [BEARER]

  let authorizeCalls = 0

  const isPolicyUnreadable = options.policy?.kind === 'unreadable'

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('session.id', () => ({ value: 'the-session' }))
  on('session.model', () => ({ value: 'the-model' }))
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.repo', () => ({ value: REPO }))
  on('fs.list', () => ({ value: LISTING }))

  on('session.authorize', () => {
    authorizeCalls += 1

    const answer =
      authorizations[Math.min(authorizeCalls, authorizations.length) - 1]

    const isRefused = answer === 'refused'

    return isRefused
      ? { deny: 'the credential store is locked' }
      : { value: answer === undefined ? BEARER : answer }
  })

  on('settings.read', () =>
    isPolicyUnreadable
      ? { deny: 'the managed settings file is unreadable' }
      : { value: options.policy?.settings ?? {} },
  )

  on('fs.read', ($, e) => {
    reads.push(e.path)

    const text = files[e.path]

    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })

  on('fs.exists', ($, e) => ({
    value: (options.existing ?? []).includes(e.path),
  }))

  const probed = { ...PROBED, stdout: options.probeOutput ?? PROBED.stdout }

  on('process.run', ($, e) => {
    runs.push(e)

    return { value: probed }
  })

  on('http.fetch', ($, e) => {
    posts.push(e)

    return {
      value: answers[Math.min(posts.length, answers.length) - 1] ?? ACCEPTED,
    }
  })

  on('ui.log', ($, e) => {
    if (e.to === 'debug') {
      lines.push(e.text)
    }

    return { value: undefined }
  })

  return { posts, reads, runs, lines, clock }
}
