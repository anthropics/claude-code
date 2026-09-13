import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../../../hooks/limits'
import Views from '../../../hooks/views'
import Fixtures from '../../fixtures'

tier('builtin')

describe('code-blocks-of', () => {
  test('hunks share a block while they fit, then one opens', () => {
    const { blocks, isTruncated } = Views.codeBlocksOf([
      Fixtures.wideHunk(),
      Fixtures.wideHunk(Fixtures.BIG_LINES),
      Fixtures.wideHunk(2 * Fixtures.BIG_LINES),
    ])

    expect(isTruncated).toBe(false)
    expect(blocks.map(block => block.hasDivider)).toEqual([false, true])
    expect(blocks.every(Fixtures.isWithinCodeCap)).toBe(true)

    expect(blocks.map(block => Fixtures.hunksOf(block.source).length)).toEqual([
      2, 1,
    ])

    expect(Fixtures.hunksOf(blocks[1]?.source ?? '')[0]?.oldStart).toBe(
      2 * Fixtures.BIG_LINES,
    )
  })

  test('an oversize hunk stacks as sub-hunks that add up', () => {
    const hunk = Fixtures.wideHunk(
      Fixtures.BIG_LINES,
      Limits.MAX_LINES_PER_FILE,
    )

    const body = Views.codeBlocksOf([hunk])
    const parts = Fixtures.parsedHunksOf(body)

    expect(body.isTruncated).toBe(false)
    expect(body.blocks.length).toBeGreaterThan(2)
    expect(body.blocks.some(block => block.hasDivider)).toBe(false)
    expect(body.blocks.every(Fixtures.isWithinCodeCap)).toBe(true)
    expect(parts).toHaveLength(body.blocks.length)
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

    const body = Views.codeBlocksOf([hunk])
    const parts = Fixtures.parsedHunksOf(body)

    expect(Fixtures.MATHEMATICAL_BOLD_A).toHaveLength(2)
    expect(body.isTruncated).toBe(false)
    expect(body.blocks.length).toBeGreaterThan(2)
    expect(body.blocks.every(Fixtures.isWithinCodeCap)).toBe(true)
    expect(parts.flatMap(part => part.lines)).toEqual([...hunk.lines])
    expect(Fixtures.areContiguous(parts)).toBe(true)
  })

  test('a line longer than any source holds is cut, reported', () => {
    const body = Views.codeBlocksOf([
      {
        oldStart: 1,
        newStart: 1,
        lines: [`+${'z'.repeat(2 * Views.MAX_CODE_CHARS)}`, '+b'],
      },
    ])

    const lines = Fixtures.parsedHunksOf(body).flatMap(part => part.lines)

    expect(body.isTruncated).toBe(true)
    expect(body.blocks.every(Fixtures.isWithinCodeCap)).toBe(true)
    expect(lines).toEqual([expect.stringMatching(/^\+z+$/), '+b'])
  })

  test("a line's controls and format characters go, tabs stay", () => {
    const { blocks } = Views.codeBlocksOf([
      {
        oldStart: 1,
        newStart: 1,
        lines: ['-\tesc\u001b[31m', '+\tbidi\u202Eok\r', '\\ No newline'],
      },
    ])

    expect(blocks.map(block => block.source)).toEqual([
      '@@ -1,1 +1,1 @@\n-\tesc[31m\n+\tbidiok',
    ])
  })
})
