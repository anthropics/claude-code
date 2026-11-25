import type { On, RenderInput } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import Access from '../hooks/access'
import Limits from '../hooks/limits'
import Fixtures from './fixtures'

tier('builtin')

describe('access', () => {
  const DENIED = 'lib.ts is read-denied; its diff was not attached'
  const UNCHECKED = "Read permissions couldn't be checked"
  const UNSURE = "lib.ts's diff can't be attached from here"

  const denying =
    (...paths: string[]) =>
    (path: string) =>
      paths.includes(path) ? ('deny' as const) : ('allow' as const)

  /**
   * A session in /work, the pane opened by the command and settled; every
   * folder lists `beside`.
   */
  async function opened(
    $: Engine,
    on: On,
    beneath: Fixtures.Beneath,
    {
      script = Fixtures.TWO_FILES,
      command = Fixtures.DIFF,
      beside = [] as string[],
    } = {},
  ) {
    const world = Fixtures.inRepository(on, script, beneath)

    on('fs.list', () => ({
      value: beside.map(name => ({
        name,
        kind: 'file' as const,
        size: 2,
        mtimeMs: 0,
        isLink: false,
      })),
    }))

    on('tool.call', () => ({ result: 'done' }))
    on('prompt.submit', (_engine, e) => ({ text: e.text, context: e.context }))

    await $.session.start(Fixtures.SESSION)
    await $.command.run(command)
    await world.clock.advance(Fixtures.SETTLE_MS)

    return {
      world,
      beside,
      drawn: async (pane: RenderInput<'Pane'> = Fixtures.PANE) =>
        Fixtures.jsonOf(await $.ui.render(pane)),
      bodiesRead: () =>
        world.runs
          .filter(run => run.argv.includes('--raw'))
          .flatMap(run => run.argv.slice(run.argv.indexOf('--') + 1)),
      refresh: async () => {
        await $.tool.call({ tool: 'Bash', command: 'make' })
        await world.clock.advance(Fixtures.SETTLE_MS)
      },
      ask: async (path: string) => {
        await $.ui.render(Fixtures.PANE)
        await $.ui.press({ plugin: 'diff', key: `ask:${path}` })
        await world.clock.settle()
      },
      sent: async () =>
        (await $.prompt.submit(Fixtures.typedPromptOf('why?'))).context,
    }
  }

  test('docked, a denied row is counted, not listed or read', async ($, on) => {
    const pane = await opened($, on, { readOf: denying('/work/lib.ts') })
    const drawn = await pane.drawn()

    expect(drawn).toContain('app.ts')
    expect(drawn).toContain('2 files')
    expect(drawn).toContain('… 1 read-denied')
    expect(drawn).not.toContain('not shown')
    expect(drawn).not.toContain('lib.ts')
    expect(pane.bodiesRead()).toEqual(['app.ts'])
  })

  test('inline, a denied row is counted, not listed or read', async ($, on) => {
    const pane = await opened(
      $,
      on,
      { readOf: denying('/work/lib.ts') },
      { command: Fixtures.DIALOG_DIFF },
    )

    const drawn = await pane.drawn(Fixtures.INLINE_PANE)

    await pane.world.clock.advance(Fixtures.SETTLE_MS)

    expect(drawn).toContain('app.ts')
    expect(drawn).toContain('1 read-denied')
    expect(drawn).not.toContain('lib.ts')
    expect(pane.bodiesRead()).not.toContain('lib.ts')
  })

  test('with every row denied, both seats say so', async ($, on) => {
    const pane = await opened($, on, { readOf: () => 'deny' })

    for (const seat of [Fixtures.PANE, Fixtures.INLINE_PANE]) {
      const drawn = await pane.drawn(seat)

      expect(drawn).toContain('Only read-denied files changed')
      expect(drawn).toContain('2 read-denied')
      expect(drawn).not.toContain('Too many')
    }
  })

  test('a denied test file is not one the toggle offers', async ($, on) => {
    const pane = await opened(
      $,
      on,
      { readOf: denying('/work/a.test.ts') },
      {
        script: Fixtures.answersOf('1\t1\ta.test.ts\0' + '1\t1\tb.test.ts\0', {
          'a.test.ts': '@@ -1 +1 @@\n-a\n+b\n',
          'b.test.ts': '@@ -1 +1 @@\n-c\n+d\n',
        }),
      },
    )

    const drawn = await pane.drawn()

    expect(drawn).toContain('1 test/generated (show)')
    expect(drawn).toContain('Only hidden files changed')
  })

  test('a denied row from before the session is left out', async ($, on) => {
    on('fs.stat', () => ({
      value: { kind: 'file', size: 2, mtimeMs: 0, isLink: false },
    }))

    on('session.usage', () => ({ value: Fixtures.usageAt(1) }))

    const pane = await opened(
      $,
      on,
      { readOf: denying('/work/old.ts') },
      { script: Fixtures.MOVED_IN, beside: ['old.ts', 'moved.ts'] },
    )

    const drawn = await pane.drawn()

    expect(drawn).toContain('1 file')
    expect(drawn).toContain('1 read-denied')
    expect(drawn).not.toContain('before this session')
  })

  test('a rename is left out by either name', async ($, on) => {
    const denied = { path: '/work/docs/notes.txt' }

    const pane = await opened(
      $,
      on,
      { readOf: path => denying(denied.path)(path) },
      { script: Fixtures.RENAMED },
    )

    expect(await pane.drawn()).not.toContain('notes')

    denied.path = '/work/docs/renamed-notes.txt'
    await pane.refresh()

    expect(await pane.drawn()).not.toContain('notes')

    denied.path = ''
    await pane.refresh()

    expect(await pane.drawn()).toContain('notes')
  })

  test("a row is asked about under the current folder's top too", async ($, on) => {
    on('vcs.detect', (_engine, e) =>
      e.path === '/else/below'
        ? { ...Fixtures.ACME_COPY, vcs: 'git', root: '/else' }
        : null,
    )

    const pane = await opened($, on, {
      cwd: () => '/else/below',
      readOf: denying('/else/lib.ts'),
    })

    expect(await pane.drawn()).not.toContain('lib.ts')
  })

  test('a folder whose top is not told is asked about again', async ($, on) => {
    const top: { answer: () => Promise<null> } = {
      answer: () => Promise.reject(new Error('no answer')),
    }

    on('vcs.detect', () => top.answer())

    const pane = await opened($, on, {
      cwd: () => '/work/in/below',
      readOf: denying('/work/in/app.ts'),
    })

    expect(await pane.drawn()).toContain('1 read-denied')
    expect(await pane.drawn()).toContain('lib.ts')

    top.answer = () =>
      pane.world.clock.sleep(Limits.CHECK_TIMEOUT_MS * 9).then(() => null)

    await pane.refresh()
    await pane.world.clock.advance(Limits.CHECK_TIMEOUT_MS * 2)

    expect(await pane.drawn()).toContain(UNCHECKED)

    top.answer = async () => null
    await pane.world.clock.advance(Limits.HEAD_POLL_MS * 3)

    expect(await pane.drawn()).toContain('lib.ts')
  })

  test('with no top told, every folder up must answer', async ($, on) => {
    on('vcs.detect', () => Promise.reject(new Error('no answer')))

    const pane = await opened($, on, {
      cwd: () => '/work/in/below',
      landingOf: path => (/^\/work\/in.*\.ts$/.test(path) ? null : path),
      readOf: path =>
        path === '/work/in/app.ts'
          ? Promise.reject(new Error('no verdict'))
          : 'allow',
    })

    expect(await pane.drawn()).not.toContain('app.ts')

    await pane.ask('lib.ts')

    expect(await pane.sent(), 'and an ordinary ask rides').toHaveLength(1)
  })

  test('a start whose top is not told is not kept as none', async ($, on) => {
    on('vcs.detect', () => Promise.reject(new Error('no answer')))

    const world = Fixtures.inRepository(on, Fixtures.TWO_FILES, {
      readOf: denying('/work/below/lib.ts'),
    })

    await $.session.start({ ...Fixtures.SESSION, cwd: '/work/below' })
    await $.command.run(Fixtures.DIFF)

    expect(Fixtures.jsonOf(await $.ui.render(Fixtures.PANE))).toContain(
      '1 read-denied',
    )

    await world.clock.settle()
  })

  test("each path is asked once, under the tree's top", async ($, on) => {
    const asked: string[] = []

    on('vcs.detect', () => null)

    await opened($, on, {
      cwd: () => '/work/below',
      readOf: path => {
        asked.push(path)

        return 'allow'
      },
    })

    expect(asked.toSorted()).toEqual(['/work/app.ts', '/work/lib.ts'])
  })

  test("a picked turn's denied file is counted, not drawn", async ($, on) => {
    const pane = await opened($, on, {
      messages: () => Fixtures.EDITED_TRANSCRIPT,
      readOf: denying('/r/a.ts'),
    })

    const ui = await $.ui.mount({
      ...Fixtures.PANE,
      plugin: 'diff',
      surface: 'terminal',
    })

    await ui.select({ key: 'source', value: '1' })
    await pane.world.clock.settle()

    const picked = await pane.drawn()

    await pane.refresh()

    for (const drawn of [picked, await pane.drawn()]) {
      expect(drawn).toContain('Turn 1')
      expect(drawn).toContain('1 read-denied')
      expect(drawn).not.toContain('/r/a.ts')
    }
  })

  test('a turn being picked draws whatever else asks', async ($, on) => {
    const wait = { ms: 0 }

    const pane = await opened($, on, {
      messages: () => Fixtures.EDITED_TRANSCRIPT,
      readOf: async path => {
        const isDenied = wait.ms > 0 && path === '/work/lib.ts'

        await (wait.ms > 0 &&
          pane.world.clock.sleep(isDenied ? wait.ms / 2 : wait.ms))

        return isDenied ? 'deny' : 'allow'
      },
    })

    const ui = await $.ui.mount({
      ...Fixtures.PANE,
      plugin: 'diff',
      surface: 'terminal',
    })

    wait.ms = Limits.CHECK_TIMEOUT_MS - 1
    await pane.ask('lib.ts')
    await ui.select({ key: 'source', value: '1' })
    await pane.world.clock.advance(Limits.CHECK_TIMEOUT_MS * 2)

    expect(await pane.drawn()).toContain('/r/a.ts')

    wait.ms = 0
    await $.command.run(Fixtures.DIFF)
    wait.ms = Limits.CHECK_TIMEOUT_MS - 1

    const reopened = $.command.run(Fixtures.DIFF)

    await pane.world.clock.settle()

    expect(await pane.drawn(), 'nor shows it unasked').not.toContain('/r/a.ts')
    expect(await pane.drawn()).toContain('Loading diff')

    await pane.world.clock.advance(Limits.CHECK_TIMEOUT_MS * 2)
    await reopened
  })

  test('a turn has no ask and keeps the armed file', async ($, on) => {
    const pane = await opened($, on, {
      messages: () => Fixtures.EDITED_TRANSCRIPT,
    })

    await pane.ask('lib.ts')

    const ui = await $.ui.mount({
      ...Fixtures.PANE,
      plugin: 'diff',
      surface: 'terminal',
    })

    await ui.select({ key: 'source', value: '1' })
    await pane.world.clock.settle()

    const docked = await pane.drawn()

    await pane.drawn(Fixtures.INLINE_PANE)
    await $.ui.press({ plugin: 'diff', key: 'file:/r/a.ts' })

    for (const drawn of [docked, await pane.drawn(Fixtures.INLINE_PANE)]) {
      expect(drawn).toContain('/r/a.ts')
      expect(drawn).not.toContain('ask:')
    }

    expect(String(await pane.sent())).toContain('diff of lib.ts')
  })

  test('a poll does not put off a late answer', async ($, on) => {
    const late = { isOn: false }

    const pane = await opened($, on, {
      messages: () => Fixtures.EDITED_TRANSCRIPT,
      readOf: async () => {
        await (late.isOn && pane.world.clock.sleep(Limits.CHECK_TIMEOUT_MS * 9))

        return 'allow' as const
      },
    })

    const ui = await $.ui.mount({
      ...Fixtures.PANE,
      plugin: 'diff',
      surface: 'terminal',
    })

    await pane.world.clock.settle()
    late.isOn = true
    await ui.select({ key: 'source', value: '1' })
    await pane.world.clock.advance(Limits.CHECK_TIMEOUT_MS)

    expect(await pane.drawn()).toContain('Turn 1')
  })

  test('a dialog reopened with no answer says so at once', async ($, on) => {
    const wait = { ms: 0 }

    const pane = await opened(
      $,
      on,
      {
        messages: async () => {
          await (wait.ms > 0 && pane.world.clock.sleep(wait.ms))

          return []
        },
        readOf: () => Promise.reject(new Error('no verdict')),
      },
      { command: Fixtures.DIALOG_DIFF },
    )

    await $.command.run(Fixtures.DIALOG_DIFF)
    wait.ms = Fixtures.SETTLE_MS
    await $.command.run(Fixtures.DIALOG_DIFF)

    expect(await pane.drawn(Fixtures.INLINE_PANE)).toContain(UNCHECKED)

    await pane.world.clock.advance(wait.ms)
  })

  test('nothing opens or draws before the answers', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      readOf: () =>
        world.clock
          .sleep(Limits.CHECK_TIMEOUT_MS / 2)
          .then(() => 'deny' as const),
    })

    on('tool.call', () => ({ result: 'done' }))

    await $.session.start(Fixtures.SESSION)
    await $.ui.render(Fixtures.HINT)
    await $.tool.call({ tool: 'Edit', file_path: '/work/app.ts' })
    await world.clock.settle()

    expect(world.opened).toEqual([])

    expect(Fixtures.jsonOf(await $.ui.render(Fixtures.PANE))).not.toContain(
      'app.ts',
    )

    await world.clock.advance(Limits.CHECK_TIMEOUT_MS)

    expect(world.opened).toHaveLength(1)

    expect(Fixtures.jsonOf(await $.ui.render(Fixtures.PANE))).not.toContain(
      'app.ts',
    )

    expect(world.runs.some(run => run.argv.includes('--raw'))).toBe(false)
  })

  test('a reopened dialog asks again before it draws', async ($, on) => {
    const denied: string[] = []

    const pane = await opened(
      $,
      on,
      { readOf: path => denying(...denied)(path) },
      { command: Fixtures.DIALOG_DIFF },
    )

    const withBoth = Number(pane.world.opened.at(-1)?.rows)

    await $.command.run(Fixtures.DIALOG_DIFF)
    denied.push('/work/lib.ts')
    await $.command.run(Fixtures.DIALOG_DIFF)

    expect(pane.world.opened.findLast(one => one.focus)?.rows).toBe(
      withBoth - 1,
    )
  })

  test('a failed or late answer hides the row until one comes', async ($, on) => {
    const lib: { answer: () => Promise<'allow'> } = {
      answer: () => Promise.reject(new Error('no verdict')),
    }

    const pane = await opened($, on, {
      readOf: path => (path === '/work/lib.ts' ? lib.answer() : 'allow'),
    })

    await pane.world.clock.advance(Limits.HEAD_POLL_MS * 4)

    for (const seat of [Fixtures.PANE, Fixtures.INLINE_PANE]) {
      const drawn = await pane.drawn(seat)

      expect(drawn).not.toContain('lib.ts')
      expect(drawn).not.toContain('read-denied')
      expect(drawn).toContain('1 not shown')
      expect(drawn, 'nor its lines').not.toContain('+3')
    }

    lib.answer = () => Promise.resolve('allow')
    await pane.world.clock.advance(Limits.HEAD_POLL_MS)

    expect(await pane.drawn()).toContain('lib.ts')

    lib.answer = () =>
      pane.world.clock
        .sleep(Limits.CHECK_TIMEOUT_MS * 2)
        .then(() => 'allow' as const)

    await pane.refresh()
    await pane.world.clock.advance(Limits.CHECK_TIMEOUT_MS)

    expect(await pane.drawn()).not.toContain('lib.ts')
  })

  test('with no row answered for, both seats say so', async ($, on) => {
    const pane = await opened($, on, {
      messages: () => Fixtures.EDITED_TRANSCRIPT,
      readOf: () => Promise.reject(new Error('no verdict')),
    })

    const ui = await $.ui.mount({
      ...Fixtures.PANE,
      plugin: 'diff',
      surface: 'terminal',
    })

    for (const value of ['current', '1']) {
      await ui.select({ key: 'source', value })
      await pane.world.clock.settle()

      for (const seat of [Fixtures.PANE, Fixtures.INLINE_PANE]) {
        const drawn = await pane.drawn(seat)

        expect(drawn).toContain(UNCHECKED)
        expect(drawn).not.toContain('read-denied')
      }
    }
  })

  test('a deny of the whole tool hides no row', async ($, on) => {
    on('tool.check', { tool: 'Grep' }, () => ({ decision: 'allow' }))

    const pane = await opened($, on, { readOf: () => 'off' })

    expect(await pane.drawn()).toContain('lib.ts')

    await pane.ask('lib.ts')

    expect(pane.world.statuses.at(-1)).toBe(UNSURE)
  })

  test('a changed rule is met without a refresh', async ($, on) => {
    const deny: string[] = []

    const pane = await opened($, on, {
      settings: { permissions: { deny } },
      readOf: path => denying(...deny)(path),
    })

    await pane.world.clock.advance(Limits.HEAD_POLL_MS * 4)
    deny.push('/work/lib.ts')
    await pane.world.clock.advance(Limits.HEAD_POLL_MS)

    expect(await pane.drawn()).not.toContain('lib.ts')

    deny.pop()
    await pane.world.clock.advance(Limits.HEAD_POLL_MS)
    expect(await pane.drawn()).toContain('lib.ts')
  })

  test('a rule that takes hold late is met a tick later', async ($, on) => {
    const deny: string[] = []
    const held: string[] = []

    const pane = await opened($, on, {
      settings: { permissions: { deny } },
      readOf: path => denying(...held)(path),
    })

    await pane.world.clock.advance(Limits.HEAD_POLL_MS * 4)
    deny.push('/work/lib.ts')
    await pane.world.clock.advance(Limits.HEAD_POLL_MS)
    held.push('/work/lib.ts')
    await pane.world.clock.advance(Limits.HEAD_POLL_MS)

    expect(await pane.drawn()).not.toContain('lib.ts')
  })

  test('a quiet pane asks nothing more', async ($, on) => {
    const asked = { times: 0 }

    on('tool.check', { tool: ['Grep', 'Glob'] }, () => ({ decision: 'deny' }))

    const pane = await opened($, on, {
      readOf: path => {
        asked.times += 1

        return path === '/work/lib.ts' ? 'off' : 'allow'
      },
    })

    await pane.world.clock.advance(Limits.HEAD_POLL_MS * 4)

    const settled = asked.times

    await pane.world.clock.advance(Limits.HEAD_POLL_MS * 4)

    expect(asked.times).toBe(settled)
    expect(await pane.drawn()).toContain('1 not shown')

    await pane.sent()
    await pane.world.clock.advance(Limits.HEAD_POLL_MS)

    expect(asked.times, 'until a prompt is sent').toBeGreaterThan(settled)
  })

  test('a body is asked about before it is read', async ($, on) => {
    const denied: string[] = []

    const pane = await opened(
      $,
      on,
      { readOf: path => denying(...denied)(path) },
      {
        script: Fixtures.answersOf('1\t1\ta.test.ts\0' + '1\t1\tb.ts\0', {
          'a.test.ts': '@@ -1 +1 @@\n-a\n+b\n',
          'b.ts': '@@ -1 +1 @@\n-c\n+d\n',
        }),
      },
    )

    await pane.drawn()
    denied.push('/work/a.test.ts')
    await $.ui.press({ plugin: 'diff', key: 'noise' })
    await pane.world.clock.settle()

    expect(pane.bodiesRead()).not.toContain('a.test.ts')
    expect(await pane.drawn()).toContain('1 read-denied')
  })

  for (const command of [Fixtures.DIFF, Fixtures.DIALOG_DIFF]) {
    const seat = command === Fixtures.DIFF ? 'pane' : 'dialog'

    test(`a ${seat} opened during a read shows no old row`, async ($, on) => {
      const wait = { ms: 0 }

      const pane = await opened(
        $,
        on,
        {
          messages: async () => {
            await (wait.ms > 0 && pane.world.clock.sleep(wait.ms))

            return []
          },
        },
        { command },
      )

      wait.ms = Limits.CHECK_TIMEOUT_MS * 4
      await pane.refresh()
      await $.command.run(command)

      const before = pane.world.opened.length

      await $.command.run(command)

      expect(pane.world.opened).toHaveLength(before + 1)
      expect(await pane.drawn()).not.toContain('lib.ts')
      expect(await pane.drawn()).toContain('Loading diff')

      await pane.world.clock.advance(wait.ms * 3)

      expect(await pane.drawn()).toContain('lib.ts')
    })
  }

  test('a reopened pane drops its last drawing first', async ($, on) => {
    const order: string[] = []

    on('ui.invalidate', { event: 'ui.render' }, (_engine, e, next) => {
      order.push('invalidate')

      return next(e)
    })

    on('ui.open', { id: 'diff' }, (_engine, e, next) => {
      order.push('open')

      return next(e)
    })

    await opened($, on, {})
    await $.command.run(Fixtures.DIFF)
    order.length = 0
    await $.command.run(Fixtures.DIFF)

    expect(order.slice(0, 2)).toEqual(['invalidate', 'open'])
  })

  test('a pane drawn long after its open asks again first', async ($, on) => {
    const denied: string[] = []

    const pane = await opened($, on, {
      isLeftUnseen: () => true,
      readOf: path => denying(...denied)(path),
    })

    denied.push('/work/lib.ts')

    const drawn = await pane.drawn()

    expect(drawn).not.toContain('lib.ts')
    expect(drawn).toContain('app.ts')
  })

  test('a second press while the first is checked drops it', async ($, on) => {
    const wait = { ms: 0 }

    const pane = await opened($, on, {
      readOf: async () => {
        await (wait.ms > 0 && pane.world.clock.sleep(wait.ms))

        return 'allow' as const
      },
    })

    wait.ms = Limits.CHECK_TIMEOUT_MS / 4
    await pane.ask('lib.ts')
    await pane.ask('lib.ts')
    await pane.world.clock.advance(Limits.CHECK_TIMEOUT_MS)
    wait.ms = 0

    expect(await pane.sent()).toBeUndefined()
  })

  for (const [again, sent] of [
    ['app.ts', 'undefined'],
    ['lib.ts', 'diff of app.ts'],
  ] as const) {
    test(`one armed, one checked: ${again} drops`, async ($, on) => {
      const wait = { ms: 0 }

      const pane = await opened($, on, {
        readOf: async () => {
          await (wait.ms > 0 && pane.world.clock.sleep(wait.ms))

          return 'allow' as const
        },
      })

      await pane.ask('app.ts')
      wait.ms = Limits.CHECK_TIMEOUT_MS / 4
      await pane.ask('lib.ts')
      await pane.ask(again)
      await pane.world.clock.advance(Limits.CHECK_TIMEOUT_MS)
      wait.ms = 0

      expect(String(await pane.sent())).toContain(sent)
    })
  }

  test('with no timer, a held answer sends nothing', async ($, on) => {
    const held: { answer: Promise<'deny'> | null } = { answer: null }

    let release = (): void => undefined

    on('clock.after', { ms: Limits.CHECK_TIMEOUT_MS }, () => ({
      deny: 'timer refused',
    }))

    const script = { ...Fixtures.answersOf('2\t0\tlib.ts\0', {}) }

    const pane = await opened(
      $,
      on,
      { readOf: () => held.answer ?? 'allow' },
      { script: Object.assign(script, Fixtures.oneSecret()) },
    )

    await pane.ask('.env')

    held.answer = new Promise(resolve => {
      release = () => resolve('deny')
    })

    Object.assign(script, Fixtures.TWO_FILES)
    await pane.refresh()

    const sent = pane.sent()

    await pane.world.clock.advance(Limits.CHECK_TIMEOUT_MS * 2)

    expect(await pane.drawn()).not.toContain('lib.ts')

    release()

    expect(await sent).toBeUndefined()
  })

  test('a refused press leaves the armed file armed', async ($, on) => {
    const pane = await opened($, on, {
      landingOf: path => path.replace('lib.ts', 'x-downloads/lib.ts'),
    })

    await pane.ask('app.ts')
    await pane.ask('lib.ts')

    expect(pane.world.statuses.at(-1)).toBe(
      `${UNSURE}; app.ts still rides your next prompt`,
    )

    expect(await pane.sent()).toHaveLength(1)
  })

  test('an ask denied since it was armed is dropped at the prompt', async ($, on) => {
    const denied: string[] = []

    const pane = await opened($, on, {
      readOf: path => denying(...denied)(path),
    })

    await pane.ask('lib.ts')
    denied.push('/work/lib.ts')

    expect(await pane.sent()).toBeUndefined()
    expect(pane.world.statuses.at(-1)).toBe(DENIED)
  })

  test('an ask not answered for at the prompt is dropped', async ($, on) => {
    const lib: { answer: () => Promise<'allow'> } = {
      answer: async () => 'allow',
    }

    const pane = await opened($, on, { readOf: () => lib.answer() })

    for (const answer of [
      () => Promise.reject(new Error('no verdict')),
      () =>
        pane.world.clock
          .sleep(Limits.CHECK_TIMEOUT_MS * 2)
          .then(() => 'allow' as const),
    ]) {
      lib.answer = async () => 'allow'
      await pane.refresh()
      await pane.ask('lib.ts')
      lib.answer = answer

      const sent = pane.sent()

      await pane.world.clock.advance(Limits.CHECK_TIMEOUT_MS * 3)

      expect(await sent).toBeUndefined()
      expect(pane.world.statuses.at(-1)).toBe(UNSURE)
    }
  })

  test('an ask denied since it was armed is dropped at a refresh', async ($, on) => {
    const denied: string[] = []

    const pane = await opened($, on, {
      readOf: path => denying(...denied)(path),
    })

    await pane.ask('lib.ts')
    denied.push('/work/lib.ts')
    await pane.refresh()

    expect(pane.world.statuses.at(-1)).toBe(DENIED)
  })

  test('a press on a file denied since it drew arms nothing', async ($, on) => {
    const denied: string[] = []

    const pane = await opened($, on, {
      readOf: path => denying(...denied)(path),
    })

    denied.push('/work/lib.ts')
    await pane.ask('lib.ts')

    expect(pane.world.statuses.at(-1)).toBe(DENIED)
    expect(await pane.sent()).toBeUndefined()
    expect(await pane.drawn(), 'and the row goes').not.toContain('lib.ts')
  })

  test('a prompt sent right after the press carries the ask', async ($, on) => {
    const wait = { ms: 0 }

    const pane = await opened($, on, {
      readOf: async () => {
        await (wait.ms > 0 && pane.world.clock.sleep(wait.ms))

        return 'allow' as const
      },
    })

    wait.ms = Limits.CHECK_TIMEOUT_MS / 4
    await pane.ask('lib.ts')

    const sent = pane.sent()

    await pane.world.clock.advance(Limits.CHECK_TIMEOUT_MS)

    expect(await sent).toHaveLength(1)
  })

  test('a file the pane cannot place is not attached', async ($, on) => {
    const pane = await opened($, on, {
      landingOf: () => '/work/saved-downloads/lib.ts',
    })

    await pane.ask('lib.ts')

    expect(pane.world.statuses.at(-1)).toBe(UNSURE)
    expect(await pane.sent()).toBeUndefined()
    expect(await pane.drawn()).toContain('lib.ts')
  })

  test('a note put beside an armed file drops the ask', async ($, on) => {
    const pane = await opened($, on, {})

    await pane.ask('lib.ts')
    pane.beside.push('.lib.ts.note.json')

    expect(await pane.sent()).toBeUndefined()
    expect(pane.world.statuses.at(-1)).toBe(UNSURE)
  })

  describe('over a host alone', () => {
    const FILE = { path: 'a.md', renamedFrom: null, isTurnFile: false }
    type Answer = { decision: 'allow' | 'deny'; rule?: string }

    const absent = (tool: string) =>
      Promise.reject(
        new Error(`$.tool.check: no tool named "${tool}" in this session`),
      )

    const missing = () => Promise.reject(new Error('stat failed: ENOENT'))

    function hostOf(
      landings: Readonly<Record<string, string | undefined>>,
      listings: Readonly<Record<string, readonly string[]>>,
      checkRead: (tool: string) => Promise<Answer> = async () => ({
        decision: 'allow',
      }),
    ) {
      return {
        after: () => ({ cancel: () => undefined }),
        checkRead,
        resolve: (path: string) =>
          Object.hasOwn(landings, path)
            ? Promise.resolve({ realPath: landings[path] })
            : missing(),
        listDir: async (folder: string) =>
          (listings[folder] ?? (await missing())).map(name => ({
            name,
            kind: 'file' as const,
            size: 0,
            mtimeMs: 0,
            isLink: false,
          })),
      }
    }

    const isPlain = (path: string, real = path, beside: string[] = []) =>
      Access.isPlainlyPlaced(
        hostOf({ [path]: real }, { [real.replace(/[^\\/]*$/, '')]: beside }),
        path,
      )

    test('ordinary places are plain', async () => {
      for (const path of [
        '/w/a.md',
        '/home/me/Downloads/w/a.md',
        '/w/src/downloads/a.md',
        '/w/my-downloads',
        'C:\\w\\a.md',
      ]) {
        expect(await isPlain(path), path).toBe(true)
      }

      expect(
        await isPlain('/w/a.md', '/w/a.md', ['.a.md.swp', '.b.md.x.json']),
      ).toBe(true)

      expect(await isPlain('/w/mcp', '/w/mcp', ['.mcp.json'])).toBe(true)
    })

    test('a folder of downloads is not, however it is spelled', async () => {
      for (const folder of [
        'x-downloads',
        'X-Downloads',
        'x-downloads. ',
        'x-downloads:stream',
        'x-download\u017f',
        'x-down\u200cloads',
        'x-downloads-page',
      ]) {
        expect(await isPlain(`/w/${folder}/in/a.md`, '/w/a.md')).toBe(false)
        expect(await isPlain('/w/a.md', `/w/${folder}/in/a.md`)).toBe(false)
      }

      expect(await isPlain('/w/a.md', 'C:\\x-downloads\\a.md')).toBe(false)
      expect(await isPlain('/w/a.md', '/mnt/c/XDOWNL~1/a.md')).toBe(false)
      expect(await isPlain('/w/a.md', '/w/old.copy~2b/a.md')).toBe(false)
    })

    test('a note counts beside where the path lands, in any case', async () => {
      expect(await isPlain('/w/a.md', '/v/b.md', ['.B.md.X.JSON'])).toBe(false)
    })

    test('a missing file is judged from the folder that exists', async () => {
      const placed = (real: string, beside: string[]) =>
        Access.isPlainlyPlaced(
          hostOf({ '/w/': real }, { [`${real}/`]: beside }),
          '/w/a.md',
        )

      expect(await placed('/w', [])).toBe(true)
      expect(await placed('/w', ['.a.md.x.json'])).toBe(false)
      expect(await placed('/x-downloads', [])).toBe(false)

      expect(
        await Access.isPlainlyPlaced(hostOf({ '/': '/' }, {}), '/w/in/a.md'),
      ).toBe(true)
    })

    test('a look that fails refuses the ask', async () => {
      const refusalOf = (host: ReturnType<typeof hostOf>) =>
        Access.askRefusalOf(host, FILE, ['/w'])

      const plain = hostOf({ '/w/a.md': '/w/a.md' }, { '/w/': [] })

      expect(await refusalOf(plain)).toBe(null)
      expect(await Access.askRefusalOf(plain, FILE, null)).toBe('unsure')
      expect(await refusalOf(hostOf({}, {}))).toBe('unsure')

      expect(
        await refusalOf(hostOf({ '/w/a.md': undefined }, { '/w/': [] })),
      ).toBe('unsure')

      expect(await refusalOf(hostOf({ '/w/a.md': '/w/a.md' }, {}))).toBe(
        'unsure',
      )

      expect(
        await refusalOf({
          ...plain,
          resolve: path =>
            path === '/w/a.md'
              ? Promise.reject(new Error('stat failed: EACCES'))
              : Promise.resolve({ realPath: '/w' }),
        }),
      ).toBe('unsure')
    })

    test("a rename's old name and a second root are placed too", async () => {
      const host = hostOf(
        {
          '/w/a.md': '/w/a.md',
          '/w/': '/w',
          '/v/a.md': '/x-downloads/a.md',
        },
        { '/w/': [] },
      )

      const renamed = { ...FILE, renamedFrom: 'x-downloads/a.md' }

      expect(await Access.askRefusalOf(host, renamed, ['/w'])).toBe('unsure')
      expect(await Access.askRefusalOf(host, FILE, ['/w', '/v'])).toBe('unsure')
    })

    test('with no tool to answer, rows hide and ask refuses', async () => {
      const host = hostOf({ '/w/a.md': '/w/a.md' }, { '/w/': [] }, absent)

      const off = { ...host, checkRead: async () => ({ decision: 'deny' }) }

      expect((await Access.hiddenOf(host, [FILE], ['/w'])).size).toBe(1)
      expect((await Access.hiddenOf(off as never, [FILE], ['/w'])).size).toBe(1)
      expect((await Access.hiddenOf(host, [FILE], null)).size).toBe(1)
      expect(await Access.askRefusalOf(host, FILE, ['/w'])).toBe('unsure')
    })

    test('without Read, a search tool answers for the rule', async () => {
      for (const answering of ['Grep', 'Glob']) {
        const host = hostOf({}, {}, async tool =>
          tool === answering
            ? { decision: 'deny', rule: 'Read(a.md)' }
            : absent(tool),
        )

        expect((await Access.hiddenOf(host, [FILE], ['/w'])).get(FILE)).toBe(
          'denied',
        )
      }
    })

    test('a path that may name another file is not plain', async () => {
      expect(await isPlain('/w/a.md ')).toBe(false)
      expect(await isPlain('/c/a.md', 'C:\\c\\a.md')).toBe(false)
    })

    test('a timer that throws stands in the late answer', async () => {
      const after = () => {
        throw new Error('refused')
      }

      expect(
        await Access.withinTime({ after }, Promise.reject(new Error('x')), 1),
      ).toBe(1)

      const plain = hostOf({ '/w/a.md': '/w/a.md' }, { '/w/': [] })

      expect(await Access.askRefusalOf({ ...plain, after }, FILE, ['/w'])).toBe(
        'unsure',
      )
    })

    test('only so many questions are out at once', async () => {
      const out = { now: 0, most: 0 }

      const host = hostOf({}, {}, async () => {
        out.now += 1
        out.most = Math.max(out.most, out.now)
        await Promise.resolve()
        out.now -= 1

        return { decision: 'allow' }
      })

      await Access.readVerdictsOf(
        host,
        Array.from({ length: Limits.MAX_FILES }, (_, at) => `/w/${at}`),
      )

      expect(out.most).toBe(Limits.CHECKS_AT_ONCE)
    })

    test("a turn's path stands as given", () => {
      const turn = { ...FILE, isTurnFile: true }

      expect(Access.spellingsOf(turn, ['/w/'])).toEqual(['a.md', '/w/a.md'])

      expect(Access.spellingsOf({ ...turn, path: '/r/a.md' }, ['/w'])).toEqual([
        '/r/a.md',
      ])
    })

    test('the folders that may be the top', () => {
      expect(Access.possibleRootsOf('/w/a/b', '/w')).toEqual([
        '/w',
        '/w/a/b',
        '/w/a',
      ])

      expect(Access.possibleRootsOf('/v/a', '/w')).toEqual([
        '/w',
        '/v/a',
        '/v',
        '/',
      ])

      expect(Access.possibleRootsOf('C:\\w\\a', 'C:/w')).toEqual([
        'C:/w',
        'C:/w/a',
      ])

      expect(Access.possibleRootsOf('D:\\v\\a\\', 'C:/w')).toEqual([
        'C:/w',
        'D:/v/a',
        'D:/v',
        'D:',
      ])

      expect(Access.possibleRootsOf('/v/', '/w')).toEqual(['/w', '/v', '/'])
    })

    test("the current folder's top", () => {
      expect(Access.liveRootOf('/w/in', null, '/w')).toBe('/w')
      expect(Access.liveRootOf('/w/in', '/w/in', '/w')).toBe('/w/in')
      expect(Access.liveRootOf('/wide', null, '/w')).toBe('/wide')
      expect(Access.liveRootOf('C:\\w\\in', 'C:\\w', 'C:/w')).toBe('C:/w')
    })
  })
})
