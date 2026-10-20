import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'
import Fixtures from './fixtures'

tier('prepend')

describe('held-verdict', () => {
  test('over an allow: any deny, and an ask a rule or a hook decided', () => {
    expect(
      [
        Fixtures.RULE_DENY,
        Fixtures.RULE_ASK,
        Fixtures.HOOK_DENY,
        Fixtures.HOOK_ASK,
        Fixtures.PLAIN_DENY,
        Fixtures.ASKED,
        Fixtures.ALLOWED,
      ].map(held => Hooks.holdsOver(held, Fixtures.ALLOWED, undefined)),
    ).toEqual([true, true, true, true, true, false, false])
  })

  test("a setting's ask and a host's hold over an allow and a rewording", () => {
    expect(
      [Fixtures.SETTING_ASK, Fixtures.HOST_ASK].map(held => [
        Hooks.holdsOver(held, Fixtures.ALLOWED, 'host'),
        Hooks.holdsOver(held, Fixtures.ASKED, 'host'),
        Hooks.holdsOver(held, { ...held }, 'host'),
      ]),
    ).toEqual([
      [true, true, false],
      [true, true, false],
    ])
  })

  test('a setting the answer itself names holds nothing', () => {
    expect(
      Hooks.holdsOver(
        Fixtures.ASKED,
        {
          ...Fixtures.ALLOWED,
          setting: 'permissions.blockReadsOutsideWorkingDirectories',
        },
        undefined,
      ),
    ).toBe(false)
  })

  test('an ask is named for its hook, then its setting, then its host', () => {
    expect(
      [
        { ...Fixtures.HOST_ASK, ...Fixtures.SETTING_ASK, ...Fixtures.HOOK_ASK },
        { ...Fixtures.HOST_ASK, ...Fixtures.SETTING_ASK },
        Fixtures.HOST_ASK,
      ].map(held => Hooks.heldNotice('easy', 'Bash', held, 'lift')),
    ).toEqual(
      [
        "a PreToolUse hook's ask from a Bash call; the PreToolUse hook's ask",
        "a permissions.blockReadsOutsideWorkingDirectories setting's ask " +
          'from a Bash call; the ' +
          "permissions.blockReadsOutsideWorkingDirectories setting's ask",
        "a host's ask from a Bash call; the host's ask",
      ].map(
        middle =>
          `easy tried to lift ${middle} holds over the plugins you install ` +
          '(allowModsToOverrideDenyRules)',
      ),
    )
  })

  test('over the same decision reworded; a stricter answer stands', () => {
    expect(
      [
        Fixtures.RULE_DENY,
        Fixtures.RULE_ASK,
        Fixtures.HOOK_DENY,
        Fixtures.HOOK_ASK,
      ].map(held => [
        Hooks.holdsOver(held, Fixtures.ASKED, undefined),
        Hooks.holdsOver(held, Fixtures.PLAIN_DENY, undefined),
        Hooks.holdsOver(held, { ...held }, undefined),
      ]),
    ).toEqual([
      [true, true, false],
      [true, false, false],
      [true, true, false],
      [true, false, false],
    ])
  })

  test('an ask stripped of its rule, same sentence, is no same verdict', () => {
    expect(
      Hooks.holdsOver(
        Fixtures.RULE_ASK,
        {
          decision: Fixtures.RULE_ASK.decision,
          reason: Fixtures.RULE_ASK.reason,
        },
        undefined,
      ),
    ).toBe(true)
  })

  test('a rule or hook the answer itself names makes nothing hold', () => {
    expect(
      Hooks.holdsOver(
        Fixtures.ASKED,
        {
          ...Fixtures.ALLOWED,
          rule: 'Bash(echo *)',
          hook: 'PreToolUse',
        },
        undefined,
      ),
    ).toBe(false)
  })

  test('the notice names the kind that held, and the rule when one did', () => {
    expect(
      [
        Fixtures.RULE_DENY,
        Fixtures.RULE_ASK,
        { ...Fixtures.RULE_ASK, ...Fixtures.HOOK_ASK },
        Fixtures.HOOK_ASK,
        Fixtures.HOOK_DENY,
        Fixtures.PLAIN_DENY,
      ].map(held => Hooks.heldNotice('easy', 'Bash', held, 'lift')),
    ).toEqual(
      [
        'a deny rule in your settings from a Bash call (Bash(echo *)); ' +
          'the deny rule',
        'an ask rule in your settings from a Bash call (Bash(echo *)); ' +
          'the ask rule',
        'an ask rule in your settings from a Bash call (Bash(echo *)); ' +
          'the ask rule',
        "a PreToolUse hook's ask from a Bash call; the PreToolUse hook's ask",
        'a refusal from a Bash call; the refusal',
        'a refusal from a Bash call; the refusal',
      ].map(
        middle =>
          `easy tried to lift ${middle} holds over the plugins you install ` +
          '(allowModsToOverrideDenyRules)',
      ),
    )
  })

  test('what no check vouches for is refused, and says why', () => {
    expect(Hooks.UNCHECKED_DENY).toEqual({
      decision: 'deny',
      reason:
        'the rules and hooks in your settings could not be checked for this ' +
        'call, so it is refused',
    })
  })

  test('an ask of theirs over a deny, caught, is no more vouched for', () => {
    expect(
      Hooks.caughtAnswer(Fixtures.ASKED, [
        Fixtures.linkOf('easy', 'user', Fixtures.ASKED),
        Fixtures.linkOf('engine', 'core', Fixtures.RULE_DENY),
      ]),
    ).toEqual(Hooks.UNCHECKED_DENY)
  })

  test('a link of theirs is named when it answered looser than handed', () => {
    expect(
      Hooks.rewrittenByUsers([
        Fixtures.linkOf('listening', 'user', Fixtures.ALLOWED),
        Fixtures.linkOf('easy', 'user', Fixtures.ALLOWED),
        Fixtures.linkOf('engine', 'core', Fixtures.ASKED),
      ]),
    ).toEqual(['easy'])
  })

  test('one that never called next is measured against a deny', () => {
    expect(
      Hooks.rewrittenByUsers([
        Fixtures.linkOf('listening', 'user', Fixtures.ALLOWED),
        Fixtures.linkOf('blind', 'user', Fixtures.ALLOWED),
      ]),
    ).toEqual(['blind'])
  })

  test('one that reworded the same decision is named too', () => {
    expect(
      Hooks.rewrittenByUsers([
        Fixtures.linkOf('reworder', 'user', Fixtures.ASKED),
        Fixtures.linkOf('engine', 'core', Fixtures.RULE_ASK),
      ]),
    ).toEqual(['reworder'])
  })

  test('a tightening, a skipped link and links beneath theirs are not', () => {
    expect(
      Hooks.rewrittenByUsers([
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
      Hooks.rewrittenByUsers([
        Fixtures.linkOf('audit+easy', 'prepend', Fixtures.ALLOWED),
        Fixtures.linkOf('engine', 'core', Fixtures.RULE_DENY),
      ]),
    ).toEqual(['audit+easy'])
  })

  test('the handler keeps a verdict none of theirs made, or tightened', () => {
    expect([
      Hooks.caughtAnswer(Fixtures.PLAIN_DENY, [
        Fixtures.linkOf('strict', 'user', Fixtures.PLAIN_DENY),
        Fixtures.linkOf('engine', 'core', Fixtures.ASKED),
      ]),
      Hooks.caughtAnswer(Fixtures.ASKED, [
        Fixtures.linkOf('easy', 'user'),
        Fixtures.linkOf('engine', 'core', Fixtures.ASKED),
      ]),
    ]).toEqual([Fixtures.PLAIN_DENY, Fixtures.ASKED])
  })

  test('a deny of the rules they reworded is refused in our words', () => {
    expect(
      Hooks.caughtAnswer(Fixtures.PLAIN_DENY, [
        Fixtures.linkOf('reworder', 'user', Fixtures.PLAIN_DENY),
        Fixtures.linkOf('engine', 'core', Fixtures.RULE_DENY),
      ]),
    ).toEqual(Hooks.UNCHECKED_DENY)
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
