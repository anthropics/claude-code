import { describe, expect, test, tier } from 'claude-code/testing'

import Fixtures from './fixtures'

tier('builtin')

describe('views', () => {
  test('docked, every file has its hunks under the list', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.TWO_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(drawn).toContain('2 files changed +3 -1')

    expect(drawn, "a closing empty row, as the built-in's").toContain(
      '+const a = 2\n ',
    )

    expect(drawn, 'none after the last file').toMatch(/\+export const c = 2$/)
    expect(drawn).not.toContain('❯')
  })

  test('inline, a row opens that file alone', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.TWO_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIALOG_DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.ui.render(Fixtures.INLINE_PANE)

    expect(await $.ui.press({ plugin: 'diff', key: 'file:lib.ts' })).toEqual({
      element: 'file:lib.ts',
    })

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.INLINE_PANE))

    expect(drawn).toContain('+export const c = 2')
    expect(drawn).not.toContain('+const a = 2')
    expect(drawn).not.toContain('app.ts')
    expect(drawn).toContain('\u2191/\u2193 to scroll \u00b7 Esc to back')
  })

  test('docked, a wheel tick moves the body, not the list', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.MANY_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    const before = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(before, 'listed, and named over its body').toContain('file0.ts')
    expect(before.split('file0.ts')).toHaveLength(3)

    expect(await $.ui.scroll(Fixtures.WHEEL_TICK)).toEqual({})

    const after = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(after.split('file0.ts'), 'its name row scrolled away').toHaveLength(
      2,
    )

    expect(after).toContain('-const v = 0')
    expect(after).toContain('10 files changed +10 -10')
    expect(after, 'the list stays').not.toContain('more above')
  })

  test('docked, the wheel over a long list moves the list', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.MANY_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.ui.render(Fixtures.PANE)

    expect(await $.ui.scroll(Fixtures.WHEEL_OVER_LIST)).toEqual({})

    const after = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(after).toContain('\u2191 1 more above')
    expect(after).toContain('file8.ts')
    expect(after.split('file0.ts'), 'the body stays').toHaveLength(2)
  })

  test('past eight files the docked list scrolls by key', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.MANY_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(drawn).toContain('10 files changed +10 -10')
    expect(drawn).toContain('file7.ts')
    expect(drawn).toContain('\u2193 2 more below (opt+\u2193 to scroll)')
    expect(drawn).not.toContain('file8.ts')

    expect(await $.ui.press({ plugin: 'diff', key: 'list-down' })).toEqual({
      element: 'list-down',
    })

    const scrolled = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(scrolled).toContain('\u2191 1 more above')
    expect(scrolled).toContain('file8.ts')
    expect(scrolled).toContain('\u2193 1 more below')
  })

  test('a rename lists as git prints it, and reads no body', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.RENAMED)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.PANE))

    expect(drawn).toContain('1 file changed')
    expect(drawn).toContain('docs/{notes.txt => renamed-notes.txt}')
    expect(drawn).toContain('No diff content')

    expect(
      world.runs.filter(run => run.argv.includes('docs/renamed-notes.txt')),
    ).toEqual([])
  })

  test('inline, the dialog lists every file and its keys', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.TWO_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIALOG_DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.INLINE_PANE))

    expect(drawn).toContain('Uncommitted changes (git diff HEAD)')
    expect(drawn).toContain('2 files changed +3 -1')
    expect(drawn).toContain('\u276f app.ts')
    expect(drawn).toContain('  lib.ts')
    expect(drawn).not.toContain('+const a = 2')

    expect(drawn).toContain(
      '\u2191/\u2193 to select \u00b7 Enter to view \u00b7 Esc to close',
    )

    expect(world.opened.at(-1), 'sized to its rows once listed').toEqual({
      id: 'diff',
      title: 'Diff',
      holdToasts: true,
      closeOnEscape: true,
      rows: 8,
    })
  })

  test('narrow under the fullscreen layout, the resize line', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.TWO_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      Fixtures.textOf(await $.ui.render(Fixtures.NARROW_INLINE_PANE)),
    ).toBe(
      'Resize your terminal to at least 110 columns to show the diff panel',
    )
  })

  test('off fullscreen, the window follows the walk', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.MANY_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIALOG_DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    const drawn = Fixtures.textOf(await $.ui.render(Fixtures.INLINE_PANE))

    expect(drawn).toContain('\u276f file0.ts')
    expect(drawn).toContain('  file4.ts')
    expect(drawn).not.toContain('file5.ts')
    expect(drawn).toContain(' \u2193 5 more files')
    expect(await $.ui.focus(Fixtures.ringOnto('file:file3.ts'))).toEqual({})

    expect(
      world.focused.map(focus => focus.element),
      'its row once centred',
    ).toEqual(['file:file2.ts'])

    const walked = Fixtures.textOf(await $.ui.render(Fixtures.INLINE_PANE))

    expect(walked).toContain(' \u2191 1 more file')
    expect(walked).toContain('\u276f file3.ts')
    expect(walked).toContain('  file5.ts')
    expect(walked).toContain(' \u2193 4 more files')
    expect(walked).not.toContain('file0.ts')
  })

  test('the walk follows under the name a build registers', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.MANY_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIALOG_DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.ui.render(Fixtures.INLINE_PANE)

    expect(
      await $.ui.focus(Fixtures.ringOnto('file:file3.ts', 'cc-plugin-diff')),
    ).toEqual({})

    expect(
      world.focused.map(focus => focus.element),
      'its row once centred',
    ).toEqual(['file:file2.ts'])
  })

  test('off fullscreen, the walk stops at the last file', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.MANY_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIALOG_DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)
    await $.ui.render(Fixtures.INLINE_PANE)
    await $.ui.focus(Fixtures.ringOnto('file:file3.ts'))
    await $.ui.render(Fixtures.INLINE_PANE)
    await $.ui.focus(Fixtures.ringOnto('file:file5.ts'))
    await $.ui.render(Fixtures.INLINE_PANE)
    await $.ui.focus(Fixtures.ringOnto('file:file7.ts'))
    await $.ui.render(Fixtures.INLINE_PANE)
    await $.ui.focus(Fixtures.ringOnto('file:file9.ts'))

    const last = Fixtures.textOf(await $.ui.render(Fixtures.INLINE_PANE))

    expect(last).toContain('\u276f file9.ts')
    expect(last).toContain(' \u2191 5 more files')

    expect(
      await $.ui.focus(Fixtures.ringOnto('file:file5.ts')),
      'the ring would wrap to the first row drawn; it stays',
    ).toEqual({})

    expect(Fixtures.textOf(await $.ui.render(Fixtures.INLINE_PANE))).toContain(
      '\u276f file9.ts',
    )

    expect(world.focused, 'the wrap never reached the engine').toHaveLength(4)
  })

  test('off fullscreen, the dialog draws at any width', async ($, on) => {
    const world = Fixtures.inRepository(on, Fixtures.TWO_FILES)

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIALOG_DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      Fixtures.textOf(await $.ui.render(Fixtures.NARROW_INLINE_PANE)),
    ).toContain('Uncommitted changes (git diff HEAD)')
  })
})
