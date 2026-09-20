import { describe, expect, mock, test, tier } from 'claude-code/testing'

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
    await $.ui.press({ plugin: 'diff', key: 'ask:.env' })
    await world.clock.settle()

    const [discovery, ...pinned] = world.runs
    const diffs = pinned.filter(run => run.argv.includes('diff'))

    expect(discovery?.argv).toContain('--show-toplevel')

    expect(
      discovery?.init?.cwd,
      "found where the session started, wherever Claude's shell has gone",
    ).toBe('/main/wt')

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

  test('the working tree is walked once, by the first fetch', async ($, on) => {
    const world = Fixtures.inRepository(on)

    const walks = () =>
      world.runs.filter(run => Fixtures.gitWordOf(run.argv) === 'status')

    const fetches = () =>
      world.runs.filter(
        run => Fixtures.gitWordOf(run.argv) === 'diff --numstat',
      )

    on('tool.call', () => ({ result: 'ran' }))

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(walks(), 'the first fetch walked').toHaveLength(1)
    expect(fetches()).toHaveLength(1)

    await $.tool.call({ tool: 'Bash', command: 'make' })
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(fetches(), 'the command fetched again').toHaveLength(2)
    expect(walks(), 'and read the walk it had').toHaveLength(1)
    expect(walks()[0]?.init?.cwd, 'pinned like every child').toBe('/work')
  })

  test('a file moved in since the start is session work', async ($, on) => {
    const clock = Fixtures.startsSession(on, Fixtures.SETTLE_MS)

    on('process.run', ($, e) => ({
      value: Fixtures.gitIn(e.argv, Fixtures.MOVED_IN),
    }))

    on('ui.open', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }))
    Fixtures.oldFiles(on)
    mock.store(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await clock.advance(Fixtures.SETTLE_MS)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(drawn).toContain('1 file changed +1 -1')
    expect(drawn).toContain('moved.ts')
    expect(drawn).toContain('+1 file edited before this session (show)')
  })

  test("the session began when the engine says: a resumed one's first start, again at /clear", async ($, on) => {
    let startedAt = 0

    const clock = Fixtures.startsSession(on, Fixtures.SETTLE_MS)

    on('process.run', ($, e) => ({
      value: Fixtures.gitIn(e.argv, Fixtures.MOVED_IN),
    }))

    on('ui.open', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }))
    on('session.usage', () => ({ value: Fixtures.usageAt(startedAt) }))
    on('command.run', { command: 'clear' }, () => ({}))
    Fixtures.oldFiles(on)
    mock.store(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await clock.advance(Fixtures.SETTLE_MS)

    expect(
      Fixtures.textOf(await $.ui.render(Fixtures.PANE)),
      'resumed from before the old files were written: both are the ' +
        "session's, as the built-in restores its start",
    ).toContain('2 files changed +2 -2')

    startedAt = clock.now()

    await $.command.run(Fixtures.CLEAR)
    await clock.advance(Fixtures.SETTLE_MS)

    expect(
      Fixtures.textOf(await $.ui.render(Fixtures.PANE)),
      '/clear started the session over, past the dirty file',
    ).toContain('+1 file edited before this session (show)')
  })
})
