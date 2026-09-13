import { describe, expect, test, tier } from 'claude-code/testing'

import Ask from '../../hooks/ask'
import Fixtures from '../fixtures'

tier('builtin')

describe('fitted-ask-text-of', () => {
  test('an ask that fits rides whole', () => {
    expect(
      Ask.fittedAskTextOf(Fixtures.ASK_TEXT, Fixtures.ASK_TEXT.length),
    ).toBe(Fixtures.ASK_TEXT)
  })

  test('an ask past the room keeps its first lines and the cut note', () => {
    const fitted = Ask.fittedAskTextOf(
      Fixtures.ASK_TEXT,
      Fixtures.ROOM_FOR_TWO_LINES,
    )

    expect(fitted).toBe(
      `${Fixtures.ASK_LINES.slice(0, 2).join('\n')}\n${Ask.ASK_CUT_NOTE}`,
    )

    expect(fitted?.length).toBeLessThanOrEqual(Fixtures.ROOM_FOR_TWO_LINES)
  })

  test('an ask whose first hunk line does not fit is not attached', () => {
    expect(
      Ask.fittedAskTextOf(Fixtures.ASK_TEXT, Fixtures.ROOM_FOR_ONE_LINE),
    ).toBeUndefined()
  })
})
