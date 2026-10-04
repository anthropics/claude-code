import { describe, expect, test, tier } from 'claude-code/testing'

import Fixtures from '../../fixtures'

tier('builtin')

describe('repository-of', () => {
  test('three absolute lines are the repository', async () => {
    expect(await Fixtures.probedRepositoryOf(Fixtures.RESOLVED)).toEqual({
      toplevel: '/r',
      gitDir: '/r/.git/worktrees/w',
      commonDir: '/r/.git',
    })

    expect(await Fixtures.probedRepositoryOf(Fixtures.WINDOWS)).toEqual({
      toplevel: 'C:/r',
      gitDir: 'C:/r/.git',
      commonDir: 'C:/r/.git',
    })
  })

  test('a git that echoes the flag, or a relative path: nothing', async () => {
    expect(await Fixtures.probedRepositoryOf(Fixtures.ECHOED_FLAG)).toBeNull()
    expect(await Fixtures.probedRepositoryOf(Fixtures.RELATIVE)).toBeNull()
    expect(await Fixtures.probedRepositoryOf('')).toBeNull()
  })
})
