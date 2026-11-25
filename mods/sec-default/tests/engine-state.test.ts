import type { Plugin } from 'claude-code/testing'
import { expect, test, tier } from 'claude-code/testing'

import Fixtures from './fixtures'

tier('prepend')

const PLUGINS: Plugin[] = [
  {
    name: 'mine',
    register(on) {
      on('session.start', async ($, e, next) => {
        const { value } = await $.state.get({ plugin: 'engine', key: 'mode' })

        $.ui.log(`read ${String(value)}`)

        return next(e)
      })
    },
  },
  {
    name: 'forging',
    register(on) {
      on('state.get', () => ({ value: { value: 'forged', version: 9 } }))
    },
  },
]

test(
  "a read of the engine's own values passes over a person's hooks",
  { plugins: PLUGINS },
  async ($, on) => {
    on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('state.get', { plugin: 'engine', key: 'mode' }, () => ({
      value: { value: 'plan', version: 1 },
    }))

    const lines = Fixtures.loggedBy(on)

    await $.session.start(Fixtures.SESSION)

    expect(lines).toEqual(['mine read plan'])
  },
)
