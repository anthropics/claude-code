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
      ].map(held => Hooks.holdsOver(held, Fixtures.ALLOWED)),
    ).toEqual([true, true, true, true, true, false, false])
  })

  test('over an ask only a deny is stricter; over a deny nothing is', () => {
    expect(
      [
        Fixtures.RULE_DENY,
        Fixtures.RULE_ASK,
        Fixtures.HOOK_DENY,
        Fixtures.HOOK_ASK,
      ].map(held => [
        Hooks.holdsOver(held, Fixtures.ASKED),
        Hooks.holdsOver(held, Fixtures.PLAIN_DENY),
      ]),
    ).toEqual([
      [true, false],
      [false, false],
      [true, false],
      [false, false],
    ])
  })

  test('a rule or hook the answer itself names makes nothing hold', () => {
    expect(
      Hooks.holdsOver(Fixtures.ASKED, {
        ...Fixtures.ALLOWED,
        rule: 'Bash(echo *)',
        hook: 'PreToolUse',
      }),
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
      ].map(held => Hooks.heldNotice('easy', 'Bash', held)),
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

  test('the refusal of a pinned variable names the setting and it', () => {
    expect(Hooks.pinnedVariableRefusal('CORP_PROXY')).toBe(
      'env (managed): CORP_PROXY is not for plugins outside policy to change',
    )
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
})
