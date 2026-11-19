import type {
  VcsDiffFile,
  VcsDiffInput,
  VcsDiffResult,
  VcsWorkingCopy,
} from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

import Backend from '../../hooks/backend'
import type Git from '../../hooks/git'
import Limits from '../../hooks/limits'
import Fixtures from '../fixtures'

tier('builtin')

describe('vcs-backend-of', () => {
  const SESSION_START_MS = 100

  /** A host whose `diff` answers as told and whose /work holds `onDisk`. */
  function worldOf(
    answer: (e: VcsDiffInput) => VcsDiffResult,
    onDisk: Readonly<Record<string, number>> = {},
  ) {
    const asked: VcsDiffInput[] = []
    const touched: string[] = []
    const state = { nowMs: 0, revision: '7' as string | null, detects: 0 }

    const host: Backend.BackendHost = {
      ...Fixtures.backendHostOf(() => Promise.reject(new Error('spawned'))),
      diff: async e => {
        asked.push(e)

        return answer(e)
      },
      detect: async () => {
        state.detects += 1

        return { ...Fixtures.ACME_COPY, revision: state.revision }
      },
      entryKindsOf: async dir => {
        touched.push(dir)

        return new Map(Object.keys(onDisk).map(name => [name, 'file' as const]))
      },
      mtimeOf: async path => {
        touched.push(path)

        return onDisk[path.slice('/work/'.length)] ?? null
      },
      nowMs: async () => state.nowMs,
      sessionStartMsOf: () => SESSION_START_MS,
    }

    async function pin(copy: Partial<VcsWorkingCopy> = {}) {
      const backend = await Backend.vcsBackendOf(host, {
        ...Fixtures.ACME_COPY,
        ...copy,
      })

      if (!backend) {
        throw new Error('not pinned')
      }

      return backend
    }

    return { asked, touched, state, pin }
  }

  const listing = (files: VcsDiffFile[]) => () => ({ base: 'r7', files })

  async function dataOf(backend: Backend.Backend, mode: Git.BaseMode) {
    const outcome = await backend.fetchDiff(mode)

    if (outcome.kind !== 'data') {
      throw new Error(outcome.kind)
    }

    return outcome.data
  }

  const manyOf = (count: number, overrides: Partial<VcsDiffFile> = {}) =>
    Array.from({ length: count }, (_, at) =>
      Fixtures.acmeFileOf(`f${at}`, overrides),
    )

  test('rows come from a stat-only ask at the root, labelled by its base', async () => {
    const world = worldOf(
      listing([
        Fixtures.acmeFileOf('a', { added: 3, patch: 'unasked' }),
        Fixtures.acmeFileOf('new', { isUntracked: true, added: 9 }),
      ]),
    )

    const backend = await world.pin({ defaultBranch: null })
    const data = await dataOf(backend, 'uncommitted')

    expect(world.asked, 'one to pin, one to read').toEqual(
      Array(2).fill({
        path: '/work',
        vcs: 'acme',
        base: 'head',
        isStatOnly: true,
      }),
    )

    expect(data.source).toEqual({ kind: 'working-tree', base: 'r7' })

    expect(data.files).toEqual([
      { ...Fixtures.acmeFileOf('a', { added: 3 }), isPreSession: false },
      {
        ...Fixtures.acmeFileOf('new', { isUntracked: true }),
        added: 0,
        removed: 0,
        isPreSession: false,
      },
    ])

    expect(data.stats).toEqual({
      filesCount: 2,
      linesAdded: 3,
      linesRemoved: 1,
    })
  })

  test('branch mode is offered where default is named and known', async () => {
    const known = worldOf(listing([]))

    const unknown = worldOf(e =>
      e.base === 'default' ? { unknown: 'offline' } : { base: 'r7', files: [] },
    )

    const cut = worldOf(() => {
      throw new Error('aborted')
    })

    const offered = await known.pin()

    expect([
      offered.baseModes,
      (await cut.pin()).baseModes,
      (await unknown.pin()).baseModes,
      (await known.pin({ defaultBranch: null })).baseModes,
    ]).toEqual([
      ['session', 'uncommitted', 'branch'],
      ['session', 'uncommitted', 'branch'],
      ['session', 'uncommitted'],
      ['session', 'uncommitted'],
    ])

    expect(known.asked.filter(one => one.base === 'default')).toEqual([
      {
        path: '/work',
        vcs: 'acme',
        base: 'default',
        paths: [],
        isStatOnly: true,
      },
    ])

    expect((await dataOf(offered, 'branch')).source).toEqual({
      kind: 'branch',
      baseBranch: 'r7',
      baseRef: 'r7',
    })
  })

  test('unknown, and a refused call, are unavailable with the reason', async () => {
    const unknown = await worldOf(() => ({ unknown: 'offline' })).pin()

    const refused = await worldOf(() => {
      throw new Error('refused')
    }).pin()

    let isServed = true

    const left = await worldOf(() =>
      isServed ? { base: 'r7', files: [] } : { unknown: null },
    ).pin()

    isServed = false

    expect([
      await unknown.fetchDiff('session'),
      await refused.fetchDiff('session'),
      await left.fetchDiff('session'),
    ]).toEqual([
      { kind: 'unavailable', reason: 'offline' },
      { kind: 'unavailable', reason: 'refused' },
      { kind: 'unavailable', reason: 'no mod answered' },
    ])
  })

  test('session mode dates what was changed when pinned', async () => {
    const files = [
      Fixtures.acmeFileOf('old'),
      Fixtures.acmeFileOf('edited'),
      Fixtures.acmeFileOf('old-new', { isUntracked: true }),
    ]

    const world = worldOf(() => ({ base: 'r7', files }), {
      old: 1,
      edited: SESSION_START_MS + 1,
      'old-new': 1,
      'moved-in': 1,
    })

    const backend = await world.pin()

    files.push(Fixtures.acmeFileOf('moved-in'))

    const { files: rows } = await dataOf(backend, 'session')

    expect(rows.map(row => [row.path, row.isPreSession])).toEqual([
      ['old', true],
      ['edited', false],
      ['moved-in', false],
      ['old-new', true],
    ])
  })

  test('no name an answer holds is looked up outside the root', async () => {
    const names = ['../out', '/etc/passwd', 'a/../../out', '..', '.', '//h/s']

    const world = worldOf(
      listing([
        ...names.map(name => Fixtures.acmeFileOf(name, { renamedFrom: name })),
        ...names.map(name =>
          Fixtures.acmeFileOf(`${name}/new`, { isUntracked: true }),
        ),
      ]),
      { a: 1 },
    )

    const backend = await world.pin()
    const data = await dataOf(backend, 'session')

    await backend.fetchHunks(data, data.files)

    expect(data.files).toHaveLength(names.length * 2)
    expect(world.touched).toEqual(['/work'])
  })

  test("git's caps on files hold", async () => {
    const rowsOf = async (files: VcsDiffFile[]) => {
      const world = worldOf(listing(files))
      const data = await dataOf(await world.pin(), 'session')

      return [data.files.length, data.stats.filesCount, world.touched.length]
    }

    const past = Limits.MAX_FILES_FOR_DETAILS + 1

    expect([
      await rowsOf(manyOf(Limits.MAX_FILES + 1)),
      await rowsOf(manyOf(past)),
      await rowsOf(manyOf(past, { isUntracked: true })),
    ]).toEqual([
      [Limits.MAX_FILES, Limits.MAX_FILES + 1, 1],
      [0, past, 0],
      [Limits.MAX_FILES, Limits.MAX_FILES, 1],
    ])
  })

  test("bodies are asked by path, under git's caps on lines and bytes", async () => {
    const lines = Limits.MAX_LINES_PER_FILE + 1

    const files = [
      Fixtures.acmeFileOf('to', {
        renamedFrom: 'from',
        patch: '@@ -1 +1 @@\n-a\n+b\n',
      }),
      Fixtures.acmeFileOf('long', {
        patch: `@@ -0,0 +1,${lines} @@\n${'+x\n'.repeat(lines)}`,
      }),
      Fixtures.acmeFileOf('large', {
        patch: `@@ -0,0 +1 @@\n+${'x'.repeat(Limits.MAX_DIFF_BYTES)}\n`,
      }),
      Fixtures.acmeFileOf('bare'),
      Fixtures.acmeFileOf('binary', { isBinary: true, patch: '@@ -1 +1 @@' }),
      Fixtures.acmeFileOf('new', { isUntracked: true }),
    ]

    const world = worldOf(listing(files))
    const backend = await world.pin()
    const data = await dataOf(backend, 'branch')
    const bodies = await backend.fetchHunks(data, data.files)

    expect(world.asked.at(-1)).toEqual({
      path: '/work',
      vcs: 'acme',
      base: 'default',
      paths: ['from', 'to', 'long', 'large', 'bare'],
    })

    expect(
      [...bodies].map(([path, body]) => [
        path,
        body?.hunks.flatMap(hunk => hunk.lines).length,
        body?.isTruncated,
        body?.isLarge,
      ]),
    ).toEqual([
      ['to', 2, false, false],
      ['long', Limits.MAX_LINES_PER_FILE, true, false],
      ['large', 0, false, true],
      ['bare', 0, false, false],
      ['binary', 0, false, false],
      ['new', 0, false, false],
    ])
  })

  test('a body asked in vain is unread, and none is asked for no path', async () => {
    const files = [
      Fixtures.acmeFileOf('a'),
      Fixtures.acmeFileOf('new', { isUntracked: true }),
    ]

    const world = worldOf(e =>
      e.isStatOnly ? { base: 'r7', files } : { unknown: 'offline' },
    )

    const backend = await world.pin()
    const data = await dataOf(backend, 'uncommitted')
    const bodies = await backend.fetchHunks(data, data.files)
    const asks = world.asked.length

    await backend.fetchHunks(data, data.files.slice(1))

    expect(bodies.get('a')).toBeNull()
    expect(bodies.get('new')?.hunks).toEqual([])
    expect(world.asked).toHaveLength(asks)
  })

  test('what nobody can see leaves names and labels, never a patch', async () => {
    const unseen = [
      '\u001b',
      '\r',
      '‮',
      ' ',
      ' ',
      '͏',
      'ㅤ',
      '\ud800',
      '\u{e0041}',
      '\u{e0100}',
    ]

    const all = unseen.join('')
    const patch = `@@ -1 +1 @@\n-a${all}\n+<b>\té\n`
    const files = [Fixtures.acmeFileOf(`a${all}`, { patch })]
    const world = worldOf(() => ({ base: `r${all}7`, files }))
    const backend = await world.pin()
    const data = await dataOf(backend, 'uncommitted')
    const bodies = await backend.fetchHunks(data, data.files)
    const unknown = await worldOf(() => ({ unknown: `off${all}line` })).pin()
    const { drawnOf, toldOf } = backend.words

    expect(data.source).toEqual({ kind: 'working-tree', base: 'r7' })
    expect(world.asked.at(-1)?.paths, 'asked as named').toEqual([`a${all}`])
    expect(drawnOf?.(`a${all}`)).toBe('a')

    expect(bodies.get(`a${all}`)?.hunks[0]?.lines).toEqual([
      `-a${all}`,
      '+<b>\té',
    ])

    expect(await unknown.fetchDiff('session')).toEqual({
      kind: 'unavailable',
      reason: 'offline',
    })

    const untold = [...unseen, '\t', '\n', '<', '>']

    expect(untold.map(one => toldOf?.(`a${one}b`))).toEqual(
      untold.map(() => 'a file'),
    )

    expect(toldOf?.('src/été 日本.ts')).toBe('src/été 日本.ts')
  })

  test('the revision is asked again once it has stood, or once expired', async () => {
    const world = worldOf(listing([]))
    const backend = await world.pin({ revision: null })

    const keyAt = async (nowMs: number, revision: string | null) => {
      Object.assign(world.state, { nowMs, revision })

      return [await backend.headKeyOf(), world.state.detects]
    }

    const before = [
      await keyAt(Limits.REVISION_POLL_MS - 1, '8'),
      await keyAt(Limits.REVISION_POLL_MS, '8'),
      await keyAt(Limits.REVISION_POLL_MS + 1, '9'),
    ]

    backend.expireHeadKey?.()

    expect([
      ...before,
      await keyAt(Limits.REVISION_POLL_MS + 2, '9'),
      await keyAt(Limits.REVISION_POLL_MS + 3, '10'),
    ]).toEqual([
      ['null', 0],
      ['8', 1],
      ['8', 1],
      ['9', 2],
      ['9', 2],
    ])
  })
})
