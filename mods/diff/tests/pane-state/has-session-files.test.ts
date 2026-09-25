import { describe, expect, test, tier } from 'claude-code/testing'

import type Git from '../../hooks/git'
import PaneState from '../../hooks/pane-state'
import Fixtures from '../fixtures'

tier('builtin')

describe('has-session-files', () => {
  const dataOf = (
    files: readonly Git.FileStat[],
    overrides: Partial<Git.DiffData> = {},
  ): Git.FetchOutcome => ({
    kind: 'data',
    data: {
      repository: Fixtures.CHECKOUT,
      mode: 'session',
      stats: { ...Fixtures.NO_STATS, filesCount: files.length },
      files,
      source: { kind: 'working-tree', base: 'HEAD' },
      isUnborn: false,
      baseRef: 'HEAD',
      stalePaths: [],
      isUntrackedWithheld: false,
      ...overrides,
    },
  })

  test("a file the header counts, a test among them: there's one", () => {
    expect(PaneState.hasSessionFiles(dataOf([Fixtures.SESSION_ROW]))).toBe(true)
    expect(PaneState.hasSessionFiles(dataOf([Fixtures.TEST_ROW]))).toBe(true)

    expect(
      PaneState.hasSessionFiles(
        dataOf([Fixtures.PRE_SESSION_ROW, Fixtures.SESSION_ROW]),
      ),
    ).toBe(true)
  })

  test('files counted past the row cap, none stored, still count', () => {
    expect(
      PaneState.hasSessionFiles(
        dataOf([], {
          stats: { ...Fixtures.NO_STATS, filesCount: Fixtures.PAST_CAP_COUNT },
        }),
      ),
    ).toBe(true)
  })

  test('wherever the pane would headline an empty state: none', () => {
    const withheld = { isUntrackedWithheld: true }

    expect(PaneState.hasSessionFiles({ kind: 'no-repository' })).toBe(false)
    expect(PaneState.hasSessionFiles({ kind: 'unavailable' })).toBe(false)
    expect(PaneState.hasSessionFiles(dataOf([]))).toBe(false)
    expect(PaneState.hasSessionFiles(dataOf([], withheld))).toBe(false)
    expect(PaneState.hasSessionFiles(dataOf([], { isUnborn: true }))).toBe(
      false,
    )

    expect(PaneState.hasSessionFiles(dataOf([Fixtures.PRE_SESSION_ROW]))).toBe(
      false,
    )
  })
})
