import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../../hooks/limits'
import PaneToggle from '../../hooks/pane-toggle'

tier('builtin')

describe('pane-toggle-of', () => {
  test('a pane believed open that still draws closes, however narrow', () => {
    expect(
      PaneToggle.paneToggleOf({
        isBelievedOpen: true,
        wasDrawnWhenProbed: true,
        columns: Limits.OPEN_MIN_COLUMNS - 1,
      }),
    ).toBe('close')
  })

  test('below the panel width it is too narrow, from it it opens', () => {
    expect(
      PaneToggle.paneToggleOf({
        isBelievedOpen: false,
        wasDrawnWhenProbed: false,
        columns: Limits.OPEN_MIN_COLUMNS - 1,
      }),
    ).toBe('too-narrow')

    expect(
      PaneToggle.paneToggleOf({
        isBelievedOpen: false,
        wasDrawnWhenProbed: false,
        columns: Limits.OPEN_MIN_COLUMNS,
      }),
    ).toBe('open')

    expect(
      PaneToggle.paneToggleOf({
        isBelievedOpen: false,
        wasDrawnWhenProbed: false,
        columns: null,
      }),
    ).toBe('open')
  })

  test('a pane the person closed reopens only where it fits', () => {
    expect(
      PaneToggle.paneToggleOf({
        isBelievedOpen: true,
        wasDrawnWhenProbed: false,
        columns: Limits.OPEN_MIN_COLUMNS - 1,
      }),
    ).toBe('too-narrow')
  })
})
