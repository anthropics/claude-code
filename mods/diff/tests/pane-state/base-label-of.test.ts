import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../hooks/git'
import PaneState from '../../hooks/pane-state'
import Fixtures from '../fixtures'

tier('builtin')

describe('base-label-of', () => {
  const dataIn = (
    mode: Git.BaseMode,
    source: Git.DiffSource,
  ): Git.DiffData => ({
    repository: Fixtures.CHECKOUT,
    mode,
    stats: Fixtures.ONE_FILE,
    files: [],
    source,
    isUnborn: false,
    baseRef: 'HEAD',
    stalePaths: [],
    isUntrackedWithheld: false,
  })

  const labelOf = (
    mode: Git.BaseMode,
    data: Git.DiffData | null,
    filesCount: number,
  ) =>
    PaneState.baseLabelOf(
      { requestedMode: mode, data, words: Git.GIT_WORDS },
      filesCount,
    )

  test('settled session mode and no data show no line', () => {
    expect(
      labelOf('session', dataIn('session', Fixtures.WORKING_TREE), 1),
    ).toBeNull()

    expect(labelOf('branch', null, 0)).toBeNull()
  })

  test('settled pinned modes name their base', () => {
    expect(
      labelOf('uncommitted', dataIn('uncommitted', Fixtures.WORKING_TREE), 1),
    ).toBe('uncommitted (vs HEAD)')

    expect(labelOf('branch', dataIn('branch', Fixtures.VS_MAIN), 1)).toBe(
      'branch vs main',
    )

    expect(labelOf('branch', dataIn('branch', Fixtures.WORKING_TREE), 1)).toBe(
      'vs HEAD (no base branch)',
    )
  })

  test('a working tree that names its own base shows that name', () => {
    expect(
      labelOf('uncommitted', dataIn('uncommitted', Fixtures.AT_SHA), 1),
    ).toBe('uncommitted (vs 8634408015c1)')
  })

  test('a pending mode shows with an ellipsis, session too', () => {
    expect(labelOf('branch', dataIn('session', Fixtures.WORKING_TREE), 1)).toBe(
      'branch diff…',
    )

    expect(labelOf('session', dataIn('branch', Fixtures.VS_MAIN), 1)).toBe(
      'this session…',
    )
  })
})
