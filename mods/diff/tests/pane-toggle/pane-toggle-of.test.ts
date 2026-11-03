import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../../hooks/limits'
import PaneToggle from '../../hooks/pane-toggle'

tier('builtin')

describe('pane-toggle-of', () => {
  test('an open pane closes, however narrow', () => {
    expect(
      PaneToggle.paneToggleOf({
        isOpen: true,
        columns: Limits.OPEN_MIN_COLUMNS - 1,
      }),
    ).toBe('close')
  })

  test('below the panel width it is too narrow, from it it opens', () => {
    expect(
      PaneToggle.paneToggleOf({
        isOpen: false,
        columns: Limits.OPEN_MIN_COLUMNS - 1,
      }),
    ).toBe('too-narrow')

    expect(
      PaneToggle.paneToggleOf({
        isOpen: false,
        columns: Limits.OPEN_MIN_COLUMNS,
      }),
    ).toBe('open')

    expect(PaneToggle.paneToggleOf({ isOpen: false, columns: null })).toBe(
      'open',
    )
  })
})
