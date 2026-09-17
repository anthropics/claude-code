import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'
import Fixtures from './fixtures'

tier('builtin')

describe('register', () => {
  test('a project with AGENTS.md alone is told so for 10 s', async ($, on) => {
    const started = Fixtures.projectOf(
      on,
      [Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n')],
      [],
    )

    expect(await $.session.start(Fixtures.SESSION)).toEqual({
      cwd: '/repo/a/b',
    })

    await started.clock.settle()

    expect(started.toasts).toEqual([
      { text: Hooks.NUDGE, timeoutMs: Hooks.NUDGE_TIMEOUT_MS },
    ])
    expect(Hooks.NUDGE_TIMEOUT_MS).toBe(10_000)
    expect(started.lines).toEqual([])
  })

  test('the start waits on no walk, even one that never answers', async ($, on) => {
    const stalled = Fixtures.stalledProjectOf(on)

    expect(await $.session.start(Fixtures.SESSION)).toEqual({
      cwd: '/repo/a/b',
    })

    await stalled.clock.settle()

    expect(stalled.toasts).toEqual([])
  })

  test('walks that answer late still raise the nudge', async ($, on) => {
    const late = Fixtures.lateProjectOf(on, [
      Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n'),
    ])

    expect(await $.session.start(Fixtures.SESSION)).toEqual({
      cwd: '/repo/a/b',
    })

    await late.clock.settle()

    expect(late.toasts).toEqual([])

    await late.clock.advance(Fixtures.LATE_MS)

    expect(late.toasts).toEqual([
      { text: Hooks.NUDGE, timeoutMs: Hooks.NUDGE_TIMEOUT_MS },
    ])
  })

  test('a project with a CLAUDE.md up the walk is left be', async ($, on) => {
    const started = Fixtures.projectOf(
      on,
      [Fixtures.ancestorOf('/repo/a', '.claude/AGENTS.md', '# a\n')],
      [Fixtures.ancestorOf('/repo/a/b', 'CLAUDE.local.md', '# mine\n')],
    )

    await $.session.start(Fixtures.SESSION)
    await started.clock.settle()

    expect(started.toasts).toEqual([])
  })

  test('a project with neither file is left alone', async ($, on) => {
    const started = Fixtures.projectOf(on, [], [])

    await $.session.start(Fixtures.SESSION)
    await started.clock.settle()

    expect(started.toasts).toEqual([])
  })

  test('a failed walk leaves the session starting untouched', async ($, on) => {
    const started = Fixtures.unreadableProjectOf(on)

    expect(await $.session.start(Fixtures.SESSION)).toEqual({
      cwd: '/repo/a/b',
    })

    await started.clock.settle()

    expect(started.toasts).toEqual([])
  })

  test('by default the context passes through untouched', async ($, on) => {
    Fixtures.projectOf(
      on,
      [Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n')],
      [],
    )
    const blocks = [
      { name: 'claudeMd', text: 'x' },
      { name: 'currentDate', text: 'today' },
    ]

    on('prompt.context', ($, e) => ({
      blocks: e.blocks,
      instructionFiles: e.instructionFiles,
    }))

    expect(await $.prompt.context({ blocks, instructionFiles: [] })).toEqual({
      blocks,
      instructionFiles: [],
    })
  })

  test(
    'the start sends its mode with the walk counts, the nudge its row',
    { plugins: [Fixtures.RECORDING] },
    async ($, on) => {
      const started = Fixtures.projectOf(
        on,
        [
          Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n'),
          Fixtures.ancestorOf('/repo/a', '.claude/AGENTS.md', '# a\n'),
        ],
        [],
      )

      await $.session.start(Fixtures.SESSION)
      await started.clock.settle()

      expect(Fixtures.rowsOf(started)).toEqual([
        [
          'log',
          {
            event: Hooks.MODE_EVENT,
            props: {
              mode: { value: 'claude', of: [...Hooks.MODES] },
              is_interactive: true,
              agents_file_count: 2,
              claude_file_count: 0,
            },
          },
        ],
        [
          'log',
          {
            event: Hooks.NUDGE_EVENT,
            props: { outcome: { value: 'shown', of: ['shown', 'acted'] } },
          },
        ],
      ])
      expect(Hooks.MODE_EVENT).toBe('agents_md_mode')
      expect(Hooks.NUDGE_EVENT).toBe('agents_md_nudge')
      expect(started.toasts).toEqual([
        { text: Hooks.NUDGE, timeoutMs: Hooks.NUDGE_TIMEOUT_MS },
      ])
      expect(started.store.get(Hooks.NUDGE_KEY)).toBe('shown')
    },
  )

  test(
    'a project with CLAUDE.md sends the mode row alone, no paths in it',
    { plugins: [Fixtures.RECORDING] },
    async ($, on) => {
      const started = Fixtures.projectOf(
        on,
        [Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n')],
        [Fixtures.ancestorOf('/repo/a/b', 'CLAUDE.md', '# mine\n')],
      )

      await $.session.start({ ...Fixtures.SESSION, isInteractive: false })
      await started.clock.settle()

      expect(Fixtures.rowsOf(started)).toEqual([
        [
          'log',
          {
            event: Hooks.MODE_EVENT,
            props: {
              mode: { value: 'claude', of: [...Hooks.MODES] },
              is_interactive: false,
              agents_file_count: 1,
              claude_file_count: 1,
            },
          },
        ],
      ])
      expect(started.lines.join('\n')).not.toContain('/repo')
      expect(started.store.has(Hooks.NUDGE_KEY)).toBe(false)
    },
  )

  test(
    'a nudge acted on earlier is not marked shown again',
    { plugins: [Fixtures.RECORDING] },
    async ($, on) => {
      const started = Fixtures.projectOf(
        on,
        [Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n')],
        [],
        { [Hooks.NUDGE_KEY]: 'acted' },
      )

      await $.session.start(Fixtures.SESSION)
      await started.clock.settle()

      expect(started.toasts).toHaveLength(1)
      expect(started.store.get(Hooks.NUDGE_KEY)).toBe('acted')
    },
  )

  test('with no telemetry noun the nudge shows and nothing throws', async ($, on) => {
    const started = Fixtures.projectOf(
      on,
      [Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n')],
      [],
    )

    await $.session.start(Fixtures.SESSION)
    await started.clock.settle()

    expect(started.toasts).toHaveLength(1)
    expect(Fixtures.rowsOf(started)).toEqual([])
    expect(started.store.get(Hooks.NUDGE_KEY)).toBe('shown')
  })
})
