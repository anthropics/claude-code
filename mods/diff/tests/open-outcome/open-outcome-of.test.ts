import { describe, expect, test, tier } from 'claude-code/testing'

import OpenOutcome from '../../hooks/open-outcome'
import Fixtures from '../fixtures'

tier('builtin')

describe('open-outcome-of', () => {
  test('a placed pane, and an engine that resolves nothing, are placed', () => {
    expect(OpenOutcome.openOutcomeOf({ isPlaced: true })).toBe('placed')
    expect(OpenOutcome.openOutcomeOf(undefined)).toBe('placed')
  })

  test('left waiting it is withdrawn, with a reason or none', () => {
    expect(OpenOutcome.openOutcomeOf(Fixtures.LEFT_WAITING.value)).toBe(
      'withdrawn',
    )

    expect(OpenOutcome.openOutcomeOf({ isPlaced: false })).toBe('withdrawn')
  })

  test('with nothing attached to draw it yet it is awaited', () => {
    expect(OpenOutcome.openOutcomeOf(Fixtures.LEFT_UNSEEN.value)).toBe(
      'awaited',
    )
  })
})
