import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../../hooks/git'
import Fixtures from '../../fixtures'

tier('builtin')

describe('datings-of', () => {
  type Listing = ReadonlyMap<string, Git.EntryKind>

  const LISTINGS: ReadonlyMap<string, Listing> = new Map<string, Listing>([
    [
      '/repo',
      new Map([
        ['a', 'dir'],
        ['b', 'dir'],
        ['c', 'dir'],
        ['deep', 'dir'],
      ]),
    ],
    ['/repo/a', new Map([['x', 'file']])],
    ['/repo/b', new Map([['y', 'file']])],
    ['/repo/c', new Map([['z', 'file']])],
    [
      '/repo/deep',
      new Map([
        ['x.ts', 'file'],
        ['y.txt', 'file'],
      ]),
    ],
  ])

  function probeOf(budget: number) {
    const listed: string[] = []
    const statted: string[] = []

    const probe = Git.stampProbeOf(
      {
        entryKindsOf: dir => {
          listed.push(dir)

          return Promise.resolve(LISTINGS.get(dir) ?? null)
        },
        mtimeOf: path => {
          statted.push(path)

          return Promise.resolve(Fixtures.BEFORE_SESSION_MS)
        },
      },
      '/repo',
      budget,
    )

    return { probe, listed, statted }
  }

  const depsOf = (run: Git.GitRun, probe: Git.StampProbe): Git.GitDeps => ({
    run,
    repository: Fixtures.CHECKOUT,
    mtimeOf: probe.mtimeOf,
    entryKindsOf: () => Promise.resolve(null),
    sessionStartMs: Fixtures.GIT_SESSION_START_MS,
    onBranchBase: () => undefined,
  })

  function contextOf(probe: Git.StampProbe, listing: string) {
    const { run } = Fixtures.scriptedGitOf({ 'ls-files': Fixtures.ok(listing) })

    return { run, deps: depsOf(run, probe), stamps: probe }
  }

  test('a spent budget answers unlisted, and stats nothing there', async () => {
    const recorded = probeOf(Fixtures.TWO_LISTINGS_BUDGET)

    expect([
      ...(await Git.datingsOf(
        {
          stamps: recorded.probe,
          deps: { sessionStartMs: Fixtures.GIT_SESSION_START_MS },
        },
        ['a/x', 'b/y', 'c/z', 'missing'],
      )),
    ]).toEqual([
      ['a/x', 'pre-session'],
      ['b/y', 'unlisted'],
      ['c/z', 'unlisted'],
      ['missing', 'session'],
    ])

    expect(recorded.listed).toEqual(['/repo', '/repo/a'])
    expect(recorded.statted).toEqual(['/repo/a/x'])
  })

  test('an unlisted tracked row stays session work', async () => {
    const context = contextOf(probeOf(Fixtures.ROOT_ONLY_BUDGET).probe, '')
    const rows = await Git.tagPreSession(context, [Fixtures.TRACKED_ROW])

    expect(context.stamps.base).toBe('/repo')
    expect(rows.map(row => row.isPreSession)).toEqual([false])
  })

  test('an unlisted untracked file reads as pre-session', async () => {
    const context = contextOf(
      probeOf(Fixtures.ROOT_ONLY_BUDGET).probe,
      'deep/y.txt\0',
    )

    const rows = await Git.untrackedFiles(context, {
      slots: 1,
      scope: 'with-pre-session',
    })

    expect(context.stamps.base).toBe('/repo')

    expect(rows?.map(row => [row.path, row.isPreSession])).toEqual([
      ['deep/y.txt', true],
    ])
  })
})
