import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../../hooks/limits'
import Turns from '../../hooks/turns'
import Fixtures from '../fixtures'

tier('builtin')

describe('turn-diffs-of', () => {
  test('turns with edits, newest first, numbered by prompt', () => {
    const turns = Turns.turnDiffsOf([
      Fixtures.promptOf('first'),
      Fixtures.editsOf(Fixtures.editPatchOf(['-a', '+b'])),
      Fixtures.toolResults(),
      Fixtures.promptOf('second, nothing edited'),
      Fixtures.promptOf('third turn with a long prompt that gets cut'),
      Fixtures.editsOf(Fixtures.editPatchOf(['+c']), {
        filePath: '/r/new.ts',
        type: 'create',
        content: 'x\ny',
      }),
      Fixtures.toolResults(),
    ])

    expect(turns.map(turn => turn.index)).toEqual([3, 1])
    expect(turns[0]?.preview).toBe('third turn with a long prompt…')

    expect(
      turns[0]?.files.map(file => [
        file.path,
        file.added,
        file.removed,
        file.isNewFile,
      ]),
    ).toEqual([
      ['/r/a.ts', 1, 0, false],
      ['/r/new.ts', 2, 0, true],
    ])

    expect(turns[0]?.files[1]?.hunks).toEqual([
      { oldStart: 0, newStart: 1, lines: ['+x', '+y'] },
    ])

    expect(turns[1]?.files.map(file => [file.added, file.removed])).toEqual([
      [1, 1],
    ])
  })

  test('a file edited twice in a turn: both hunks, summed', () => {
    const [turn] = Turns.turnDiffsOf([
      Fixtures.promptOf('go'),
      Fixtures.editsOf(
        Fixtures.editPatchOf(['+a']),
        Fixtures.editPatchOf(['-b', '+c']),
      ),
    ])

    expect(turn?.files).toHaveLength(1)
    expect(turn?.files[0]?.hunks).toHaveLength(2)
    expect([turn?.files[0]?.added, turn?.files[0]?.removed]).toEqual([2, 1])
  })

  test('results that are not file edits are ignored', () => {
    expect(
      Turns.turnDiffsOf([
        Fixtures.promptOf('go'),
        Fixtures.editsOf({ stdout: 'x' }, 'text', null),
      ]),
    ).toEqual([])
  })

  test('a big created file is cut at the line cap and says so', () => {
    const [turn] = Turns.turnDiffsOf([
      Fixtures.promptOf('write it'),
      Fixtures.editsOf({
        filePath: '/r/big.ts',
        type: 'create',
        content: Array.from(
          { length: Fixtures.BIG_LINES },
          (_, at) => `l${at}`,
        ).join('\n'),
      }),
    ])

    const file = turn?.files[0]

    expect(file?.hunks.flatMap(hunk => hunk.lines)).toHaveLength(
      Limits.MAX_LINES_PER_FILE,
    )

    expect(file?.isTruncated).toBe(true)
    expect(file?.added).toBe(Fixtures.BIG_LINES)
  })
})
