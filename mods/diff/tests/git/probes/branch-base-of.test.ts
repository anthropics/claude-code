import type { ProcessRunResult } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../../hooks/git'
import Fixtures from '../../fixtures'

tier('builtin')

describe('branch-base-of', () => {
  type Script = Record<string, ProcessRunResult>

  const runOf = (script: Script) => Fixtures.scriptedGitOf(script).run

  const onFeature = (): Script => ({
    'rev-parse --abbrev-ref HEAD': Fixtures.ok('feature\n'),
    'symbolic-ref --short refs/remotes/origin/HEAD':
      Fixtures.ok('origin/main\n'),
    'show-ref --verify --quiet refs/remotes/origin/main': Fixtures.ok(),
  })

  test("origin's merge-base wins unless the local descends", async () => {
    expect(
      await Git.branchBaseOf(
        runOf({
          ...onFeature(),
          'merge-base HEAD origin/main': Fixtures.ok(
            `${Fixtures.ORIGIN_BASE}\n`,
          ),
          'merge-base HEAD main': Fixtures.ok(`${Fixtures.LOCAL_BASE}\n`),
          'rev-parse HEAD': Fixtures.ok(`${Fixtures.FEATURE_HEAD}\n`),
        }),
      ),
    ).toEqual({
      kind: 'merge-base',
      mergeBase: Fixtures.ORIGIN_BASE,
      baseBranch: 'main',
    })

    expect(
      await Git.branchBaseOf(
        runOf({
          ...onFeature(),
          'merge-base HEAD origin/main': Fixtures.ok(
            `${Fixtures.ORIGIN_BASE}\n`,
          ),
          'merge-base HEAD main': Fixtures.ok(`${Fixtures.LOCAL_BASE}\n`),
          [`merge-base --is-ancestor ${Fixtures.ORIGIN_BASE} ` +
          Fixtures.LOCAL_BASE]: Fixtures.ok(),
          'rev-parse HEAD': Fixtures.ok(`${Fixtures.FEATURE_HEAD}\n`),
        }),
      ),
    ).toEqual({
      kind: 'merge-base',
      mergeBase: Fixtures.LOCAL_BASE,
      baseBranch: 'main',
    })
  })

  test('the default branch, or HEAD at the base: head-is-base', async () => {
    expect(
      await Git.branchBaseOf(
        runOf({
          ...onFeature(),
          'rev-parse --abbrev-ref HEAD': Fixtures.ok('main\n'),
        }),
      ),
    ).toEqual({ kind: 'head-is-base', baseBranch: 'main' })

    expect(
      await Git.branchBaseOf(
        runOf({
          ...onFeature(),
          'merge-base HEAD origin/main': Fixtures.ok(
            `${Fixtures.FEATURE_HEAD}\n`,
          ),
          'rev-parse HEAD': Fixtures.ok(`${Fixtures.FEATURE_HEAD}\n`),
        }),
      ),
    ).toEqual({ kind: 'head-is-base', baseBranch: 'main' })
  })

  test('a detached HEAD, or no common ancestor, has no base', async () => {
    expect(
      await Git.branchBaseOf(
        runOf({
          ...onFeature(),
          'rev-parse --abbrev-ref HEAD': Fixtures.ok('HEAD\n'),
        }),
      ),
    ).toEqual({ kind: 'none' })

    expect(
      await Git.branchBaseOf(
        runOf({
          ...onFeature(),
          'merge-base HEAD origin/main': Fixtures.PROBE_MISSED,
          'merge-base HEAD main': Fixtures.PROBE_MISSED,
        }),
      ),
    ).toEqual({ kind: 'none' })
  })

  test('a failed merge-base while the ref exists: error', async () => {
    expect(await Git.branchBaseOf(runOf(onFeature()))).toEqual({
      kind: 'error',
      reason: 'merge_base_failed',
    })
  })

  test('no default ref anywhere: none', async () => {
    expect(
      await Git.branchBaseOf(
        runOf({
          'rev-parse --abbrev-ref HEAD': Fixtures.ok('feature\n'),
        }),
      ),
    ).toEqual({ kind: 'none' })
  })
})
