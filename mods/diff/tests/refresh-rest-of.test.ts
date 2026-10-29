import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import { refreshRestOf } from '../hooks/refresh-rest-of'

tier('builtin')

describe('refresh-rest-of', () => {
  test('a read within the debounce adds no wait', () => {
    expect(refreshRestOf(Limits.REFRESH_DEBOUNCE_MS, 0)).toBe(0)
  })

  test('a slow read waits as long as it took, up to 30 s', () => {
    expect(refreshRestOf(3000, 0)).toBe(3000)
    expect(refreshRestOf(45_000, 0)).toBe(Limits.SLOW_REFRESH_REST_MAX_MS)
  })

  test('timed-out reads wait 10 s, doubling up to 60 s', () => {
    expect(
      [1, 2, 3, 4, 5].map(timedOut => refreshRestOf(5000, timedOut)),
    ).toEqual([10_000, 20_000, 40_000, 60_000, 60_000])
  })
})
