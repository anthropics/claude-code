import { describe, expect, test, tier } from 'claude-code/testing'

import Views from '../../../hooks/views'
import Fixtures from '../../fixtures'

tier('builtin')

describe('wrapped-lines', () => {
  test('each line cut as Ink cuts it for the built-in', () => {
    for (const [text, byWidth] of Object.entries(Fixtures.BUILTIN_WRAPS)) {
      for (const [width, builtin] of Object.entries(byWidth)) {
        expect(
          Views.wrappedLines(text, Number(width)),
          `${width}: ${text}`,
        ).toEqual(builtin)
      }
    }

    expect(
      Views.wrappedLines(
        "Couldn't read the git diff — it will retry on the next change",
        48,
      ),
    ).toEqual([
      "Couldn't read the git diff — it will retry on ",
      'the next change',
    ])
  })
})
