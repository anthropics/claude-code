import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../../hooks/git'
import Fixtures from '../../fixtures'

tier('builtin')

describe('head-key-of', () => {
  type Recorded = {
    deps: Git.HeadKeyDeps
    statted: readonly string[]
    read: readonly string[]
    ran: readonly (readonly string[])[]
  }

  function recorded(
    listings: Readonly<Record<string, ReadonlyMap<string, Git.EntryKind>>>,
    head: string,
    stampOf: (path: string) => number = () => Fixtures.STAMP,
  ): Recorded {
    const statted: string[] = []
    const read: string[] = []

    const git = Fixtures.scriptedGitOf({
      'rev-parse': Fixtures.ok(`${Fixtures.HEAD_SHA}\n`),
    })

    const depsOf = (): Git.HeadKeyDeps => ({
      run: git.run,
      entryKindsOf: dir => Promise.resolve(listings[dir] ?? null),
      mtimeOf: path => {
        statted.push(path)

        return Promise.resolve(stampOf(path))
      },
      readFile: path => {
        read.push(path)

        return Promise.resolve(head)
      },
    })

    return { deps: depsOf(), statted, read, ran: git.argvs }
  }

  const plainGitDir: ReadonlyMap<string, Git.EntryKind> = new Map([
    ['HEAD', 'file'],
    ['packed-refs', 'file'],
    ['refs', 'dir'],
  ])

  const refs: ReadonlyMap<string, Git.EntryKind> = new Map([['heads', 'dir']])
  const heads: ReadonlyMap<string, Git.EntryKind> = new Map([['main', 'file']])

  const healthy = {
    '/r/.git': plainGitDir,
    '/r/.git/refs': refs,
    '/r/.git/refs/heads': heads,
  }

  const logged = {
    '/r/.git': new Map<string, Git.EntryKind>([
      ...plainGitDir,
      ['logs', 'dir'],
    ]),
    '/r/.git/logs': new Map<string, Git.EntryKind>([['HEAD', 'file']]),
  }

  async function idleOn(branch: string) {
    const probe = recorded(logged, `ref: refs/heads/${branch}\n`)

    return {
      keys: new Set([
        await Git.headKeyOf(probe.deps, Fixtures.CHECKOUT),
        await Git.headKeyOf(probe.deps, Fixtures.CHECKOUT),
        await Git.headKeyOf(probe.deps, Fixtures.CHECKOUT),
      ]).size,
      ran: probe.ran,
    }
  }

  test('a plain checkout reads HEAD, its ref file, packed-refs', async () => {
    const probe = recorded(healthy, 'ref: refs/heads/main\n')
    const key = await Git.headKeyOf(probe.deps, Fixtures.CHECKOUT)

    expect(probe.statted).toEqual([
      '/r/.git/HEAD',
      '/r/.git/refs/heads/main',
      '/r/.git/packed-refs',
    ])

    expect(key).toContain('refs/heads/main')
    expect(probe.ran).toEqual([])
  })

  test('a climbing ref: is never stat-ed; git answers instead', async () => {
    const probe = recorded(healthy, 'ref: ../../x\n')
    const key = await Git.headKeyOf(probe.deps, Fixtures.CHECKOUT)

    expect(probe.statted).toEqual([])
    expect(key).toBe(`rev:${Fixtures.HEAD_SHA}`)
  })

  test('a branch named with a # starts no git while idle', async () => {
    expect(await idleOn('fix/#12')).toEqual({ ran: [], keys: 1 })
  })

  test('a branch named outside ASCII starts no git while idle', async () => {
    expect(await idleOn('höher')).toEqual({ ran: [], keys: 1 })
  })

  test('on such a branch a moved HEAD is seen at the next look', async () => {
    let moves = 0

    const probe = recorded(logged, 'ref: refs/heads/fix/#12\n', path =>
      path.endsWith('/logs/HEAD') ? Fixtures.STAMP + moves : Fixtures.STAMP,
    )

    const before = await Git.headKeyOf(probe.deps, Fixtures.CHECKOUT)

    moves += 1

    expect(await Git.headKeyOf(probe.deps, Fixtures.CHECKOUT)).not.toBe(before)
    expect(probe.ran, 'dated by the log of HEAD, no git started').toEqual([])
  })

  test('with no log of HEAD such a branch is read through git', async () => {
    const probe = recorded(healthy, 'ref: refs/heads/fix/#12\n')
    const key = await Git.headKeyOf(probe.deps, Fixtures.CHECKOUT)

    expect(probe.statted).toEqual([])
    expect(key).toBe(`rev:${Fixtures.HEAD_SHA}`)
  })

  test('a HEAD that is a symbolic link is never read or stat-ed', async () => {
    const probe = recorded(
      {
        ...healthy,
        '/r/.git': new Map<string, Git.EntryKind>([
          ['HEAD', 'other'],
          ['packed-refs', 'file'],
          ['refs', 'dir'],
        ]),
      },
      'ref: refs/heads/main\n',
    )

    const key = await Git.headKeyOf(probe.deps, Fixtures.CHECKOUT)

    expect(probe.read).toEqual([])
    expect(probe.statted).toEqual([])
    expect(key).toBe(`rev:${Fixtures.HEAD_SHA}`)
  })

  test('a symlinked refs directory hides the ref file', async () => {
    const probe = recorded(
      {
        ...healthy,
        '/r/.git': new Map<string, Git.EntryKind>([
          ['HEAD', 'file'],
          ['refs', 'other'],
        ]),
      },
      'ref: refs/heads/main\n',
    )

    await Git.headKeyOf(probe.deps, Fixtures.CHECKOUT)

    expect(probe.statted).toEqual(['/r/.git/HEAD'])
  })
})
