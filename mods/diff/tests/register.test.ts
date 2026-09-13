import type { Args } from 'claude-code'
import { describe, expect, mock, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import Names from '../hooks/names'
import Fixtures from './fixtures'

tier('builtin')

describe('register', () => {
  test('/diff at boot joins the boot probe, then asks again', async ($, on) => {
    const probes: (readonly string[])[] = []
    const clock = Fixtures.startsSession(on)

    on('process.run', async ($, e) => {
      probes.push(e.argv)

      if (probes.length === 1) {
        await clock.sleep(Limits.GIT_TIMEOUT_MS)

        return { deny: Fixtures.GIT_HUNG }
      }

      return { value: Fixtures.NOT_A_REPOSITORY }
    })

    const booting = $.session.start(Fixtures.SESSION)

    await clock.settle()

    const ran = $.command.run(Fixtures.DIFF)

    await clock.settle()

    expect(probes, 'the boot probe, which /diff joined').toHaveLength(1)

    await clock.advance(Limits.GIT_TIMEOUT_MS)
    await booting

    expect(await ran).toEqual({
      text: expect.stringContaining("isn't in a git repository"),
    })

    expect(probes, 'then one more of its own').toHaveLength(2)
  })

  test('outside a repository /diff says so, opens nothing', async ($, on) => {
    const opened: string[] = []

    Fixtures.startsSession(on)
    on('process.run', () => ({ value: Fixtures.NOT_A_REPOSITORY }))

    on('ui.open', ($, e, next) => {
      opened.push(e.id)

      return next(e)
    })

    await $.session.start(Fixtures.SESSION)

    const { text } = await $.command.run(Fixtures.DIFF)

    expect(text).toContain("isn't in a git repository")
    expect(opened).toEqual([])
  })

  test('a git that never answers is not "no repository"', async ($, on) => {
    Fixtures.startsSession(on)
    on('process.run', () => ({ deny: Fixtures.GIT_HUNG }))

    await $.session.start(Fixtures.SESSION)

    const { text } = await $.command.run(Fixtures.DIFF)

    expect(text).toContain("git didn't answer")
  })

  test('when the built-in holds /diff, the mod stands down', async ($, on) => {
    const logged: string[] = []

    mock.clock(on)
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ deny: Fixtures.BUILTIN_HOLDS }))
    on('command.run', () => ({ text: 'the built-in /diff ran' }))

    on('ui.log', ($, e) => {
      logged.push(e.text)

      return { value: undefined }
    })

    await $.session.start(Fixtures.SESSION)

    expect(await $.command.run(Fixtures.DIFF)).toEqual({
      text: 'the built-in /diff ran',
    })

    expect(logged).toEqual([])
  })

  test('a refusal the built-in did not cause is said aloud', async ($, on) => {
    const logged: string[] = []

    mock.clock(on)
    on('session.start', ($, e) => ({ cwd: e.cwd }))

    on('command.register', () => ({
      deny: '32 commands are registered already',
    }))

    on('ui.log', ($, e) => {
      logged.push(e.text)

      return { value: undefined }
    })

    await $.session.start(Fixtures.SESSION)

    expect(logged).toEqual([
      'could not register /diff: diff: $.command.register: 32 commands are ' +
        'registered already; the diff panel is unavailable this session',
    ])
  })

  test('/diff opens the pane over the session changes', async ($, on) => {
    const world = Fixtures.inRepository(on)

    await $.session.start(Fixtures.SESSION)

    expect(await $.command.run(Fixtures.DIFF)).toEqual({})
    expect(world.opened.map(pane => pane.id)).toEqual(['diff'])

    await world.clock.advance(Fixtures.SETTLE_MS)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(drawn).toContain('1 file changed')
    expect(drawn).toContain('app.ts')
  })

  test('the close button closes the pane; /diff reopens it', async ($, on) => {
    const world = Fixtures.inRepository(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.ui.render(Fixtures.PANE)

    expect(await $.ui.press({ plugin: 'diff', key: 'close' })).toEqual({
      element: 'close',
    })

    await world.clock.settle()

    expect(world.closed.map(pane => pane.id)).toEqual(['diff'])
    expect(await $.command.run(Fixtures.DIFF)).toEqual({})
    expect(world.opened.map(pane => pane.id)).toEqual(['diff', 'diff'])
  })

  test('a wide terminal opens the pane at the first edit', async ($, on) => {
    const world = Fixtures.inRepository(on)

    on('tool.call', () => ({ result: 'edited' }))

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.HINT)

    await $.tool.call({
      tool: 'Edit',
      file_path: '/work/app.ts',
      old_string: '1',
      new_string: '2',
    })

    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.opened.map(pane => pane.id)).toEqual(['diff'])
  })

  test('/clear closes the pane it finds open', async ($, on) => {
    const world = Fixtures.inRepository(on)

    on('command.run', { command: 'clear' }, () => ({}))

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await $.command.run(Fixtures.CLEAR)

    expect(world.closed.map(pane => pane.id)).toEqual(['diff'])
  })

  test('ask attaches the hunks on screen and calls no tool', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.oneSecret())
    const called: Args<'tool.call'>[] = []

    on('tool.call', ($, e) => {
      called.push(e)

      return { result: 'called' }
    })

    on('prompt.submit', ($, e) => ({ text: e.text, context: e.context }))

    await $.session.start(Fixtures.WORKTREE_SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.ui.render(Fixtures.PANE)
    await $.ui.press({ plugin: 'diff', key: 'ask' })
    await world.clock.settle()

    const armed = Fixtures.jsonOf(await $.ui.render(Fixtures.PANE))

    const submitted = await $.prompt.submit(Fixtures.typedPromptOf('why?'))

    expect(armed).toContain('asked ✓')
    expect(called).toEqual([])

    expect(world.statuses.at(-2)).toBe(
      '.env rides your next prompt (press asked ✓ to drop it)',
    )

    expect(submitted).toMatchObject({
      context: [
        'The user attached the diff of .env from the diff pane to this ' +
          'prompt:\n@@ -1 +1 @@\n-KEY=old\n+KEY=new',
      ],
    })
  })

  test('an ask with no room in the context is dropped', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.oneSecret())
    const full = 'x'.repeat(Limits.PROMPT_CONTEXT_MAX_CHARS)
    const reached: (readonly string[] | undefined)[] = []

    on('prompt.submit', ($, e) => {
      reached.push(e.context)

      return { text: e.text }
    })

    await $.session.start(Fixtures.WORKTREE_SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.ui.render(Fixtures.PANE)
    await $.ui.press({ plugin: 'diff', key: 'ask' })
    await world.clock.settle()

    await $.prompt.submit(Fixtures.typedPromptOf('why?', [full]))
    await $.prompt.submit(Fixtures.typedPromptOf('and now?'))

    expect(reached).toEqual([[full], undefined])

    expect(world.statuses.at(-1)).toBe(
      ".env's diff did not fit in the prompt and was dropped",
    )
  })

  test('a worktree opens on the base it kept', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.oneSecret(), {
      'base:/main/wt': 'uncommitted',
    })

    await $.session.start(Fixtures.WORKTREE_SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    const base = Fixtures.elementIn(await $.ui.render(Fixtures.PANE), {
      type: 'Select',
      name: 'base',
    })

    expect(base?.props).toMatchObject({ value: 'uncommitted' })
  })

  test('a repository made later is pinned once, on /diff', async ($, on) => {
    const { 'rev-parse --path-format=absolute': worktree = '', ...notYet } =
      Fixtures.oneSecret()

    const script: Record<string, string> = notYet
    const world = Fixtures.inRepository(on, script)

    await $.session.start(Fixtures.WORKTREE_SESSION)

    const before = await $.command.run(Fixtures.DIFF)

    script['rev-parse --path-format=absolute'] = worktree

    const after = await $.command.run(Fixtures.DIFF)

    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.ui.render(Fixtures.PANE)

    script['rev-parse --path-format=absolute'] = Fixtures.ELSEWHERE_LINES

    const third = $.command.run(Fixtures.DIFF)

    await world.clock.advance(Fixtures.SETTLE_MS)
    await third

    const probes = world.runs.filter(run =>
      run.argv.includes('--show-toplevel'),
    )

    expect(before.text).toContain("isn't in a git repository")
    expect(after).toEqual({})
    expect(world.opened[0]?.id).toBe('diff')
    expect(probes).toHaveLength(3)

    expect(
      world.runs.some(run => run.argv.includes('--git-dir=/else/.git')),
    ).toBe(false)

    expect(
      world.runs
        .filter(run => run.argv.includes('--numstat'))
        .every(run => run.argv[1] === Fixtures.PINNED_LEAD[1]),
    ).toBe(true)
  })

  test('a repository that appears later opens on first edit', async ($, on) => {
    const { 'rev-parse --path-format=absolute': worktree = '', ...notYet } =
      Fixtures.oneSecret()

    const script: Record<string, string> = notYet
    const world = Fixtures.inRepository(on, script)

    on('tool.call', () => ({ result: 'edited' }))

    await $.session.start(Fixtures.WORKTREE_SESSION)
    await $.ui.render(Fixtures.HINT)

    script['rev-parse --path-format=absolute'] = worktree

    await $.tool.call({
      tool: 'Edit',
      file_path: '/main/wt/.env',
      old_string: 'old',
      new_string: 'new',
    })

    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.opened.map(pane => pane.id)).toEqual(['diff'])
  })

  test('a git that cannot start is an answer, not a timeout', async ($, on) => {
    const runs: Args<'process.run'>[] = []

    Fixtures.startsSession(on)

    on('process.run', ($, e) => {
      runs.push(e)

      return e.argv.includes('--show-toplevel')
        ? { deny: Fixtures.FAILED_START }
        : { value: Fixtures.gitIn(e.argv, Fixtures.oneSecret()) }
    })

    await $.session.start(Fixtures.WORKTREE_SESSION)

    const { text } = await $.command.run(Fixtures.DIFF)
    const probes = runs.filter(run => run.argv.includes('--show-toplevel'))

    expect(text).toContain("isn't in a git repository")
    expect(probes, "the boot's, then this /diff's; no retry").toHaveLength(2)
  })

  test('/diff on a narrow terminal: the resize line', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.oneSecret())

    await $.session.start(Fixtures.WORKTREE_SESSION)
    await $.ui.render(Fixtures.hintAt(Limits.OPEN_MIN_COLUMNS - 1))

    const narrow = await $.command.run(Fixtures.DIFF)
    const openedNarrow = [...world.opened]

    await $.ui.render(Fixtures.hintAt(Limits.OPEN_MIN_COLUMNS))
    await $.command.run(Fixtures.DIFF)

    expect(narrow.text).toContain(
      'Resize your terminal to at least 110 columns to show the diff panel',
    )

    expect(openedNarrow).toEqual([])
    expect(world.opened.map(pane => pane.id)).toEqual([Names.PANE_ID])
  })
})
