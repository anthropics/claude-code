import type { Args, ResultOf, SessionMessage } from 'claude-code'
import { describe, expect, mock, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import Names from '../hooks/names'
import Fixtures from './fixtures'

tier('builtin')

describe('register', () => {
  test('the start asks nothing of git and registers /diff', async ($, on) => {
    const world = Fixtures.inRepository(on)

    await $.session.start(Fixtures.SESSION)

    expect(world.runs, "no git, as the built-in's start runs none").toEqual([])

    expect(await $.command.run(Fixtures.DIFF), '/diff was registered').toEqual({
      text: 'Diff panel shown',
    })
  })

  test("git runs at the built-in's moments and no others", async ($, on) => {
    const world = Fixtures.inRepository(on)

    let read = 0

    function spawnedSince(): string[] {
      const words = world.runs
        .slice(read)
        .map(run => Fixtures.gitWordOf(run.argv))
        .filter(word => word !== Fixtures.POLL_WORD)

      read = world.runs.length

      return words
    }

    const edit = () =>
      $.tool.call({
        tool: 'Edit',
        file_path: '/work/app.ts',
        old_string: '1',
        new_string: '2',
      })

    on('tool.call', () => ({ result: 'done' }))
    on('turn.complete', ($, e) => ({ text: e.answer }))
    on('command.run', { command: 'clear' }, () => ({}))

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.hintAt(Limits.AUTO_OPEN_MIN_COLUMNS - 1))
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(spawnedSince(), 'the start and the footer: nothing').toEqual([])

    await edit()
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      spawnedSince(),
      'an edit with no room for a pane: nothing, the width is read first',
    ).toEqual([])

    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(spawnedSince(), '/diff: found, then one fetch for the pane').toEqual(
      [
        'rev-parse --show-toplevel',
        'status',
        'diff --shortstat',
        'diff --numstat',
        'ls-files',
        'diff -- app.ts',
      ],
    )

    await edit()
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(spawnedSince(), 'an edit, the pane open: one fetch').toEqual([
      'diff --shortstat',
      'diff --numstat',
      'ls-files',
      'diff -- app.ts',
    ])

    await $.tool.call({ tool: 'Bash', command: 'make' })
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(spawnedSince(), 'a shell command, the pane open: one fetch').toEqual(
      ['diff --shortstat', 'diff --numstat', 'ls-files', 'diff -- app.ts'],
    )

    await $.turn.complete({
      answer: 'done',
      durationMs: 1,
      isAborted: false,
      turnId: 't1',
      reason: 'answer',
    })

    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(spawnedSince(), "a turn's end: nothing").toEqual([])

    await $.command.run(Fixtures.DIFF)
    await edit()
    await $.tool.call({ tool: 'Bash', command: 'make' })
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(spawnedSince(), 'the pane closed by hand: nothing').toEqual([])

    await $.command.run(Fixtures.CLEAR)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(spawnedSince()[0], '/clear forgot the repository').toBe(
      'rev-parse --show-toplevel',
    )
  })

  test('/diff whose probe never answers probes once more', async ($, on) => {
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

    await $.session.start(Fixtures.SESSION)

    const ran = $.command.run(Fixtures.DIFF)

    await clock.settle()

    expect(probes, "this /diff's probe, unanswered yet").toHaveLength(1)

    await clock.advance(Limits.GIT_TIMEOUT_MS)

    expect(await ran).toEqual({
      text: expect.stringContaining("isn't in a git repository"),
    })

    expect(probes, 'then one more, which answered').toHaveLength(2)
  })

  test('two /diff typed together probe the repository once', async ($, on) => {
    const world = Fixtures.inRepository(on)

    await $.session.start(Fixtures.SESSION)

    const [first, second] = await Promise.all([
      $.command.run(Fixtures.DIFF),
      $.command.run(Fixtures.DIFF),
    ])

    const probes = world.runs.filter(run =>
      run.argv.includes('--show-toplevel'),
    )

    expect(first.text).toMatch(/^Diff panel (shown|hidden)$/)
    expect(second.text).toMatch(/^Diff panel (shown|hidden)$/)
    expect(probes, 'the second joined the probe in flight').toHaveLength(1)
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
    const runs: Args<'process.run'>[] = []

    mock.clock(on)
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ deny: Fixtures.BUILTIN_HOLDS }))
    on('command.run', () => ({ text: 'the built-in /diff ran' }))
    on('tool.call', () => ({ result: 'edited' }))

    on('process.run', ($, e) => {
      runs.push(e)

      return { value: Fixtures.gitIn(e.argv) }
    })

    on('ui.log', ($, e) => {
      logged.push(e.text)

      return { value: undefined }
    })

    await $.session.start(Fixtures.SESSION)

    expect(await $.command.run(Fixtures.DIFF)).toEqual({
      text: 'the built-in /diff ran',
    })

    await $.tool.call({
      tool: 'Edit',
      file_path: '/work/app.ts',
      old_string: '1',
      new_string: '2',
    })

    expect(logged).toEqual([])
    expect(runs, 'idle: no git for /diff or the edit').toEqual([])
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

  test('/diff opens the pane, unfocused, and says so', async ($, on) => {
    const world = Fixtures.inRepository(on)

    await $.session.start(Fixtures.SESSION)

    expect(world.runs, 'the start ran nothing').toEqual([])

    expect(await $.command.run(Fixtures.DIFF)).toEqual({
      text: 'Diff panel shown',
    })

    expect(world.runs[0]?.argv, '/diff found the repository first').toContain(
      '--show-toplevel',
    )

    expect(world.opened).toEqual([
      { id: 'diff', title: 'Diff', holdToasts: true },
    ])

    await world.clock.advance(Fixtures.SETTLE_MS)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(drawn).toContain('1 file changed')
    expect(drawn).toContain('app.ts')
  })

  test('off fullscreen, /diff opens the dialog, focused', async ($, on) => {
    const world = Fixtures.inRepository(on)

    await $.session.start(Fixtures.SESSION)

    expect(await $.command.run(Fixtures.DIALOG_DIFF)).toEqual({})

    expect(world.opened[0]).toEqual({
      id: 'diff',
      title: 'Diff',
      holdToasts: true,
      closeOnEscape: true,
      rows: expect.any(Number),
      focus: true,
    })

    expect(await $.command.run(Fixtures.DIALOG_DIFF)).toEqual({
      text: 'Diff dialog dismissed',
    })
  })

  test('/diff again closes the pane and says so', async ($, on) => {
    const world = Fixtures.inRepository(on)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)

    expect(await $.command.run(Fixtures.DIFF)).toEqual({
      text: 'Diff panel hidden',
    })

    expect(world.closed.map(pane => pane.id)).toEqual(['diff'])
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

  test('on the main screen the first edit opens nothing, and /diff still opens the dialog', async ($, on) => {
    const world = Fixtures.inRepository(on)

    on('tool.call', () => ({ result: 'edited' }))

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.MAIN_SCREEN_HINT)

    await $.tool.call({
      tool: 'Edit',
      file_path: '/work/app.ts',
      old_string: '1',
      new_string: '2',
    })

    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.opened, 'a pane there would be an unasked dialog').toEqual([])
    expect(world.runs, 'so nothing was asked of the repository').toEqual([])

    expect(await $.command.run(Fixtures.DIALOG_DIFF)).toEqual({})

    expect(
      world.opened[0],
      "the person's /diff opens the dialog, not dismisses one",
    ).toMatchObject({ id: 'diff', focus: true })
  })

  test('a surface that does not say whether it docks a pane opens nothing at the first edit', async ($, on) => {
    const world = Fixtures.inRepository(on)

    on('tool.call', () => ({ result: 'edited' }))

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.UNSAID_HINT)

    await $.tool.call({
      tool: 'Edit',
      file_path: '/work/app.ts',
      old_string: '1',
      new_string: '2',
    })

    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.opened, 'unknown is not a dock').toEqual([])

    await $.ui.render(Fixtures.HINT)

    await $.tool.call({
      tool: 'Edit',
      file_path: '/work/app.ts',
      old_string: '2',
      new_string: '3',
    })

    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      world.opened.map(pane => pane.id),
      'once a drawing says the layout docks, the next edit opens it',
    ).toEqual(['diff'])
  })

  test('an edit that failed or was refused opens nothing', async ($, on) => {
    const world = Fixtures.inRepository(on)

    const answers: ResultOf['tool.call'][] = [
      { isError: true, result: 'no such text' },
      { deny: 'not allowed' },
    ]

    const edit = () =>
      $.tool.call({
        tool: 'Edit',
        file_path: '/work/app.ts',
        old_string: '1',
        new_string: '2',
      })

    on('tool.call', () => answers.shift() ?? { result: 'edited' })

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.HINT)
    await edit()
    await edit()
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.opened, 'neither edit landed').toEqual([])
    expect(world.runs, 'so nothing asked after the repository').toEqual([])

    await edit()
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      world.opened.map(pane => pane.id),
      'the third did',
    ).toEqual(['diff'])
  })

  test("only the main loop's edit opens the pane", async ($, on) => {
    const world = Fixtures.inRepository(on)

    const edit = (agentId?: string) =>
      $.tool.call({
        tool: 'Write',
        file_path: '/work/app.ts',
        content: '2',
        ...(agentId !== undefined && { agentId }),
      })

    on('tool.call', () => ({ result: 'written' }))

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.HINT)
    await edit('a-explorer')
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.opened, 'the built-in checkpoints no subagent edit').toEqual(
      [],
    )

    expect(world.runs, 'so nothing was asked of the repository').toEqual([])

    await edit()
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      world.opened.map(pane => pane.id),
      "the main loop's",
    ).toEqual(['diff'])
  })

  test('checkpointing off in settings: edits open nothing', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      settings: { fileCheckpointingEnabled: false },
    })

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

    expect(world.opened, 'the built-in opens on a checkpoint alone').toEqual([])

    expect(world.runs, 'so nothing was asked of the repository').toEqual([])

    expect(await $.command.run(Fixtures.DIFF)).toEqual({
      text: 'Diff panel shown',
    })
  })

  test('checkpointing off by variable: edits open nothing', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      env: { CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING: 'true' },
    })

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

    expect(world.opened).toEqual([])
  })

  test('an open left waiting is withdrawn; /diff opens it', async ($, on) => {
    let isNarrow = true

    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      stored: { [Names.STORE_OPEN_KEY]: true },
      isLeftWaiting: () => isNarrow,
    })

    const edit = () =>
      $.tool.call({
        tool: 'Edit',
        file_path: '/work/app.ts',
        old_string: '1',
        new_string: '2',
      })

    on('tool.call', () => ({ result: 'edited' }))

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.hintAt(Limits.AUTO_OPEN_MIN_COLUMNS - 1))
    await edit()
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      world.waiting.map(pane => pane.id),
      'the edit opened',
    ).toEqual(['diff'])

    expect(
      world.closed.map(pane => pane.id),
      'and withdrew the pane the engine left waiting, so no resize seats it',
    ).toEqual(['diff'])

    expect(
      world.runs.map(run => Fixtures.gitWordOf(run.argv)).slice(0, 2),
      'the repository was found and read once before the open, as the ' +
        'built-in primes; nothing polls for a pane no one sees',
    ).toEqual(['rev-parse --show-toplevel', 'status'])

    expect(
      world.runs.map(run => Fixtures.gitWordOf(run.argv)),
      'no HEAD poll for a withdrawn pane',
    ).not.toContain(Fixtures.POLL_WORD)

    isNarrow = false

    expect(
      await $.command.run(Fixtures.diffAt(Limits.AUTO_OPEN_MIN_COLUMNS - 1)),
      '/diff opens it, where a pane believed open would have been hidden',
    ).toEqual({ text: 'Diff panel shown' })

    await $.command.run(Fixtures.diffAt(Limits.AUTO_OPEN_MIN_COLUMNS - 1))
    await edit()
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      world.opened.map(pane => pane.id),
      'closed by hand, no edit opens it again',
    ).toEqual(['diff'])
  })

  test('an unplaced open is tried again at the next edit', async ($, on) => {
    let isNarrow = true

    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      stored: { [Names.STORE_OPEN_KEY]: true },
      isLeftWaiting: () => isNarrow,
    })

    const edit = () =>
      $.tool.call({
        tool: 'Edit',
        file_path: '/work/app.ts',
        old_string: '1',
        new_string: '2',
      })

    on('tool.call', () => ({ result: 'edited' }))

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.hintAt(Limits.AUTO_OPEN_MIN_COLUMNS - 1))
    await edit()
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.opened, 'the first try waited and was withdrawn').toEqual([])

    isNarrow = false

    await edit()
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      world.opened.map(pane => pane.id),
      'the next edit opened it, as the built-in reads the width again then',
    ).toEqual(['diff'])
  })

  test('a docked pane opens once its first fetch settled', async ($, on) => {
    const opened: string[] = []
    const clock = Fixtures.startsSession(on)

    on('process.run', async ($, e) => {
      if (e.argv.includes('--shortstat')) {
        await clock.sleep(Fixtures.SLOW_DIFF_MS)
      }

      return { value: Fixtures.gitIn(e.argv) }
    })

    on('ui.open', ($, e) => {
      opened.push(e.id)

      return { value: undefined }
    })

    on('ui.close', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.render', { component: 'PromptHint' }, () => Fixtures.HINT_DRAWN)
    on('session.messages', () => ({ value: [] }))
    on('settings.read', () => ({ value: {} }))
    on('tool.call', () => ({ result: 'edited' }))
    mock.store(on)
    mock.env(on, {})

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.HINT)

    await $.tool.call({
      tool: 'Edit',
      file_path: '/work/app.ts',
      old_string: '1',
      new_string: '2',
    })

    await clock.advance(Fixtures.SLOW_DIFF_MS - 1)

    expect(opened, 'git has not answered: no pane, no Loading frame').toEqual(
      [],
    )

    await clock.advance(Fixtures.SETTLE_MS)

    expect(opened, 'the fetch settled: the pane opens filled').toEqual(['diff'])

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(drawn).toContain('1 file changed')
    expect(drawn).not.toContain('Loading diff')
  })

  test('/clear leaves the pane it finds open up and reads the repository afresh', async ($, on) => {
    const world = Fixtures.inRepository(on)

    on('command.run', { command: 'clear' }, () => ({}))

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    const read = world.runs.length

    await $.command.run(Fixtures.CLEAR)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.closed, 'as the built-in panel stays across /clear').toEqual(
      [],
    )

    expect(
      world.runs.slice(read).map(run => Fixtures.gitWordOf(run.argv))[0],
      'the repository found again for the conversation that starts over',
    ).toBe('rev-parse --show-toplevel')

    expect(
      Fixtures.textOf(await $.ui.render(Fixtures.PANE)),
      'drawn from the fresh read',
    ).toContain('1 file changed')
  })

  test('a resumed session whose turns edited opens the pane before any new edit', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      messages: () => Fixtures.EDITED_TRANSCRIPT,
    })

    await $.session.start(Fixtures.SESSION)

    expect(world.runs, 'the start itself still runs no git').toEqual([])

    await $.ui.render(Fixtures.HINT)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      world.opened.map(pane => pane.id),
      'open once the width is known, as the built-in opens on the restore',
    ).toEqual(['diff'])
  })

  test('a resumed session opens nothing where its first edit would not', async ($, on) => {
    const narrow = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      messages: () => Fixtures.EDITED_TRANSCRIPT,
    })

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.hintAt(Limits.AUTO_OPEN_MIN_COLUMNS - 1))
    await narrow.clock.advance(Fixtures.SETTLE_MS)

    expect(narrow.opened, 'under the unasked floor, never kept open').toEqual(
      [],
    )

    expect(narrow.runs, 'and no git for it').toEqual([])
  })

  test('a resumed session the person kept the pane open in opens it from the lower floor', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      messages: () => Fixtures.EDITED_TRANSCRIPT,
      stored: { [Names.STORE_OPEN_KEY]: true },
    })

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.hintAt(Limits.OPEN_MIN_COLUMNS))
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.opened.map(pane => pane.id)).toEqual(['diff'])
  })

  test('a resumed session with no edits opens nothing', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      messages: () => [Fixtures.promptOf('just talk')],
    })

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.HINT)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.opened).toEqual([])
    expect(world.runs).toEqual([])
  })

  test('a resumed session whose pane the person closed opens nothing', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      messages: () => Fixtures.EDITED_TRANSCRIPT,
      stored: { [Names.STORE_OPEN_KEY]: false },
    })

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.HINT)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.opened).toEqual([])
    expect(world.runs).toEqual([])
  })

  test('/resume closes the pane, then opens it for the turns it brought back', async ($, on) => {
    let transcript: readonly SessionMessage[] = []

    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      messages: () => transcript,
    })

    on('command.run', { command: 'resume' }, () => {
      transcript = Fixtures.EDITED_TRANSCRIPT

      return {}
    })

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.HINT)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.command.run(Fixtures.RESUME)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(world.closed.map(pane => pane.id), 'closed at /resume').toEqual([
      'diff',
    ])

    expect(
      world.opened.map(pane => pane.id),
      '/diff opened it, /resume opened it again for the restored turns',
    ).toEqual(['diff', 'diff'])
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
    await $.ui.press({ plugin: 'diff', key: 'ask:.env' })
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
    await $.ui.press({ plugin: 'diff', key: 'ask:.env' })
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
      stored: { 'base:/main/wt': 'uncommitted' },
    })

    await $.session.start(Fixtures.WORKTREE_SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      Fixtures.stringsOf(await $.ui.render(Fixtures.PANE)),
      "the built-in's base line under the header",
    ).toContain('uncommitted (vs HEAD)')
  })

  test('no repository is an answer kept until /clear', async ($, on) => {
    const { 'rev-parse --path-format=absolute': worktree = '', ...notYet } =
      Fixtures.oneSecret()

    const script: Record<string, string> = notYet
    const world = Fixtures.inRepository(on, script)

    const probesOf = () =>
      world.runs.filter(run => run.argv.includes('--show-toplevel')).length

    on('command.run', { command: 'clear' }, () => ({}))

    await $.session.start(Fixtures.WORKTREE_SESSION)

    const before = await $.command.run(Fixtures.DIFF)

    script['rev-parse --path-format=absolute'] = worktree

    const again = await $.command.run(Fixtures.DIFF)
    const probesKept = probesOf()

    await $.command.run(Fixtures.CLEAR)

    const after = await $.command.run(Fixtures.DIFF)

    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.ui.render(Fixtures.PANE)

    script['rev-parse --path-format=absolute'] = Fixtures.ELSEWHERE_LINES

    const third = $.command.run(Fixtures.DIFF)

    await world.clock.advance(Fixtures.SETTLE_MS)
    await third

    expect(before.text).toContain("isn't in a git repository")

    expect(again.text, "kept, as the built-in's answer is").toContain(
      "isn't in a git repository",
    )

    expect(probesKept, 'one probe answered both').toBe(1)
    expect(after.text, '/clear forgot it').toBe('Diff panel shown')
    expect(world.opened[0]?.id).toBe('diff')
    expect(probesOf(), 'then one more, pinned from there on').toBe(2)

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
    expect(probes, "this /diff's alone; no retry").toHaveLength(1)
  })

  test('/diff on a narrow terminal: the resize line', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.oneSecret())

    await $.session.start(Fixtures.WORKTREE_SESSION)

    const narrow = await $.command.run(
      Fixtures.diffAt(Limits.OPEN_MIN_COLUMNS - 1),
    )

    const openedNarrow = [...world.opened]

    await $.command.run(Fixtures.diffAt(Limits.OPEN_MIN_COLUMNS))

    expect(narrow.text).toContain(
      'Resize your terminal to at least 110 columns to show the diff panel',
    )

    expect(openedNarrow).toEqual([])
    expect(world.opened.map(pane => pane.id)).toEqual([Names.PANE_ID])
  })
})
