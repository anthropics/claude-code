import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../../hooks/git'
import Fixtures from '../../fixtures'

tier('builtin')

describe('kind-walk-of', () => {
  const DEEP_PATH = Array.from({ length: Fixtures.WALK_DEPTH }, () => 'a').join(
    '/',
  )

  function walkOf(budget: number) {
    const listed: string[] = []

    const walk = Git.kindWalkOf(
      directory => {
        listed.push(directory)

        return Promise.resolve(new Map([['a', 'dir' as const]]))
      },
      '/repo',
      budget,
    )

    return { walk, listed }
  }

  test('a fifty-thousand-deep path reads over-budget in budget', async () => {
    const { walk, listed } = walkOf(Fixtures.WALK_BUDGET)

    expect(await walk.kindOf(DEEP_PATH)).toBe('over-budget')
    expect(listed.length).toBe(Fixtures.WALK_BUDGET)
  })

  test('a path within the budget reads its kind from its parent', async () => {
    const { walk, listed } = walkOf(Fixtures.WALK_BUDGET)

    expect(await walk.kindOf('a/a/a')).toBe('dir')
    expect(await walk.kindOf('a/a/b')).toBe(null)
    expect(listed).toEqual(['/repo', '/repo/a', '/repo/a/a'])
  })
})
