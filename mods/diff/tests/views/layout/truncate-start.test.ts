import { describe, expect, test, tier } from 'claude-code/testing'

import Views from '../../../hooks/views'
import Fixtures from '../../fixtures'

tier('builtin')

describe('truncate-start', () => {
  test('a path padded with combining marks is cut to the room', () => {
    const cut = Views.truncateStart(
      `src/${Fixtures.COMBINING_ACUTE.repeat(Fixtures.MARKS)}x.ts`,
      Fixtures.ROOM,
    )

    expect([...cut].length).toBeLessThanOrEqual(Fixtures.ROOM)
    expect(cut.startsWith('…')).toBe(true)
    expect(cut.endsWith('x.ts')).toBe(true)
  })

  test('a path that fits is whole; one that does not keeps its tail', () => {
    expect(Views.truncateStart('src/a.ts', Fixtures.ROOM)).toBe('src/a.ts')

    expect(
      Views.truncateStart(
        'very/long/leading/dirs/file.ts',
        Fixtures.NARROW_ROOM,
      ),
    ).toBe('…irs/file.ts')
  })
})
