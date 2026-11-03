import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../../hooks/git'
import Parse from '../../../hooks/git/parse'
import Limits from '../../../hooks/limits'
import Fixtures from '../../fixtures'

tier('builtin')

describe('parse-file-diffs', () => {
  const linesOf = (body: Git.FileHunks | undefined) =>
    body?.hunks.flatMap(hunk => hunk.lines)

  const cutAtCap = (printed: readonly Fixtures.PrintedFile[]) =>
    Fixtures.hunksAnswerOf(printed).slice(0, Limits.HOST_OUTPUT_CAP_BYTES)

  test('an empty answer: every file asked reads no hunks', () => {
    expect([...Parse.parseFileDiffs('', ['a.ts', 'b.ts'])]).toEqual([
      ['a.ts', Git.EMPTY_FILE_HUNKS],
      ['b.ts', Git.EMPTY_FILE_HUNKS],
    ])
  })

  test('each unusual name holds its own patch', () => {
    expect(
      [
        ...Parse.parseFileDiffs(
          Fixtures.hunksAnswerOf(Fixtures.UNUSUAL_NAMES),
          Fixtures.UNUSUAL_NAMES.map(([path]) => path),
        ),
      ].map(([path, body]) => [path, linesOf(body)]),
    ).toEqual(
      Fixtures.UNUSUAL_NAMES.map(([path, body]) => [
        path,
        body.split('\n').slice(1, -1),
      ]),
    )
  })

  test('the order asked in does not move a patch', () => {
    const read = Parse.parseFileDiffs(
      Fixtures.hunksAnswerOf([
        ['a.ts', Fixtures.oneAddedOf('first')],
        ['b.ts', Fixtures.oneAddedOf('next')],
      ]),
      ['b.ts', 'a.ts'],
    )

    expect(linesOf(read.get('a.ts'))).toEqual([' one', '+first'])
    expect(linesOf(read.get('b.ts'))).toEqual([' one', '+next'])
  })

  test('content that looks like an opening line stays content', () => {
    const read = Parse.parseFileDiffs(
      Fixtures.hunksAnswerOf([
        [
          'a.ts',
          '@@ -1,2 +1,2 @@\n diff --git a/b.ts b/b.ts\n' +
            '-diff --git a/x b/x\n+diff --git a/y b/y\n',
        ],
        ['b.ts', Fixtures.oneAddedOf('its own')],
      ]),
      ['a.ts', 'b.ts'],
    )

    expect(linesOf(read.get('a.ts'))).toEqual([
      ' diff --git a/b.ts b/b.ts',
      '-diff --git a/x b/x',
      '+diff --git a/y b/y',
    ])

    expect(linesOf(read.get('b.ts'))).toEqual([' one', '+its own'])
  })

  test('a file turned link: its two patches are one file', () => {
    const read = Parse.parseFileDiffs(
      Fixtures.hunksAnswerOf([
        ['a.ts', Fixtures.oneAddedOf('before')],
        [
          'link',
          'deleted file mode 100644\n@@ -1 +0,0 @@\n-one\n' +
            'diff --git a/link b/link\nnew file mode 120000\n' +
            '@@ -0,0 +1 @@\n+a.ts\n',
        ],
        ['z.ts', Fixtures.oneAddedOf('after')],
      ]),
      ['a.ts', 'link', 'z.ts'],
    )

    expect(linesOf(read.get('a.ts'))).toEqual([' one', '+before'])
    expect(linesOf(read.get('link'))).toEqual(['-one', '+a.ts'])
    expect(linesOf(read.get('z.ts'))).toEqual([' one', '+after'])
  })

  test('a conflicted file read against HEAD is one more file', () => {
    const read = Parse.parseFileDiffs(
      Fixtures.hunksAnswerOf([
        ['a.ts', Fixtures.oneAddedOf('before')],
        [
          'both changed.ts',
          '@@ -1 +1,5 @@\n+<<<<<<< ours\n one\n+=======\n+theirs\n+>>>>>>> ' +
            'theirs\n',
        ],
        ['gone on our side.ts', '@@ -0,0 +1 @@\n+theirs\n'],
        ['z.ts', Fixtures.oneAddedOf('after')],
      ]).replace(
        Fixtures.rawRecordOf('gone on our side.ts'),
        Fixtures.rawRecordOf('gone on our side.ts').replace(' M\0', ' A\0'),
      ),
      ['a.ts', 'both changed.ts', 'gone on our side.ts', 'z.ts'],
    )

    expect(linesOf(read.get('a.ts'))).toEqual([' one', '+before'])

    expect(linesOf(read.get('both changed.ts'))).toEqual([
      '+<<<<<<< ours',
      ' one',
      '+=======',
      '+theirs',
      '+>>>>>>> theirs',
    ])

    expect(linesOf(read.get('gone on our side.ts'))).toEqual(['+theirs'])
    expect(linesOf(read.get('z.ts'))).toEqual([' one', '+after'])
  })

  test('an unmerged path has no patch and reads no hunks', () => {
    const read = Parse.parseFileDiffs(
      Fixtures.hunksAnswerOf([
        ['a.ts', `${Fixtures.oneAddedOf('before')}* Unmerged path c.ts\n`],
        ['z.ts', Fixtures.oneAddedOf('after')],
      ]).replace(
        Fixtures.rawRecordOf('z.ts'),
        Fixtures.rawRecordOf('c.ts').replace(' M\0', ' U\0') +
          Fixtures.rawRecordOf('z.ts'),
      ),
      ['a.ts', 'c.ts', 'z.ts'],
    )

    expect(linesOf(read.get('a.ts'))).toEqual([' one', '+before'])
    expect(read.get('c.ts')).toEqual(Git.EMPTY_FILE_HUNKS)
    expect(linesOf(read.get('z.ts'))).toEqual([' one', '+after'])
  })

  test('a file git no longer lists reads no hunks', () => {
    const read = Parse.parseFileDiffs(
      Fixtures.hunksAnswerOf([['kept.ts', Fixtures.oneAddedOf('changed')]]),
      ['gone.ts', 'kept.ts'],
    )

    expect(read.get('gone.ts')).toEqual(Git.EMPTY_FILE_HUNKS)
    expect(linesOf(read.get('kept.ts'))).toEqual([' one', '+changed'])
  })

  test('a listed file nobody asked for is left out', () => {
    const read = Parse.parseFileDiffs(
      Fixtures.hunksAnswerOf([
        ['made', '@@ -1 +0,0 @@\n-a file\n'],
        ['made/inside.ts', '@@ -0,0 +1 @@\n+now a folder\n'],
      ]),
      ['made'],
    )

    expect([...read.keys()]).toEqual(['made'])
    expect(linesOf(read.get('made'))).toEqual(['-a file'])
  })

  test('with no empty field before the patches it reads the same', () => {
    expect(
      linesOf(
        Parse.parseFileDiffs(
          Fixtures.hunksAnswerOf([
            ['a.ts', Fixtures.oneAddedOf('unparted')],
          ]).replace('\0\0', '\0'),
          ['a.ts'],
        ).get('a.ts'),
      ),
    ).toEqual([' one', '+unparted'])
  })

  test('fewer patches than names settle nothing', () => {
    expect(
      Parse.parseFileDiffs(
        Fixtures.rawRecordOf('a.ts') +
          Fixtures.hunksAnswerOf([['b.ts', Fixtures.oneAddedOf('whose')]]),
        ['a.ts', 'b.ts'],
      ).size,
    ).toBe(0)
  })

  test('a patch opened under another name settles nothing', () => {
    expect(
      Parse.parseFileDiffs(
        Fixtures.hunksAnswerOf([
          ['a.ts', Fixtures.oneAddedOf('here'), 'diff --git a/b.ts b/b.ts'],
          ['b.ts', Fixtures.oneAddedOf('there'), 'diff --git a/a.ts b/a.ts'],
        ]),
        ['a.ts', 'b.ts'],
      ).size,
    ).toBe(0)
  })

  test('patches git coloured: no hunks, as one file read alone', () => {
    expect([
      ...Parse.parseFileDiffs(
        Fixtures.hunksAnswerOf([
          [
            'a.ts',
            '\u001b[36m@@ -1 +1,2 @@\u001b[m\n one\n\u001b[32m+two\u001b[m\n',
            '\u001b[1mdiff --git a/a.ts b/a.ts\u001b[m',
          ],
        ]),
        ['a.ts'],
      ),
    ]).toEqual([['a.ts', Git.EMPTY_FILE_HUNKS]])
  })

  test('the line cap and the size cap hold file by file', () => {
    const long = Array.from(
      { length: Limits.MAX_LINES_PER_FILE + Fixtures.PAST_THE_CAP },
      (_, at) => `+${at}`,
    ).join('\n')

    const read = Parse.parseFileDiffs(
      Fixtures.hunksAnswerOf([
        ['large.ts', Fixtures.longLineOf(Limits.MAX_DIFF_BYTES)],
        ['long.ts', `@@ -0,0 +1,405 @@\n${long}\n`],
        ['small.ts', Fixtures.oneAddedOf('whole')],
      ]),
      ['large.ts', 'long.ts', 'small.ts'],
    )

    expect(read.get('large.ts')).toEqual(Git.LARGE_FILE_HUNKS)
    expect(read.get('long.ts')?.isTruncated).toBe(true)

    expect(linesOf(read.get('long.ts'))).toHaveLength(Limits.MAX_LINES_PER_FILE)

    expect(read.get('small.ts')?.isTruncated).toBe(false)
    expect(linesOf(read.get('small.ts'))).toEqual([' one', '+whole'])
  })

  test('a file at the size cap to the character is not large', () => {
    const room =
      Limits.MAX_DIFF_BYTES -
      Fixtures.hunksAnswerOf([['edge.ts', Fixtures.longLineOf(0)]]).replace(
        /^.*\0/s,
        '',
      ).length

    const largePast = (extra: number) =>
      Parse.parseFileDiffs(
        Fixtures.hunksAnswerOf([
          ['edge.ts', Fixtures.longLineOf(room + extra)],
          ['next.ts', Fixtures.oneAddedOf('after it')],
        ]),
        ['edge.ts', 'next.ts'],
      ).get('edge.ts')?.isLarge

    expect(largePast(0)).toBe(false)
    expect(largePast(1)).toBe(true)
  })

  test('cut by the host: whole files settle, the rest wait', () => {
    const read = Parse.parseFileDiffs(
      cutAtCap([
        ['a.ts', Fixtures.oneAddedOf('whole')],
        ['big.ts', Fixtures.longLineOf(Limits.MAX_DIFF_BYTES)],
        ['cut.ts', Fixtures.longLineOf(Limits.HOST_OUTPUT_CAP_BYTES)],
        ['unseen.ts', Fixtures.oneAddedOf('never arrived')],
      ]),
      ['a.ts', 'big.ts', 'cut.ts', 'unseen.ts'],
    )

    expect([...read.keys()]).toEqual(['a.ts', 'big.ts', 'cut.ts'])
    expect(linesOf(read.get('a.ts'))).toEqual([' one', '+whole'])
    expect(read.get('big.ts')).toEqual(Git.LARGE_FILE_HUNKS)

    expect(read.get('cut.ts'), 'what arrived of it is already large').toEqual(
      Git.LARGE_FILE_HUNKS,
    )
  })

  test('cut by the host inside a small file: that file waits', () => {
    expect([
      ...Parse.parseFileDiffs(
        cutAtCap([
          [
            'big.ts',
            Fixtures.longLineOf(
              Limits.HOST_OUTPUT_CAP_BYTES - Limits.MAX_DIFF_BYTES / 2,
            ),
          ],
          ['cut.ts', Fixtures.longLineOf(Limits.MAX_DIFF_BYTES)],
          ['unseen.ts', Fixtures.oneAddedOf('never arrived')],
        ]),
        ['big.ts', 'cut.ts', 'unseen.ts'],
      ),
    ]).toEqual([['big.ts', Git.LARGE_FILE_HUNKS]])
  })

  test('cut by the host: a file git did not list reads no hunks', () => {
    expect([
      ...Parse.parseFileDiffs(
        cutAtCap([
          ['cut.ts', Fixtures.longLineOf(Limits.HOST_OUTPUT_CAP_BYTES)],
          ['unseen.ts', Fixtures.oneAddedOf('never arrived')],
        ]),
        ['cut.ts', 'gone.ts', 'unseen.ts'],
      ),
    ]).toEqual([
      ['cut.ts', Git.LARGE_FILE_HUNKS],
      ['gone.ts', Git.EMPTY_FILE_HUNKS],
    ])
  })
})
