import { describe, expect, test, tier } from 'claude-code/testing'

import type Git from '../../hooks/git'
import PaneState from '../../hooks/pane-state'
import Fixtures from '../fixtures'

tier('builtin')

describe('header-totals-of', () => {
  const dataOf = (
    files: readonly Git.FileStat[],
    filesCount: number,
  ): Git.DiffData => ({
    repository: Fixtures.CHECKOUT,
    mode: 'session',
    stats: {
      filesCount,
      linesAdded: files.reduce((sum, each) => sum + each.added, 0),
      linesRemoved: files.reduce((sum, each) => sum + each.removed, 0),
    },
    files,
    source: { kind: 'working-tree', base: 'HEAD' },
    isUnborn: false,
    baseRef: 'HEAD',
    stalePaths: [],
    isUntrackedWithheld: false,
  })

  test('pre-session rows leave the header; the rest is not shown', () => {
    const data = dataOf(
      [Fixtures.SESSION_ROW, Fixtures.PRE_SESSION_ROW],
      Fixtures.REPORTED_COUNT,
    )

    expect(
      PaneState.headerTotalsOf(
        data,
        PaneState.partitionOf(data.files, 'hidden'),
      ),
    ).toEqual({ filesCount: 3, linesAdded: 3, linesRemoved: 1, notShown: 2 })
  })

  test('every stored row pre-session: files past the cap still count', () => {
    const stored = Array.from({ length: Fixtures.STORED_COUNT }, (_, at) => ({
      ...Fixtures.PRE_SESSION_ROW,
      path: `old${at}.ts`,
    }))

    const pastCap = Fixtures.PAST_CAP_COUNT - Fixtures.STORED_COUNT

    expect(
      PaneState.headerTotalsOf(
        dataOf(stored, Fixtures.PAST_CAP_COUNT),
        PaneState.partitionOf(stored, 'hidden'),
      ),
    ).toEqual({
      filesCount: pastCap,
      linesAdded: 0,
      linesRemoved: 0,
      notShown: pastCap,
    })
  })

  test('tests count as noise and leave the shown rows', () => {
    const partition = PaneState.partitionOf(
      [Fixtures.SESSION_ROW, Fixtures.TEST_ROW],
      'hidden',
    )

    expect(partition.shown.map(each => each.path)).toEqual(['src/a.ts'])
    expect(partition.noiseCount).toBe(1)
    expect(PaneState.partitionOf(partition.shown, 'shown').noiseCount).toBe(0)
  })
})
