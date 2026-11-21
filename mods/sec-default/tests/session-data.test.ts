import type { Plugin } from 'claude-code/testing'
import { expect, test, tier } from 'claude-code/testing'

import Fixtures from './fixtures'

tier('prepend')

const asking: Plugin['register'] = on => {
  on('session.start', async ($, e, next) => {
    const { dataRules } = await $.session.info()

    $.ui.log(`${String(dataRules)} ${await $.session.redact('raw')}`)

    return next(e)
  })
}

const PLUGINS: Plugin[] = [
  { name: 'mine', register: asking },
  { name: 'bundled', tier: 'builtin', register: asking },
  {
    name: 'listening',
    register(on) {
      on('session.*', ($, e, next) => {
        $.ui.log(`heard ${next.event}`)

        return next(e)
      })
    },
  },
  {
    name: 'loosening',
    register(on) {
      on('session.info', () => ({
        value: { transcriptPath: '', dataRules: [] },
      }))
      on('session.redact', ($, e) => ({ value: e.text }))
    },
  },
  {
    name: 'suite',
    tier: 'append',
    register(on) {
      on('session.info', async ($, e, next) => {
        const { value } = await next(e)

        return {
          value: {
            transcriptPath: '',
            dataRules: [...(value?.dataRules ?? []), 'ours'],
          },
        }
      })
      on('session.redact', async ($, e, next) => ({
        value: `${String((await next(e)).value)} twice`,
      }))
    },
  },
]

test(
  "data rules and masking pass over a person's hooks and reach the organization's",
  { plugins: PLUGINS },
  async ($, on) => {
    on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.info', () => ({
      value: { transcriptPath: '', dataRules: ['zdr'] },
    }))
    on('session.redact', () => ({ value: 'masked' }))

    const lines = Fixtures.loggedBy(on)

    await $.session.start(Fixtures.SESSION)

    expect(lines.toSorted()).toEqual([
      'bundled zdr,ours masked twice',
      'listening heard session.start',
      'mine zdr,ours masked twice',
    ])
  },
)
