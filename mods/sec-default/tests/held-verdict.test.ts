import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'
import Fixtures from './fixtures'

tier('prepend')

describe('held-verdict', () => {
  test('a deny that names its rule is a rule deny; any other is not', () => {
    expect(
      [Fixtures.RULE_DENY, Fixtures.PLAIN_DENY, Fixtures.ASKED].map(
        Hooks.isRuleDeny,
      ),
    ).toEqual([true, false, false])
  })

  test("only the person's links that answered allow or ask are named", () => {
    expect(
      Hooks.loosenedByUsers([
        Fixtures.linkOf('guard', 'prepend', Fixtures.ALLOWED),
        Fixtures.linkOf('easy', 'user', Fixtures.ALLOWED),
        Fixtures.linkOf('strict', 'user', Fixtures.PLAIN_DENY),
        Fixtures.linkOf('passed-over', 'user'),
        Fixtures.linkOf('asking', 'user', Fixtures.ASKED),
        Fixtures.linkOf('bundled', 'builtin', Fixtures.ALLOWED),
        Fixtures.linkOf('engine', 'core', Fixtures.RULE_DENY),
      ]),
    ).toEqual(['easy', 'asking'])
  })

  test('the handler keeps a deny, and a verdict none of theirs made', () => {
    const pastUsers = [
      Fixtures.linkOf('easy', 'user'),
      Fixtures.linkOf('engine', 'core', Fixtures.ASKED),
    ]

    expect([
      Hooks.caughtAnswer(Fixtures.RULE_DENY, [
        Fixtures.linkOf('easy', 'user', Fixtures.ALLOWED),
      ]),
      Hooks.caughtAnswer(Fixtures.ASKED, pastUsers),
    ]).toEqual([Fixtures.RULE_DENY, Fixtures.ASKED])
  })

  test('the handler refuses a verdict they loosened, and no verdict', () => {
    expect([
      Hooks.caughtAnswer(Fixtures.ALLOWED, [
        Fixtures.linkOf('easy', 'user', Fixtures.ALLOWED),
        Fixtures.linkOf('engine', 'core', Fixtures.ASKED),
      ]),
      Hooks.caughtAnswer(undefined, []),
    ]).toEqual([Hooks.UNCHECKED_DENY, Hooks.UNCHECKED_DENY])
  })
})
