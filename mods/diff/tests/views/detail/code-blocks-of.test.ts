import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../../../hooks/limits'
import Views from '../../../hooks/views'
import Fixtures from '../../fixtures'

tier('builtin')

describe('code-blocks-of', () => {
  test('each hunk is a source of its own, nothing between them', () => {
    const { sources, isTruncated } = Views.codeBlocksOf(
      [
        Fixtures.wideHunk(),
        Fixtures.wideHunk(Fixtures.BIG_LINES),
        Fixtures.wideHunk(2 * Fixtures.BIG_LINES),
      ],
      Views.BODY_BUDGET,
    )

    expect(isTruncated).toBe(false)
    expect(sources).toHaveLength(3)
    expect(sources.every(Fixtures.isWithinCodeCap)).toBe(true)

    expect(sources.map(source => Fixtures.hunksOf(source).length)).toEqual([
      1, 1, 1,
    ])

    expect(Fixtures.hunksOf(sources[2] ?? '')[0]?.oldStart).toBe(
      2 * Fixtures.BIG_LINES,
    )
  })

  test('an oversize hunk stacks as sub-hunks that add up', () => {
    const hunk = Fixtures.wideHunk(
      Fixtures.BIG_LINES,
      Limits.MAX_LINES_PER_FILE,
    )

    const body = Views.codeBlocksOf([hunk], Views.BODY_BUDGET)
    const parts = Fixtures.parsedHunksOf(body)

    expect(body.isTruncated).toBe(false)
    expect(body.sources.length).toBeGreaterThan(2)
    expect(body.sources.every(Fixtures.isWithinCodeCap)).toBe(true)
    expect(parts).toHaveLength(body.sources.length)
    expect(parts.flatMap(part => part.lines)).toEqual([...hunk.lines])

    expect(parts.reduce((sum, part) => sum + part.oldLines, 0)).toBe(
      hunk.lines.filter(line => !line.startsWith('+')).length,
    )

    expect(parts.reduce((sum, part) => sum + part.newLines, 0)).toBe(
      hunk.lines.filter(line => !line.startsWith('-')).length,
    )

    expect(parts[0]?.oldStart).toBe(Fixtures.BIG_LINES)
    expect(Fixtures.areContiguous(parts)).toBe(true)
  })

  test('letters beyond the BMP are capped in UTF-16 units', () => {
    const hunk = Fixtures.wideHunk(
      Fixtures.BIG_LINES,
      Limits.MAX_LINES_PER_FILE / 2,
      Fixtures.MATHEMATICAL_BOLD_A,
    )

    const body = Views.codeBlocksOf([hunk], Views.BODY_BUDGET)
    const parts = Fixtures.parsedHunksOf(body)

    expect(Fixtures.MATHEMATICAL_BOLD_A).toHaveLength(2)
    expect(body.isTruncated).toBe(false)
    expect(body.sources.length).toBeGreaterThan(2)
    expect(body.sources.every(Fixtures.isWithinCodeCap)).toBe(true)
    expect(parts.flatMap(part => part.lines)).toEqual([...hunk.lines])
    expect(Fixtures.areContiguous(parts)).toBe(true)
  })

  test('a line longer than any source holds is cut, reported', () => {
    const body = Views.codeBlocksOf(
      [
        {
          oldStart: 1,
          newStart: 1,
          lines: [`+${'z'.repeat(2 * Views.MAX_CODE_CHARS)}`, '+b'],
        },
      ],
      Views.BODY_BUDGET,
    )

    const lines = Fixtures.parsedHunksOf(body).flatMap(part => part.lines)

    expect(body.isTruncated).toBe(true)
    expect(body.sources.every(Fixtures.isWithinCodeCap)).toBe(true)
    expect(lines).toEqual([expect.stringMatching(/^\+z+$/), '+b'])
  })

  test('the room runs down by what is drawn, and out at the budget', () => {
    const hunks = [Fixtures.wideHunk(), Fixtures.wideHunk(Fixtures.BIG_LINES)]
    const whole = Views.codeBlocksOf(hunks, Views.BODY_BUDGET)

    const starved = Views.codeBlocksOf(hunks, {
      chars: Views.BODY_BUDGET.chars,
      nodes: 1,
    })

    expect(whole.room.nodes).toBe(Views.BODY_BUDGET.nodes - 2)

    expect(whole.room.chars).toBe(
      Views.BODY_BUDGET.chars -
        whole.sources.reduce((sum, source) => sum + source.length, 0),
    )

    expect(starved.sources).toHaveLength(1)
    expect(starved.isTruncated).toBe(true)
    expect(starved.room.nodes).toBe(0)
  })

  test("a line's controls and format characters go, tabs stay", () => {
    const { sources } = Views.codeBlocksOf(
      [
        {
          oldStart: 1,
          newStart: 1,
          lines: ['-\tesc\u001b[31m', '+\tbidi\u202Eok\r', '\\ No newline'],
        },
      ],
      Views.BODY_BUDGET,
    )

    expect(sources).toEqual(['@@ -1,1 +1,1 @@\n-\tesc[31m\n+\tbidiok'])
  })
})
