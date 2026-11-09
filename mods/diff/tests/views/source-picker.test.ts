import type { On, RenderInput, SessionMessage } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'

import { arrayOf } from '../../hooks/array-of'
import { isRecord } from '../../hooks/is-record'
import Fixtures from '../fixtures'

tier('builtin')

describe('source-picker', () => {
  /**
   * The pane open and mounted in a session of that many edited turns, over
   * the one changed file of Fixtures.REPOSITORY; the test may swap the
   * transcript. A tree the engine refuses makes every read on `ui` reject.
   */
  async function openOver(
    $: Engine,
    on: On,
    turns: number,
    pane: RenderInput<'Pane'> = Fixtures.PANE,
  ) {
    const session = { transcript: Fixtures.editedTurnsOf(turns) }

    const world = Fixtures.inRepository(on, Fixtures.REPOSITORY, {
      messages: (): readonly SessionMessage[] => session.transcript,
    })

    on('tool.call', () => ({ result: 'done' }))
    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    const ui = await $.ui.mount({
      ...pane,
      plugin: 'diff',
      surface: 'terminal',
    })

    return { session, world, ui }
  }

  /**
   * What the picker offers, in the order drawn, over a fresh drawing:
   * inRepository answers `ui.invalidate`, so none comes by itself.
   */
  async function pickerOf(ui: Mounted<'terminal', 'Pane'>) {
    await ui.redraw()

    const props = (await ui.find({ key: 'source' }))?.props ?? {}
    const options = arrayOf(props.options).filter(isRecord)

    return {
      title: props.label,
      picked: props.value,
      labels: options.map(option => option.label),
      values: options.map(option => String(option.value)),
    }
  }

  test('63 edited turns: every turn listed, nothing noted', async ($, on) => {
    const { ui } = await openOver($, on, 63)
    const { title, labels } = await pickerOf(ui)

    expect(title).toBe('source')
    expect(labels).toHaveLength(64)
    expect(labels.slice(0, 2)).toEqual(['Current', 'T63'])
    expect(labels.at(-1), 'the first turn, nothing older').toBe('T1')
  })

  test('64 edited turns: the pane draws its files', async ($, on) => {
    const { ui } = await openOver($, on, 64)
    const { title, labels } = await pickerOf(ui)

    expect(Fixtures.textOf(await ui.drawn())).toContain('app.ts')
    expect(title, 'closed, it says one is left out').toBe('63 of 64')
    expect(labels).toHaveLength(64)
    expect(labels.slice(0, 2)).toEqual(['Current', 'T64'])
    expect(labels.at(-1), 'one turn left out').toBe('T2 (pick for older)')
  })

  test('the inline dialog draws past the cap too', async ($, on) => {
    const { ui } = await openOver($, on, 200, Fixtures.INLINE_PANE)
    const { title, labels } = await pickerOf(ui)

    expect(title).toBe('63 of 200')
    expect(labels).toHaveLength(64)
  })

  test('picking the oldest listed walks back to T1', async ($, on) => {
    const { ui } = await openOver($, on, 200)
    const walked: string[] = []
    let shown = await pickerOf(ui)

    while (shown.values.at(-1) !== '1' && walked.length < 10) {
      const oldest = shown.values.at(-1) ?? ''

      await ui.select({ key: 'source', value: oldest })
      shown = await pickerOf(ui)
      walked.push(oldest)

      expect(Fixtures.textOf(await ui.drawn())).toContain(
        `Turn ${oldest} "change ${oldest}"`,
      )
      expect(shown.picked, 'the pick stays the picker value').toBe(oldest)
      expect(shown.values, 'and among its options').toContain(oldest)
      expect(shown.labels.length, 'or the engine refuses it').toBeLessThan(65)
    }

    expect(walked.length, 'a few picks, not one a turn').toBeLessThan(6)
    expect(shown.labels.at(-1), 'nothing older to promise').toBe('T1')
    expect(shown.labels[1]).toBe('T17 (pick for newer)')
  })

  test('picking the newest listed walks forward again', async ($, on) => {
    const { ui } = await openOver($, on, 200)

    await ui.select({ key: 'source', value: '138' })

    const { labels, values } = await pickerOf(ui)

    expect(labels[1]).toBe('T139 (pick for newer)')
    expect(labels.at(-1)).toBe('T77 (pick for older)')

    await ui.select({ key: 'source', value: values[1] ?? '' })

    const forward = await pickerOf(ui)

    expect(forward.labels[1]).toBe('T200')
    expect(forward.labels.at(-1)).toBe('T138 (pick for older)')
  })

  test('only an end that says so moves the list', async ($, on) => {
    const { ui } = await openOver($, on, 200)

    for (const [end, inside] of [
      ['200', ['199', '150', '139']],
      ['138', ['137', '100', '78']],
      ['77', ['76', '40', '17']],
      ['16', ['15', '8', '1']],
    ] as const) {
      await ui.select({ key: 'source', value: end })
      const before = await pickerOf(ui)

      for (const value of inside) {
        await ui.select({ key: 'source', value })

        const after = await pickerOf(ui)

        expect(after.picked).toBe(value)
        expect(after.labels, `after T${value}`).toEqual(before.labels)
      }
    }
  })

  for (const turns of [63, 124]) {
    test(`${turns} turns: T1 is the last of a full list`, async ($, on) => {
      const { ui } = await openOver($, on, turns)

      await ui.select({ key: 'source', value: String(turns - 62) })
      const before = await pickerOf(ui)

      expect(before.labels.at(-1)).toBe('T1')
      expect(before.labels).toHaveLength(64)

      await ui.select({ key: 'source', value: '1' })

      expect((await pickerOf(ui)).labels).toEqual(before.labels)
    })
  }

  test('Current goes back to the newest turns', async ($, on) => {
    const { ui } = await openOver($, on, 200)

    await ui.select({ key: 'source', value: '138' })
    await ui.select({ key: 'source', value: 'current' })

    const { labels } = await pickerOf(ui)

    expect(labels.slice(0, 2)).toEqual(['Current', 'T200'])
  })

  test('a picked turn stays an option as turns pile up', async ($, on) => {
    const { session, world, ui } = await openOver($, on, 10)

    await ui.select({ key: 'source', value: '3' })
    session.transcript = Fixtures.editedTurnsOf(300)
    await $.tool.call({ tool: 'Bash', command: 'make' })
    await world.clock.advance(Fixtures.SETTLE_MS)

    const { picked, values } = await pickerOf(ui)

    expect(picked).toBe('3')
    expect(values, 'not `none` beside the turn it shows').toContain('3')
  })

  test('a turn is listed by its place, not by its number', async ($, on) => {
    const { session, world, ui } = await openOver($, on, 200)

    session.transcript = Fixtures.editedTurnsOf(200).flatMap((row, at) =>
      at % 3 === 0 ? [Fixtures.promptOf('just talk'), row] : [row],
    )
    await $.tool.call({ tool: 'Bash', command: 'make' })
    await world.clock.advance(Fixtures.SETTLE_MS)
    await ui.redraw()
    await ui.select({ key: 'source', value: '276' })

    const { labels } = await pickerOf(ui)

    expect(labels[1], 'every other prompt is talk').toBe('T278 (pick for newer)')
    expect(labels.at(-1)).toBe('T154 (pick for older)')
  })
})
