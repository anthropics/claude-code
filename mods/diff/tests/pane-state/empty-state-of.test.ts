import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../hooks/git'
import PaneState from '../../hooks/pane-state'
import Fixtures from '../fixtures'

tier('builtin')

describe('empty-state-of', () => {
  const dataIn = (
    mode: Git.BaseMode,
    overrides: Partial<Git.DiffData> = {},
  ): Git.DiffData => ({
    repository: Fixtures.CHECKOUT,
    mode,
    stats: Fixtures.NO_STATS,
    files: [],
    source: { kind: 'working-tree', base: 'HEAD' },
    isUnborn: false,
    baseRef: 'HEAD',
    stalePaths: [],
    isUntrackedWithheld: false,
    ...overrides,
  })

  test("the built-in's headlines, keyed on the fetched mode", () => {
    expect(PaneState.emptyStateOf(null, 0, Git.GIT_WORDS)?.headline).toBe(
      'Diff unavailable',
    )

    expect(PaneState.emptyStateOf(dataIn('session'), 0, Git.GIT_WORDS)).toEqual(
      {
        headline: 'No changes this session',
        hint: null,
      },
    )

    expect(
      PaneState.emptyStateOf(dataIn('uncommitted'), 0, Git.GIT_WORDS)?.headline,
    ).toBe('No uncommitted changes')

    expect(
      PaneState.emptyStateOf(
        dataIn('branch', { source: Fixtures.VS_MAIN }),
        0,
        Git.GIT_WORDS,
      )?.headline,
    ).toBe('No changes vs main')

    expect(PaneState.emptyStateOf(dataIn('branch'), 0, Git.GIT_WORDS)).toEqual({
      headline: 'No changes vs HEAD',
      hint: 'No base branch to compare against — showing changes vs HEAD',
    })

    expect(
      PaneState.emptyStateOf(
        dataIn('session', { isUnborn: true }),
        0,
        Git.GIT_WORDS,
      ),
    ).toEqual({
      headline: 'No commits yet',
      hint: "Nothing to diff against until the repo's first commit",
    })
  })

  test('with files to count there is no empty state', () => {
    expect(
      PaneState.emptyStateOf(dataIn('session'), 2, Git.GIT_WORDS),
    ).toBeNull()
  })

  test('no tracked rows, untracked withheld: claims no more', () => {
    const withheld = { isUntrackedWithheld: true }

    expect(
      PaneState.emptyStateOf(dataIn('session', withheld), 0, Git.GIT_WORDS)
        ?.headline,
    ).toBe('No tracked changes')

    expect(
      PaneState.emptyStateOf(
        dataIn('session', { ...withheld, isUnborn: true }),
        0,
        Git.GIT_WORDS,
      )?.headline,
    ).toBe('No tracked changes')

    expect(
      PaneState.emptyStateOf(dataIn('uncommitted', withheld), 1, Git.GIT_WORDS),
    ).toBeNull()
  })
})
