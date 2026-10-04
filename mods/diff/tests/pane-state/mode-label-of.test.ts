import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../hooks/git'
import PaneState from '../../hooks/pane-state'
import Fixtures from '../fixtures'

tier('builtin')

describe('mode-label-of', () => {
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
    requestedMode: Git.BaseMode,
    data: Git.DiffData | null,
  ) =>
    PaneState.modeLabelOf(mode, { requestedMode, data, words: Git.GIT_WORDS })

  test('each settled mode is named as the built-in names it', () => {
    const session = dataIn('session', Fixtures.WORKING_TREE)

    expect(labelOf('session', 'session', session)).toBe('this session')

    expect(labelOf('uncommitted', 'session', session)).toBe(
      'uncommitted (vs HEAD)',
    )

    expect(labelOf('branch', 'session', session)).toBe('branch diff')
  })

  test('settled branch mode names its base, or what stands in', () => {
    expect(
      labelOf('branch', 'branch', dataIn('branch', Fixtures.VS_MAIN)),
    ).toBe('branch vs main')

    expect(
      labelOf('branch', 'branch', dataIn('branch', Fixtures.WORKING_TREE)),
    ).toBe('vs HEAD (no base branch)')
  })

  test('a working tree that names its own base shows that name', () => {
    expect(
      labelOf(
        'uncommitted',
        'uncommitted',
        dataIn('uncommitted', Fixtures.AT_SHA),
      ),
    ).toBe('uncommitted (vs 8634408015c1)')
  })

  test('the requested mode pends with an ellipsis until its data lands', () => {
    const session = dataIn('session', Fixtures.WORKING_TREE)

    expect(labelOf('branch', 'branch', session)).toBe('branch diff…')
    expect(labelOf('session', 'branch', session)).toBe('this session')

    expect(
      labelOf('session', 'session', dataIn('branch', Fixtures.VS_MAIN)),
    ).toBe('this session…')

    expect(labelOf('branch', 'branch', null)).toBe('branch diff')
  })

  test('an unborn HEAD with rows says what the rows are', () => {
    const unborn = {
      ...dataIn('session', Fixtures.WORKING_TREE),
      isUnborn: true,
    }

    expect(PaneState.unbornNoteOf({ data: unborn }, 2)).toBe(
      'no commits yet — showing staged and new files',
    )

    expect(PaneState.unbornNoteOf({ data: unborn }, 0)).toBeNull()

    expect(
      PaneState.unbornNoteOf({ data: dataIn('session', Fixtures.VS_MAIN) }, 2),
    ).toBeNull()
  })
})
