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

  test('a link of theirs is named when it answered looser than handed', () => {
    expect(
      Hooks.loosenedByUsers([
        Fixtures.linkOf('listening', 'user', Fixtures.ALLOWED),
        Fixtures.linkOf('easy', 'user', Fixtures.ALLOWED),
        Fixtures.linkOf('engine', 'core', Fixtures.ASKED),
      ]),
    ).toEqual(['easy'])
  })

  test('one that never called next is measured against a deny', () => {
    expect(
      Hooks.loosenedByUsers([
        Fixtures.linkOf('listening', 'user', Fixtures.ALLOWED),
        Fixtures.linkOf('blind', 'user', Fixtures.ALLOWED),
      ]),
    ).toEqual(['blind'])
  })

  test('a tightening, a skipped link and links beneath theirs are not', () => {
    expect(
      Hooks.loosenedByUsers([
        Fixtures.linkOf('strict', 'user', Fixtures.PLAIN_DENY),
        Fixtures.linkOf('passed-over', 'user'),
        Fixtures.linkOf('suite', 'append', Fixtures.ALLOWED),
        Fixtures.linkOf('bundled', 'builtin', Fixtures.ALLOWED),
        Fixtures.linkOf('engine', 'core', Fixtures.RULE_DENY),
      ]),
    ).toEqual([])
  })

  test('a batch listed under prepend may hold a plugin of theirs', () => {
    expect(
      Hooks.loosenedByUsers([
        Fixtures.linkOf('audit+easy', 'prepend', Fixtures.ALLOWED),
        Fixtures.linkOf('engine', 'core', Fixtures.RULE_DENY),
      ]),
    ).toEqual(['audit+easy'])
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

  test('only a verdict looser than the ceiling is over it', () => {
    expect(
      [Fixtures.ALLOWED, Fixtures.ASKED, Fixtures.PLAIN_DENY].map(verdict =>
        Hooks.isOverCeiling(verdict, Fixtures.CAPPED.ceiling),
      ),
    ).toEqual([true, false, false])
  })

  test('where the organization set no ceiling nothing is over it', () => {
    expect(
      Hooks.isOverCeiling(Fixtures.ALLOWED, Fixtures.CHECKED.ceiling),
    ).toBe(false)
  })

  test('the ceiling holds an answer over it by a stricter run', () => {
    expect([
      Hooks.isCeilingHeld(Fixtures.ALLOWED, Fixtures.CAPPED_ASK, 'ask'),
      Hooks.isCeilingHeld(Fixtures.ALLOWED, Fixtures.RULE_DENY, 'ask'),
    ]).toEqual([true, true])
  })

  test('it holds no run as permissive, and no answer within it', () => {
    expect([
      Hooks.isCeilingHeld(Fixtures.ALLOWED, Fixtures.CAPPED_ALLOWED, 'ask'),
      Hooks.isCeilingHeld(Fixtures.ASKED, Fixtures.PLAIN_DENY, 'ask'),
      Hooks.isCeilingHeld(Fixtures.ASKED, Fixtures.ALLOWED, 'deny'),
      Hooks.isCeilingHeld(Fixtures.ALLOWED, Fixtures.ASKED, undefined),
    ]).toEqual([false, false, false, false])
  })

  test('a ceiling it does not know holds a call at a deny', () => {
    expect([
      Hooks.ceilingVerdict('ask'),
      Hooks.ceilingVerdict('blocked'),
      Hooks.isOverCeiling(Fixtures.ASKED, 'blocked'),
      Hooks.isOverCeiling(Fixtures.PLAIN_DENY, 'blocked'),
    ]).toEqual(['ask', 'deny', true, false])
  })

  test('a link of theirs is named when it answered over the ceiling', () => {
    expect(
      Hooks.liftedByUsers(
        [
          Fixtures.linkOf('easy', 'user', Fixtures.ALLOWED),
          Fixtures.linkOf('soft', 'user', Fixtures.ASKED),
          Fixtures.linkOf('suite', 'append', Fixtures.ALLOWED),
          Fixtures.linkOf('engine', 'core', Fixtures.PLAIN_DENY),
        ],
        'ask',
      ),
    ).toEqual(['easy'])
  })

  test('none is named over an allow handed up, or under no ceiling', () => {
    const run = [
      Fixtures.linkOf('listening', 'user', Fixtures.ALLOWED),
      Fixtures.linkOf('suite', 'append', Fixtures.ALLOWED),
    ]

    expect([
      Hooks.liftedByUsers(run, 'ask'),
      Hooks.liftedByUsers(run.slice(0, 1), undefined),
    ]).toEqual([[], []])
  })

  test('a plugin is told once, however many of its links are named', () => {
    expect(
      Hooks.untold(new Set(['told']), ['easy', 'told', 'soft', 'easy']),
    ).toEqual(['easy', 'soft'])
  })

  test('the handler keeps a verdict within the ceiling, or under none', () => {
    expect([
      Hooks.underCeiling(Fixtures.ASKED, 'ask'),
      Hooks.underCeiling(Hooks.UNCHECKED_DENY, 'ask'),
      Hooks.underCeiling(Fixtures.ALLOWED, undefined),
    ]).toEqual([Fixtures.ASKED, Hooks.UNCHECKED_DENY, Fixtures.ALLOWED])
  })

  test('the handler answers the ceiling for a verdict over it', () => {
    expect([
      Hooks.underCeiling(Fixtures.ALLOWED, 'ask'),
      Hooks.underCeiling(Fixtures.ASKED, 'blocked'),
    ]).toEqual([
      Hooks.uncheckedCeiling('ask'),
      { ...Hooks.uncheckedCeiling('ask'), decision: 'deny' },
    ])
  })

  test('the handler makes no verdict of none: a rejection stays one', () => {
    expect([
      Hooks.underCeiling(undefined, 'ask'),
      Hooks.underCeiling(undefined, undefined),
    ]).toEqual([undefined, undefined])
  })
})
