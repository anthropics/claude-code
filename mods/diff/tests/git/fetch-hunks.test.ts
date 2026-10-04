import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../hooks/git'
import Limits from '../../hooks/limits'
import Fixtures from '../fixtures'

tier('builtin')

describe('fetch-hunks', () => {
  type Answer = (asked: readonly string[], nth: number) => Git.RunResult

  const rowOf = (path: string, kind: Partial<Git.FileStat> = {}) => ({
    path,
    renamedFrom: null,
    added: 1,
    removed: 0,
    isBinary: false,
    isUntracked: false,
    isPreSession: false,
    ...kind,
  })

  const dataOf = (
    files: readonly Git.FileStat[],
    basis: Partial<Git.DiffData> = {},
  ): Git.DiffData => ({
    repository: Fixtures.FETCH_REPOSITORY,
    mode: 'uncommitted',
    stats: { filesCount: files.length, linesAdded: 0, linesRemoved: 0 },
    files,
    source: { kind: 'working-tree', base: 'HEAD' },
    isUnborn: false,
    baseRef: 'HEAD',
    stalePaths: [],
    isUntrackedWithheld: false,
    ...basis,
  })

  function gitOf(answer: Answer = Fixtures.hunksReadOf) {
    const asks: (readonly string[])[] = []
    const argvs: (readonly string[])[] = []

    const run: Git.GitRun = argv => {
      const asked = argv.slice(argv.indexOf('--') + 1)

      argvs.push(argv)
      asks.push(asked)

      return Promise.resolve(answer(asked, asks.length))
    }

    return { run, asks, argvs }
  }

  const linesOf = (body: Git.FileHunks | null | undefined) =>
    body?.hunks.flatMap(hunk => hunk.lines)

  const FIFTY = Array.from({ length: Limits.MAX_FILES }, (_, at) =>
    rowOf(`src/file${at + Limits.MAX_FILES}.ts`),
  )

  const LONG = ['a', 'b', 'c'].map(name =>
    rowOf(name.repeat(Limits.MAX_PATHSPEC_CHARS / 2)),
  )

  test('fifty files are read by one child', async () => {
    const git = gitOf()
    const read = await Git.fetchHunks(git.run, dataOf(FIFTY), FIFTY)

    expect(git.asks).toEqual([FIFTY.map(file => file.path)])
    expect(read.size).toBe(Limits.MAX_FILES)

    expect(
      FIFTY.every(
        file => linesOf(read.get(file.path))?.[1] === `+in ${file.path}`,
      ),
    ).toBe(true)
  })

  test('the child keeps every pin of the read of one file', async () => {
    const git = gitOf()

    await Git.fetchHunks(git.run, dataOf(FIFTY), FIFTY.slice(0, 1))

    expect(git.argvs[0]?.slice(0, -1)).toEqual([
      '--literal-pathspecs',
      '--no-optional-locks',
      '-c',
      'diff.relative=false',
      '-c',
      'core.quotePath=false',
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      '--ignore-submodules=dirty',
      '--submodule=short',
      '--no-renames',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      '--raw',
      '-z',
      '-p',
      'HEAD',
      '--',
    ])
  })

  test('on an unborn HEAD the child reads what is staged', async () => {
    const git = gitOf()
    const files = [rowOf('edited-since.ts'), rowOf('staged.ts')]

    const read = await Git.fetchHunks(
      git.run,
      dataOf(files, {
        isUnborn: true,
        baseRef: '--cached',
        stalePaths: ['edited-since.ts'],
      }),
      files,
    )

    expect(git.argvs[0]?.slice(-3)).toEqual(['--cached', '--', 'staged.ts'])
    expect(read.get('edited-since.ts')).toEqual(Git.EMPTY_FILE_HUNKS)
    expect(linesOf(read.get('staged.ts'))).toEqual([' one', '+in staged.ts'])
  })

  test('rows with no body are never named to git', async () => {
    const git = gitOf()

    const files = [
      rowOf('app.ts'),
      rowOf('logo.png', { isBinary: true }),
      rowOf('moved.ts', { renamedFrom: 'old.ts' }),
      rowOf('new.ts', { isUntracked: true }),
    ]

    const read = await Git.fetchHunks(git.run, dataOf(files), files)

    expect(git.asks).toEqual([['app.ts']])

    expect(
      ['logo.png', 'moved.ts', 'new.ts'].map(path => read.get(path)),
    ).toEqual([
      Git.EMPTY_FILE_HUNKS,
      Git.EMPTY_FILE_HUNKS,
      Git.EMPTY_FILE_HUNKS,
    ])
  })

  test('rows with no body alone start no child', async () => {
    const git = gitOf()
    const files = [rowOf('new.ts', { isUntracked: true })]

    await Git.fetchHunks(git.run, dataOf(files), files)

    expect(git.asks).toEqual([])
  })

  test('every file but the last gains the closing line', async () => {
    const git = gitOf()
    const files = [rowOf('a.ts'), rowOf('b.ts')]
    const read = await Git.fetchHunks(git.run, dataOf(files), files)

    expect(linesOf(read.get('a.ts'))).toEqual([' one', '+in a.ts', ' '])
    expect(linesOf(read.get('b.ts'))).toEqual([' one', '+in b.ts'])
  })

  test('paths past the budget are asked of a second child', async () => {
    const git = gitOf()
    const read = await Git.fetchHunks(git.run, dataOf(LONG), LONG)
    const paths = LONG.map(file => file.path)

    expect(git.asks).toEqual([paths.slice(0, 2), paths.slice(2)])

    expect(paths.map(path => linesOf(read.get(path))?.[1])).toEqual(
      paths.map(path => `+in ${path}`),
    )
  })

  test('one path past the budget is still asked, alone', async () => {
    const git = gitOf()
    const files = [rowOf('d'.repeat(Limits.MAX_PATHSPEC_CHARS + 1)), rowOf('e')]

    await Git.fetchHunks(git.run, dataOf(files), files)

    expect(git.asks.map(asked => asked.length)).toEqual([1, 1])
  })

  test('past the output cap the rest is asked again', async () => {
    const files = [rowOf('a.ts'), rowOf('big.ts'), rowOf('c.ts'), rowOf('d.ts')]

    const git = gitOf((asked, nth) => {
      const isFirst = nth === 1

      return isFirst
        ? Fixtures.ok(
            Fixtures.hunksAnswerOf([
              ['a.ts', Fixtures.oneAddedOf('in a.ts')],
              ['big.ts', Fixtures.longLineOf(Limits.HOST_OUTPUT_CAP_BYTES)],
              ['c.ts', Fixtures.oneAddedOf('never arrived')],
              ['d.ts', Fixtures.oneAddedOf('never arrived')],
            ]).slice(0, Limits.HOST_OUTPUT_CAP_BYTES),
          )
        : Fixtures.hunksReadOf(asked)
    })

    const read = await Git.fetchHunks(git.run, dataOf(files), files)

    expect(git.asks, 'the second list starts where the first stopped').toEqual([
      ['a.ts', 'big.ts', 'c.ts', 'd.ts'],
      ['c.ts', 'd.ts'],
    ])

    expect(linesOf(read.get('a.ts'))).toEqual([' one', '+in a.ts', ' '])
    expect(read.get('big.ts')).toEqual(Git.LARGE_FILE_HUNKS)
    expect(linesOf(read.get('c.ts'))).toEqual([' one', '+in c.ts', ' '])
    expect(linesOf(read.get('d.ts'))).toEqual([' one', '+in d.ts'])
  })

  test('a child that fails leaves every file unread', async () => {
    const git = gitOf(() => Fixtures.GIT_TIMED_OUT)
    const read = await Git.fetchHunks(git.run, dataOf(FIFTY), FIFTY)

    expect(git.asks).toHaveLength(1)
    expect([...read.values()].every(body => body === null)).toBe(true)
    expect(read.size).toBe(Limits.MAX_FILES)
  })

  test('a second child that fails keeps what the first read', async () => {
    const git = gitOf((asked, nth) => {
      const isFirst = nth === 1

      return isFirst ? Fixtures.hunksReadOf(asked) : Fixtures.UNSCRIPTED
    })

    const read = await Git.fetchHunks(git.run, dataOf(LONG), LONG)
    const [first, second, third] = LONG.map(file => read.get(file.path))

    expect(git.asks).toHaveLength(2)
    expect(linesOf(first)?.[0]).toBe(' one')
    expect(linesOf(second)?.[0]).toBe(' one')
    expect(third).toBeNull()
  })

  test('a second child is paired by its own list', async () => {
    const git = gitOf((asked, nth) => {
      const isFirst = nth === 1

      return Fixtures.hunksReadOf(isFirst ? asked : asked.toReversed())
    })

    const files = [...LONG, rowOf('z.ts')]
    const read = await Git.fetchHunks(git.run, dataOf(files), files)
    const [, , third] = LONG.map(file => file.path)

    expect(git.asks[1]).toEqual([third, 'z.ts'])
    expect(linesOf(read.get(third ?? ''))?.[1]).toBe(`+in ${third}`)
    expect(linesOf(read.get('z.ts'))).toEqual([' one', '+in z.ts'])
  })

  test('an answer whose names and patches disagree ends the read', async () => {
    const git = gitOf(() =>
      Fixtures.ok(
        Fixtures.hunksAnswerOf([
          ['a.ts', Fixtures.oneAddedOf('a'), 'diff --git a/o.ts b/o.ts'],
          ['b.ts', Fixtures.oneAddedOf('b')],
        ]),
      ),
    )

    const files = [rowOf('a.ts'), rowOf('b.ts')]
    const read = await Git.fetchHunks(git.run, dataOf(files), files)

    expect(git.asks, 'asked once, never again').toHaveLength(1)

    expect([...read]).toEqual([
      ['a.ts', null],
      ['b.ts', null],
    ])
  })
})
