import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../hooks/git'
import Fixtures from './fixtures'

tier('builtin')

describe('git', () => {
  test('each git child names the pin, in the C locale', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.oneSecret())

    await $.session.start(Fixtures.WORKTREE_SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.ui.render(Fixtures.PANE)
    await $.ui.press({ plugin: 'diff', key: 'ask' })
    await world.clock.settle()

    const [discovery, ...pinned] = world.runs
    const diffs = pinned.filter(run => run.argv.includes('diff'))

    expect(discovery?.argv).toContain('--show-toplevel')
    expect(discovery?.init?.cwd).toBeUndefined()
    expect(diffs.length).toBeGreaterThanOrEqual(3)

    for (const run of world.runs) {
      expect(run.init?.env).toEqual(Git.GIT_CHILD_ENV)
    }

    for (const run of pinned) {
      expect(run.argv.slice(0, Fixtures.PINNED_LEAD.length)).toEqual(
        Fixtures.PINNED_LEAD,
      )

      expect(run.init).toMatchObject({ cwd: '/main/wt' })
    }

    expect(world.runs.some(run => run.argv.includes('config'))).toBe(false)
  })
})
