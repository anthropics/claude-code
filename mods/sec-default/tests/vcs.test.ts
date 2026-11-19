import { describe, expect, test, tier } from 'claude-code/testing'

import Fixtures from './fixtures'

tier('prepend')

describe('vcs', () => {
  const plugins = [Fixtures.owningCopies, Fixtures.refusingCopiesAsOrg]
  const entry = { hooks: [{ type: 'command', command: 'acme' }] }
  const copy = { path: '/mine', name: 'n', vcs: 'mine' }
  const isolating = { name: 'n', from: '/w', for: 'agent', base: 'head' } as const
  const releasing = { ...copy, isDiscard: false, reason: 'r' }

  for (const event of ['WorktreeCreate', 'WorktreeRemove']) {
    test(
      `under a managed ${event} hook a person's plugin overrides no refusal of the organization's`,
      { plugins },
      async ($, on) => {
        on('settings.read', () => ({ value: { hooks: { [event]: [entry] } } }))

        expect(await $.vcs.isolate(isolating)).toEqual({ deny: 'org' })
        expect(await $.vcs.list({ path: '/w' })).toEqual([])
        expect(await $.vcs.status(copy)).toEqual({ unknown: 'org' })
        expect(await $.vcs.release(releasing)).toEqual({ kept: 'org' })
      },
    )
  }

  test(
    'with no policy to read the events pass over the person as well',
    { plugins },
    async ($, on) => {
      const stopPolicy = Fixtures.policyUntilStopped(
        on,
        Fixtures.NO_ALLOWLIST,
        'unreadable',
      )

      on('prompt.section', ($, e) => ({ text: e.text }))

      await $.prompt.section(Fixtures.MEMORY)
      stopPolicy()

      expect(await $.vcs.isolate(isolating)).toEqual({ deny: 'org' })
      expect(await $.vcs.list({ path: '/w' })).toEqual([])
      expect(await $.vcs.status(copy)).toEqual({ unknown: 'org' })
      expect(await $.vcs.release(releasing)).toEqual({ kept: 'org' })
    },
  )

  for (const hooks of [undefined, { WorktreeCreate: [], Stop: [entry] }]) {
    test(
      `with managed hooks ${JSON.stringify(hooks)} the events reach a person's plugin`,
      { plugins },
      async ($, on) => {
        on('settings.read', () => ({ value: { hooks } }))

        expect(await $.vcs.isolate(isolating)).toEqual({
          path: '/mine',
          vcs: 'mine',
        })

        expect(await $.vcs.list({ path: '/w' })).toEqual([
          { path: '/mine', vcs: 'mine' },
        ])

        expect(await $.vcs.status(copy)).toEqual({
          changes: [],
          unpublished: 0,
        })

        expect(await $.vcs.release(releasing)).toEqual({ isReleased: true })
      },
    )
  }
})
