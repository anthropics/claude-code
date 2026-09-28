import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'
import Fixtures from './fixtures'

tier('builtin')

/**
 * The blocks the engine hands `prompt.context`.
 */
const BLOCKS = [
  { name: 'claudeMd', text: 'x' },
  { name: 'currentDate', text: 'today' },
]

describe('register', () => {
  test('by default a project with AGENTS.md alone gets it', async ($, on) => {
    const started = Fixtures.projectOf(
      on,
      [Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n')],
      [],
    )

    on('prompt.context', ($, e) => ({
      blocks: e.blocks,
      instructionFiles: e.instructionFiles,
    }))

    const context = await $.prompt.context({
      blocks: BLOCKS,
      instructionFiles: [],
    })

    expect(context.instructionFiles).toEqual([
      { path: '/repo/AGENTS.md', kind: 'project', content: '# top\n' },
    ])
    expect(context.blocks?.[0]?.text).toContain(
      'Contents of /repo/AGENTS.md (project instructions, checked into the ' +
        'codebase):\n\n# top',
    )

    await started.clock.settle()

    expect(started.lines).toEqual([
      'no CLAUDE.md found; AGENTS.md loaded: /repo/AGENTS.md',
    ])
  })

  test('by default a project with a CLAUDE.md is left to the engine', async ($, on) => {
    const started = Fixtures.projectOf(
      on,
      [Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n')],
      [Fixtures.ancestorOf('/repo/a/b', 'CLAUDE.md', '# mine\n')],
    )
    const handed = [
      { path: '/repo/a/b/CLAUDE.md', kind: 'project' as const, content: '#' },
    ]

    on('prompt.context', ($, e) => ({
      blocks: e.blocks,
      instructionFiles: e.instructionFiles,
    }))

    expect(
      await $.prompt.context({ blocks: BLOCKS, instructionFiles: handed }),
    ).toEqual({ blocks: BLOCKS, instructionFiles: handed })

    await started.clock.settle()

    expect(started.walks).toEqual([])
    expect(started.lines).toEqual([])
  })

  test('a failed walk leaves the context as handed', async ($, on) => {
    Fixtures.unreadableProjectOf(on)

    on('prompt.context', ($, e) => ({
      blocks: e.blocks,
      instructionFiles: e.instructionFiles,
    }))

    expect(
      await $.prompt.context({ blocks: BLOCKS, instructionFiles: [] }),
    ).toEqual({ blocks: BLOCKS, instructionFiles: [] })
  })

  test(
    'the start sends the mode row alone: no walk, no toast',
    { plugins: [Fixtures.RECORDING] },
    async ($, on) => {
      const started = Fixtures.projectOf(
        on,
        [Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n')],
        [],
      )

      expect(await $.session.start(Fixtures.SESSION)).toEqual({
        cwd: '/repo/a/b',
      })

      await started.clock.settle()

      expect(Fixtures.rowsOf(started)).toEqual([
        [
          'log',
          {
            event: Hooks.MODE_EVENT,
            props: {
              mode: { value: 'claude-md-or-agents-md', of: [...Hooks.MODES] },
              is_interactive: true,
            },
          },
        ],
      ])
      expect(Hooks.MODE_EVENT).toBe('agents_md_mode')
      expect(started.walks).toEqual([])
      expect(started.toasts).toEqual([])
    },
  )

  test('with no telemetry noun the start goes on untouched', async ($, on) => {
    const started = Fixtures.projectOf(
      on,
      [Fixtures.ancestorOf('/repo', 'AGENTS.md', '# top\n')],
      [],
    )

    expect(
      await $.session.start({ ...Fixtures.SESSION, isInteractive: false }),
    ).toEqual({ cwd: '/repo/a/b' })

    await started.clock.settle()

    expect(Fixtures.rowsOf(started)).toEqual([])
    expect(started.toasts).toEqual([])
  })
})
