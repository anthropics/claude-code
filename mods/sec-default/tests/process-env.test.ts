import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'
import Fixtures from './fixtures'

tier('prepend')

describe('process-env', () => {
  const plugins = [
    Fixtures.startingWith('suite', 'prepend'),
    Fixtures.startingWith('mine'),
    Fixtures.startingWith('bundled', 'builtin'),
    Fixtures.startingWith('audit', 'append'),
  ]
  const started = (...names: string[]) =>
    names.flatMap(name => [`${name} run`, `${name} spawn`]).toSorted()
  const sessionOf = (env: object) => ({
    ...Fixtures.SESSION,
    cwd: JSON.stringify(env),
  })

  for (const name of [
    'CORP_PROXY',
    'corp_proxy',
    'LD_PRELOAD',
    'HTTPS_PROXY',
    'AWS_PROFILE',
  ]) {
    test(
      `a null on ${name} is refused to a plugin of the person alone`,
      { plugins },
      async ($, on) => {
        on('settings.read', () => ({ value: Fixtures.PINNING_POLICY }))
        on('env.get', ($, e) => ({
          value: e.name === 'CLAUDE_CODE_USE_BEDROCK' ? '1' : undefined,
        }))

        const lines = Fixtures.loggedBy(on)
        const processes = Fixtures.processesStarted(on)

        await $.session.start(sessionOf({ GIT_DIR: null, [name]: null }))

        expect(processes.toSorted()).toEqual(
          started('audit', 'bundled', 'suite'),
        )
        expect(lines).toHaveLength(2)

        for (const line of lines) {
          expect(line).toContain(Hooks.pinnedVariableRefusal(name))
        }
      },
    )
  }

  for (const env of [
    { GIT_DIR: null, AWS_PROFILE: null },
    { CORP_PROXY: 'mine' },
  ]) {
    test(`${JSON.stringify(env)} passes`, { plugins }, async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.PINNING_POLICY }))
      on('env.get', () => ({ value: undefined }))

      const processes = Fixtures.processesStarted(on)

      await $.session.start(sessionOf(env))

      expect(processes.toSorted()).toEqual(
        started('audit', 'bundled', 'mine', 'suite'),
      )
    })
  }

  for (const [env, names] of [
    [{ GIT_DIR: null }, ['audit', 'bundled', 'suite']],
    [{ GIT_DIR: 'mine' }, ['audit', 'bundled', 'mine', 'suite']],
  ] satisfies [object, string[]][]) {
    test(
      `with no policy to read every name is pinned: ${JSON.stringify(env)}`,
      { plugins },
      async ($, on) => {
        const stopPolicy = Fixtures.policyUntilStopped(
          on,
          Fixtures.PINNING_POLICY,
          'unreadable',
        )

        on('prompt.section', ($, e) => ({ text: e.text }))
        on('env.get', () => ({ value: undefined }))
        Fixtures.logged(on)

        const processes = Fixtures.processesStarted(on)

        await $.prompt.section(Fixtures.MEMORY)
        stopPolicy()
        await $.session.start(sessionOf(env))

        expect(processes.toSorted()).toEqual(started(...names))
      },
    )
  }
})
