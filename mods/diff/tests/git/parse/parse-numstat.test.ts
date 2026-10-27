import { describe, expect, test, tier } from 'claude-code/testing'

import Parse from '../../../hooks/git/parse'
import Limits from '../../../hooks/limits'

tier('builtin')

describe('parse-numstat', () => {
  test('NUL records: totals, binaries at 0/0, tabs in a path kept', () => {
    const parsed = Parse.parseNumstat(
      '3\t1\tsrc/a.ts\0-\t-\timg.png\x002\t0\ta\tb.ts\0',
      Limits.MAX_FILES,
    )

    expect(parsed.stats).toEqual({
      filesCount: 3,
      linesAdded: 5,
      linesRemoved: 1,
    })

    expect(parsed.files.map(file => [file.path, file.isBinary])).toEqual([
      ['src/a.ts', false],
      ['img.png', true],
      ['a\tb.ts', false],
    ])

    expect(
      parsed.files.every(file => !file.isUntracked && !file.isPreSession),
    ).toBe(true)
  })

  test('the cap keeps the first rows but counts every row', () => {
    const parsed = Parse.parseNumstat('1\t0\ta\x001\t0\tb\x001\t0\tc\0', 2)

    expect(parsed.files.map(file => file.path)).toEqual(['a', 'b'])
    expect(parsed.stats.filesCount).toBe(3)
  })

  test('a line with fewer than three fields is no row', () => {
    expect(
      Parse.parseNumstat('\0warning: x\0', Limits.MAX_FILES).stats.filesCount,
    ).toBe(0)
  })

  test('a non-ASCII path arrives as its own characters', () => {
    expect(
      Parse.parseNumstat('1\t1\tdocs/caf\u00e9.md\0', Limits.MAX_FILES).files[0]
        ?.path,
    ).toBe('docs/caf\u00e9.md')
  })

  test('a rename record keeps the new path and remembers the old', () => {
    const parsed = Parse.parseNumstat(
      '2\t1\t\0src/old.ts\0src/new.ts\x003\t0\tkept.ts\0',
      Limits.MAX_FILES,
    )

    expect(
      parsed.files.map(file => [file.path, file.renamedFrom, file.added]),
    ).toEqual([
      ['src/new.ts', 'src/old.ts', 2],
      ['kept.ts', null, 3],
    ])

    expect(parsed.stats.filesCount).toBe(2)
  })
})
