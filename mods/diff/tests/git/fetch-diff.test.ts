import type { ProcessRunResult } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../hooks/git'
import Limits from '../../hooks/limits'
import Fixtures from '../fixtures'

tier('builtin')

describe('fetch-diff', () => {
  const HALF_CAP_RECORDS = Limits.HOST_OUTPUT_CAP_BYTES / 2
  const NEAR_CAP_RECORDS = HALF_CAP_RECORDS - 2

  type Script = Record<string, ProcessRunResult>
  type Listing = readonly (readonly [string, Git.EntryKind])[]
  type ScriptedDeps = Git.GitDeps & Pick<Fixtures.ScriptedGit, 'argvs'>

  const listingOf = (entries: Listing): ReadonlyMap<string, Git.EntryKind> =>
    new Map(entries)

  function depsOf(
    script: Script,
    overrides: Partial<Git.GitDeps> = {},
  ): ScriptedDeps {
    const scripted = Fixtures.scriptedGitOf(script)

    return {
      argvs: scripted.argvs,
      run: scripted.run,
      repository: Fixtures.FETCH_REPOSITORY,
      mtimeOf: () => Promise.resolve(Fixtures.DURING_SESSION_MS),
      entryKindsOf: () => Promise.resolve(listingOf(Fixtures.FILES_LISTING)),
      sessionStartMs: Fixtures.GIT_SESSION_START_MS,
      onBranchBase: () => undefined,
      ...overrides,
    }
  }

  const unbornScriptOf = (): Script => ({
    [Fixtures.VS_HEAD]: Fixtures.UNSCRIPTED,
    'rev-parse --verify --quiet HEAD': Fixtures.PROBE_MISSED,
    '--cached --shortstat': Fixtures.ok(Fixtures.ONE_STAGED),
    'ls-files': Fixtures.ok(),
  })

  const datedBefore =
    (suffix: string): Git.GitDeps['mtimeOf'] =>
    path =>
      Promise.resolve(
        path.endsWith(suffix)
          ? Fixtures.BEFORE_SESSION_MS
          : Fixtures.DURING_SESSION_MS,
      )

  const trackedNoUntrackedOf = (): Script => ({
    'HEAD --shortstat': Fixtures.ok(' 1 file changed, 1 insertion(+)'),
    'HEAD --numstat': Fixtures.ok('1\t0\ta.ts\0'),
    'ls-files': Fixtures.GIT_TIMED_OUT,
  })

  const onFeatureNoUntrackedOf = (): Script => ({
    'rev-parse --abbrev-ref HEAD': Fixtures.ok('feature\n'),
    'symbolic-ref --short refs/remotes/origin/HEAD':
      Fixtures.ok('origin/main\n'),
    'show-ref --verify --quiet refs/remotes/origin/main': Fixtures.ok(),
    'merge-base HEAD origin/main': Fixtures.ok(`${Fixtures.ORIGIN_BASE}\n`),
    'rev-parse HEAD': Fixtures.ok(`${Fixtures.FEATURE_HEAD}\n`),
    [`${Fixtures.ORIGIN_BASE} --shortstat`]: Fixtures.ok(Fixtures.ONE_STAGED),
    [`${Fixtures.ORIGIN_BASE} --numstat`]: Fixtures.ok('3\t0\ta.ts\0'),
    'ls-files': Fixtures.GIT_TIMED_OUT,
  })

  const unbornNoUntrackedOf = (): Script => ({
    ...unbornScriptOf(),
    '--cached --numstat': Fixtures.ok('3\t0\tstaged.ts\0'),
    '--submodule=short --numstat': Fixtures.ok('2\t1\tstaged.ts\0'),
    'ls-files': Fixtures.GIT_TIMED_OUT,
  })

  test('session mode: rows tagged by mtime, untracked merged', async () => {
    const outcome = await Git.fetchDiff(
      depsOf(
        {
          'HEAD --shortstat': Fixtures.ok(
            ' 2 files changed, 3 insertions(+), 1 deletion(-)',
          ),
          'HEAD --numstat': Fixtures.ok('2\t1\told.ts\x001\t0\tnew.ts\0'),
          'ls-files': Fixtures.ok('scratch.txt\0'),
        },
        { mtimeOf: datedBefore('old.ts') },
      ),
      'session',
    )

    const data = outcome.kind === 'data' ? outcome.data : null

    expect(data?.repository).toEqual(Fixtures.FETCH_REPOSITORY)
    expect(data?.baseRef).toBe('HEAD')
    expect(data?.isUnborn).toBe(false)

    expect(data?.stats).toEqual({
      filesCount: 3,
      linesAdded: 3,
      linesRemoved: 1,
    })

    expect(
      data?.files.map(file => [file.path, file.isPreSession, file.isUntracked]),
    ).toEqual([
      ['old.ts', true, false],
      ['new.ts', false, false],
      ['scratch.txt', false, true],
    ])
  })

  test('every diff spawn carries the pinned leading argv', async () => {
    const deps = depsOf({
      'HEAD --shortstat': Fixtures.ok(' 1 file changed, 1 insertion(+)'),
      'HEAD --numstat': Fixtures.ok('1\t0\ta.ts\0'),
      'ls-files': Fixtures.ok(),
    })

    await Git.fetchDiff(deps, 'uncommitted')

    const diffs = deps.argvs.filter(argv => argv.includes('diff'))

    expect(deps.argvs.every(argv => argv[0] === '--no-optional-locks')).toBe(
      true,
    )

    expect(diffs).toHaveLength(2)

    expect(diffs.every(argv => argv.includes('core.quotePath=false'))).toBe(
      true,
    )

    expect(diffs.every(argv => argv.includes('--no-ext-diff'))).toBe(true)
    expect(diffs.every(argv => argv.includes('--no-textconv'))).toBe(true)
    expect(diffs[1]).toContain('-z')
    expect(deps.argvs.find(argv => argv.includes('ls-files'))).toContain('-z')

    expect(
      diffs.every(
        argv =>
          argv.slice(0, Git.DIFF_LEADING_ARGS.length).join(' ') ===
          Git.DIFF_LEADING_ARGS.join(' '),
      ),
    ).toBe(true)
  })

  test('uncommitted mode drops pre-session untracked files', async () => {
    const outcome = await Git.fetchDiff(
      depsOf(
        {
          'HEAD --shortstat': Fixtures.ok(),
          'HEAD --numstat': Fixtures.ok(),
          'ls-files': Fixtures.ok('stale.txt\0fresh.txt\0'),
        },
        { mtimeOf: datedBefore('stale.txt') },
      ),
      'uncommitted',
    )

    expect(
      outcome.kind === 'data' && outcome.data.files.map(file => file.path),
    ).toEqual(['fresh.txt'])
  })

  test('past 500 files: totals only, no numstat, no untracked', async () => {
    const deps = depsOf({
      'HEAD --shortstat': Fixtures.ok(' 501 files changed, 9 insertions(+)'),
    })

    const outcome = await Git.fetchDiff(deps, 'session')

    expect(outcome.kind === 'data' && outcome.data.stats.filesCount).toBe(501)
    expect(outcome.kind === 'data' && outcome.data.files).toEqual([])
    expect(deps.argvs.some(argv => argv.includes('--numstat'))).toBe(false)
    expect(deps.argvs.some(argv => argv.includes('ls-files'))).toBe(false)
  })

  test('a transient state file: unavailable, and no diff runs', async () => {
    const deps = depsOf(
      {},
      {
        entryKindsOf: dir =>
          Promise.resolve(
            listingOf(
              dir === '/repo/.git' ? Fixtures.MERGING : Fixtures.FILES_LISTING,
            ),
          ),
      },
    )

    expect(await Git.fetchDiff(deps, 'session')).toEqual({
      kind: 'unavailable',
    })

    expect(deps.argvs.some(argv => argv.includes('diff'))).toBe(false)
  })

  test('unborn HEAD: staged rows with unstaged edits folded in', async () => {
    const outcome = await Git.fetchDiff(
      depsOf({
        [Fixtures.VS_HEAD]: Fixtures.UNSCRIPTED,
        'rev-parse --verify --quiet HEAD': Fixtures.PROBE_MISSED,
        '--cached --shortstat': Fixtures.ok(' 1 file changed, 3 insertions(+)'),
        '--cached --numstat': Fixtures.ok('3\t0\tstaged.ts\0'),
        '--submodule=short --numstat': Fixtures.ok('2\t1\tstaged.ts\0'),
        'ls-files': Fixtures.ok(),
      }),
      'session',
    )

    const data = outcome.kind === 'data' ? outcome.data : null

    expect(data?.isUnborn).toBe(true)
    expect(data?.baseRef).toBe('--cached')

    expect(
      data?.files.map(file => [file.path, file.added, file.removed]),
    ).toEqual([['staged.ts', 4, 0]])

    expect(data?.stats.linesAdded).toBe(4)
    expect(data?.stalePaths).toEqual(['staged.ts'])
  })

  test('unborn HEAD: a staged or unstaged listing git withheld', async () => {
    const noStaged = await Git.fetchDiff(depsOf(unbornScriptOf()), 'session')

    const noUnstaged = await Git.fetchDiff(
      depsOf({
        ...unbornScriptOf(),
        '--cached --numstat': Fixtures.ok('3\t0\tstaged.ts\0'),
        '--submodule=short --numstat': Fixtures.ok('2\t1\tstaged.ts'),
      }),
      'session',
    )

    expect(noStaged).toEqual({ kind: 'unavailable' })
    expect(noUnstaged).toEqual({ kind: 'unavailable' })
  })

  test('a withheld untracked listing: tracked rows, flagged', async () => {
    const outcomes = await Promise.all([
      Git.fetchDiff(depsOf(trackedNoUntrackedOf()), 'session'),
      Git.fetchDiff(depsOf(trackedNoUntrackedOf()), 'uncommitted'),
      Git.fetchDiff(depsOf(onFeatureNoUntrackedOf()), 'branch'),
      Git.fetchDiff(depsOf(unbornNoUntrackedOf()), 'session'),
    ])

    const listed = await Git.fetchDiff(
      depsOf({
        ...trackedNoUntrackedOf(),
        'ls-files': Fixtures.ok('new.ts\0'),
      }),
      'uncommitted',
    )

    expect(
      outcomes.map(
        outcome =>
          outcome.kind === 'data' && [
            outcome.data.files.map(file => file.path),
            outcome.data.stats.filesCount,
            outcome.data.isUntrackedWithheld,
          ],
      ),
    ).toEqual([
      [['a.ts'], 1, true],
      [['a.ts'], 1, true],
      [['a.ts'], 1, true],
      [['staged.ts'], 1, true],
    ])

    expect(listed.kind === 'data' && listed.data.isUntrackedWithheld).toBe(
      false,
    )
  })

  test('a failed vs-HEAD diff with commits present: unavailable', async () => {
    expect(
      await Git.fetchDiff(
        depsOf({
          'rev-parse --verify --quiet HEAD': Fixtures.ok('abc\n'),
        }),
        'session',
      ),
    ).toEqual({ kind: 'unavailable' })
  })

  test('a tracked or untracked symlink is never dated: no stat', async () => {
    const probed: string[] = []

    const outcome = await Git.fetchDiff(
      depsOf(
        {
          'HEAD --shortstat': Fixtures.ok(' 2 files changed, 2 insertions(+)'),
          'HEAD --numstat': Fixtures.ok('1\t0\told.ts\x001\t0\tlink.ts\0'),
          'ls-files': Fixtures.ok('leak\0scratch.txt\0'),
        },
        {
          mtimeOf: path => {
            probed.push(path)

            return Promise.resolve(Fixtures.BEFORE_SESSION_MS)
          },
        },
      ),
      'session',
    )

    const data = outcome.kind === 'data' ? outcome.data : null

    expect(probed.toSorted()).toEqual(['/repo/old.ts', '/repo/scratch.txt'])

    expect(data?.files.map(file => [file.path, file.isPreSession])).toEqual([
      ['old.ts', true],
      ['link.ts', false],
      ['leak', false],
      ['scratch.txt', true],
    ])
  })

  test('an unlistable directory dates nothing and stats nothing', async () => {
    const probed: string[] = []

    await Git.fetchDiff(
      depsOf(
        {
          'HEAD --shortstat': Fixtures.ok(' 1 file changed, 1 insertion(+)'),
          'HEAD --numstat': Fixtures.ok('1\t0\told.ts\0'),
          'ls-files': Fixtures.ok('scratch.txt\0'),
        },
        {
          entryKindsOf: () => Promise.resolve(null),
          mtimeOf: path => {
            probed.push(path)

            return Promise.resolve(Fixtures.BEFORE_SESSION_MS)
          },
        },
      ),
      'session',
    )

    expect(probed).toEqual([])
  })

  test('a MERGE_HEAD that is a symbolic link is no merge', async () => {
    const outcome = await Git.fetchDiff(
      depsOf(
        {
          'HEAD --shortstat': Fixtures.ok(' 1 file changed, 1 insertion(+)'),
          'HEAD --numstat': Fixtures.ok('1\t0\ta.ts\0'),
          'ls-files': Fixtures.ok(),
        },
        {
          entryKindsOf: dir => {
            const isGitDir = dir === '/repo/.git'

            return Promise.resolve(
              listingOf(
                isGitDir ? Fixtures.MERGE_HEAD_LINKED : Fixtures.FILES_LISTING,
              ),
            )
          },
        },
      ),
      'session',
    )

    expect(outcome).toMatchObject({ kind: 'data' })
    expect(outcome.kind === 'data' && outcome.data.files).toHaveLength(1)
  })

  test('a path under a symlinked directory: unlisted, undated', async () => {
    const listed: string[] = []
    const probed: string[] = []

    const outcome = await Git.fetchDiff(
      depsOf(
        {
          'HEAD --shortstat': Fixtures.ok(' 1 file changed, 1 insertion(+)'),
          'HEAD --numstat': Fixtures.ok('1\t0\tsub/inner.ts\0'),
          'ls-files': Fixtures.ok(),
        },
        {
          entryKindsOf: dir => {
            listed.push(dir)

            return Promise.resolve(listingOf(Fixtures.FILES_LISTING))
          },
          mtimeOf: path => {
            probed.push(path)

            return Promise.resolve(Fixtures.BEFORE_SESSION_MS)
          },
        },
      ),
      'session',
    )

    expect(listed).not.toContain('/repo/sub')
    expect(probed).toEqual([])

    expect(
      outcome.kind === 'data' && outcome.data.files.map(f => f.isPreSession),
    ).toEqual([false])
  })

  test('a listing the host cut short is never parsed', async () => {
    const cutNumstat = await Git.fetchDiff(
      depsOf({
        'HEAD --shortstat': Fixtures.ok(' 2 files changed, 2 insertions(+)'),
        'HEAD --numstat': Fixtures.ok('1\t0\ta.ts\x001\t0\told'),
        'rev-parse --verify --quiet HEAD': Fixtures.ok('abc\n'),
      }),
      'uncommitted',
    )

    const cutUntracked = await Git.fetchDiff(
      depsOf({
        'HEAD --shortstat': Fixtures.ok(' 1 file changed, 1 insertion(+)'),
        'HEAD --numstat': Fixtures.ok('1\t0\ta.ts\0'),
        'ls-files': Fixtures.ok('scratch.txt\0fresh.tx'),
      }),
      'uncommitted',
    )

    expect(cutNumstat).toEqual({ kind: 'unavailable' })

    expect(
      cutUntracked.kind === 'data' && [
        cutUntracked.data.files.map(f => f.path),
        cutUntracked.data.isUntrackedWithheld,
      ],
    ).toEqual([['a.ts'], true])

    expect(Git.isWholeListing('a\0'.repeat(HALF_CAP_RECORDS))).toBe(false)
    expect(Git.isWholeListing('a\0'.repeat(NEAR_CAP_RECORDS))).toBe(true)
  })

  test('an untracked directory git prints with a slash is dated', async () => {
    const probed: string[] = []

    const outcome = await Git.fetchDiff(
      depsOf(
        {
          'HEAD --shortstat': Fixtures.ok(),
          'HEAD --numstat': Fixtures.ok(),
          'ls-files': Fixtures.ok('nested/\0'),
        },
        {
          entryKindsOf: () => Promise.resolve(listingOf([['nested', 'dir']])),
          mtimeOf: path => {
            probed.push(path)

            return Promise.resolve(Fixtures.BEFORE_SESSION_MS)
          },
        },
      ),
      'session',
    )

    expect(probed).toEqual(['/repo/nested'])

    expect(
      outcome.kind === 'data' &&
        outcome.data.files.map(file => [file.path, file.isPreSession]),
    ).toEqual([['nested/', true]])
  })

  test('a hundred directories deep and wide still date', async () => {
    const listed: string[] = []

    const paths = Array.from(
      { length: Fixtures.DEEP_DIRECTORIES },
      (_, at) => `d${at}/nested/file${at}.txt`,
    )

    const outcome = await Git.fetchDiff(
      depsOf(
        {
          'HEAD --shortstat': Fixtures.ok(),
          'HEAD --numstat': Fixtures.ok(),
          'ls-files': Fixtures.ok(paths.map(path => `${path}\0`).join('')),
        },
        {
          entryKindsOf: dir => {
            listed.push(dir)

            const isLeaf = dir.endsWith('/nested')

            const entries: Listing = isLeaf
              ? paths.map(path => [path.split('/').at(-1) ?? '', 'file'])
              : [
                  ['nested', 'dir'],
                  ...paths.map(
                    path => [path.slice(0, path.indexOf('/')), 'dir'] as const,
                  ),
                ]

            return Promise.resolve(listingOf(entries))
          },
          mtimeOf: () => Promise.resolve(Fixtures.BEFORE_SESSION_MS),
        },
      ),
      'session',
    )

    const rows = outcome.kind === 'data' ? outcome.data.files : []

    expect(
      new Set(listed.filter(dir => dir !== Fixtures.FETCH_REPOSITORY.gitDir))
        .size,
    ).toBe(1 + 2 * Fixtures.DEEP_DIRECTORIES)

    expect(rows).toHaveLength(Limits.MAX_FILES)
    expect(rows.every(row => row.isPreSession)).toBe(true)
  })

  test('a rename is one row under its new name, diffed as a pair', async () => {
    const deps = depsOf({
      'HEAD --shortstat': Fixtures.ok(' 1 file changed, 1 insertion(+)'),
      'HEAD --numstat': Fixtures.ok('1\t1\t\0old.ts\0new.ts\0'),
      'ls-files': Fixtures.ok(),
      '-- old.ts new.ts': Fixtures.ok('@@ -1 +1 @@\n-a\n+b\n'),
    })

    const outcome = await Git.fetchDiff(deps, 'uncommitted')
    const data = outcome.kind === 'data' ? outcome.data : null
    const [row] = data?.files ?? []

    const body =
      data && row ? await Git.fetchFileHunks(deps.run, data, row) : null

    expect(data?.files.map(f => [f.path, f.renamedFrom])).toEqual([
      ['new.ts', 'old.ts'],
    ])

    expect(body?.hunks[0]?.lines).toEqual(['-a', '+b'])
  })
})
