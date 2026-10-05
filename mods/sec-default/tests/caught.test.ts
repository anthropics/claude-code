import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'
import Fixtures from './fixtures'

tier('prepend')

describe('caught', () => {
  test('the check handler refuses a verdict of theirs unchecked', async () => {
    const handler = Fixtures.handlersRegistered()('tool.check')

    const loosened = Fixtures.unchecked([
      Fixtures.linkOf('easy', 'user', Fixtures.ALLOWED),
      Fixtures.linkOf('engine', 'core', Fixtures.ASKED),
    ])

    expect([
      await handler(Fixtures.UNREADABLE, Fixtures.CHECKED, loosened),
      await handler(Fixtures.THROWING, Fixtures.CHECKED, loosened),
      await handler(
        Fixtures.answering(Fixtures.MANAGED_POLICY),
        Fixtures.CHECKED,
        loosened,
      ),
    ]).toEqual([
      Hooks.UNCHECKED_DENY,
      Hooks.UNCHECKED_DENY,
      Hooks.UNCHECKED_DENY,
    ])
  })

  test('under a ceiling, where plugins may override, it asks', async () => {
    const handler = Fixtures.handlersRegistered()('tool.check')

    const loosened = Fixtures.unchecked([
      Fixtures.linkOf('easy', 'user', Fixtures.ALLOWED),
      Fixtures.linkOf('engine', 'core', Fixtures.CAPPED_ASK),
    ])

    expect([
      await handler(
        Fixtures.answering(Fixtures.overridePolicyOf(true)),
        Fixtures.CAPPED,
        loosened,
      ),
      await handler(Fixtures.UNREADABLE, Fixtures.CAPPED, loosened),
    ]).toEqual([Hooks.uncheckedCeiling('ask'), Hooks.UNCHECKED_DENY])
  })

  test('a verdict none of theirs loosened stands with it', async () => {
    expect(
      await Fixtures.handlersRegistered()('tool.check')(
        Fixtures.UNREADABLE,
        Fixtures.CHECKED,
        Fixtures.unchecked([
          Fixtures.linkOf('listening', 'user', Fixtures.ASKED),
          Fixtures.linkOf('engine', 'core', Fixtures.ASKED),
        ]),
      ),
    ).toEqual(Fixtures.ASKED)
  })

  test('the register handler refuses a plugin of theirs', async () => {
    const handler = Fixtures.handlersRegistered()('tool.register')
    const next = Fixtures.uncalled('beneath', 'past')

    expect([
      await handler(Fixtures.UNREADABLE, Fixtures.JUDGED, next),
      await handler(Fixtures.THROWING, Fixtures.JUDGED, next),
      await handler(
        Fixtures.answering(Fixtures.ALLOWLIST),
        Fixtures.JUDGED,
        next,
      ),
    ]).toEqual([
      { deny: Hooks.TOOL_REGISTER_REFUSAL },
      { deny: Hooks.TOOL_REGISTER_REFUSAL },
      { deny: Hooks.TOOL_REGISTER_REFUSAL },
    ])
  })

  test('it reads policy itself, each time it is asked', async () => {
    const handler = Fixtures.handlersRegistered()('tool.register')
    const next = Fixtures.uncalled('beneath', 'past')

    expect([
      await handler(
        Fixtures.answering(Fixtures.ALLOWLIST),
        Fixtures.JUDGED,
        next,
      ),
      await handler(
        Fixtures.answering(Fixtures.NO_ALLOWLIST),
        Fixtures.JUDGED,
        next,
      ),
    ]).toEqual([{ deny: Hooks.TOOL_REGISTER_REFUSAL }, 'beneath'])
  })

  test('it decides for every other caller as the hook does', async () => {
    const handler = Fixtures.handlersRegistered()('tool.register')

    expect([
      await handler(
        Fixtures.UNREADABLE,
        Fixtures.JUDGED,
        Fixtures.uncalled('beneath', 'past', 'prepend'),
      ),
      await handler(
        Fixtures.UNREADABLE,
        Fixtures.JUDGED,
        Fixtures.uncalled('beneath', 'past', 'builtin'),
      ),
      await handler(
        Fixtures.answering(Fixtures.NO_ALLOWLIST),
        Fixtures.JUDGED,
        Fixtures.uncalled('beneath', 'past'),
      ),
    ]).toEqual(['past', 'beneath', 'beneath'])
  })

  test('the list and log handlers answer past theirs', async () => {
    const registered = Fixtures.handlersRegistered()
    const next = Fixtures.uncalled('beneath', 'past')

    expect([
      await registered('tool.list')(Fixtures.UNREADABLE, Fixtures.JUDGED, next),
      await registered('tool.list')(Fixtures.THROWING, Fixtures.JUDGED, next),
      await registered('ui.log')(Fixtures.UNREADABLE, Fixtures.JUDGED, next),
      await registered('ui.log')(Fixtures.THROWING, Fixtures.JUDGED, next),
    ]).toEqual(['past', 'past', 'past', 'past'])
  })

  test('the admission handler refuses, log or no log', async () => {
    const handler = Fixtures.handlersRegistered()('plugin.register')
    const next = Fixtures.uncalled('beneath', 'past')
    const lines: string[] = []

    expect([
      await handler(Fixtures.UNREADABLE, Fixtures.JUDGED, next),
      await handler(Fixtures.THROWING, Fixtures.JUDGED, next),
      await handler(
        Fixtures.answering(Fixtures.MANAGED_POLICY, line => {
          lines.push(line)
        }),
        Fixtures.JUDGED,
        next,
      ),
    ]).toEqual([
      { refuse: Hooks.managedModsOnlyRefusal('mine') },
      { refuse: Hooks.managedModsOnlyRefusal('mine') },
      { refuse: Hooks.managedModsOnlyRefusal('mine') },
    ])

    expect(lines).toEqual([Hooks.admissionFailure('mine', { kind: 'throw' })])
  })

  test('a hook that had called next gets that call back', async () => {
    const registered = Fixtures.handlersRegistered()
    const next = Fixtures.replaying('last')

    expect([
      await registered('tool.register')(
        Fixtures.UNREADABLE,
        Fixtures.JUDGED,
        next,
      ),
      await registered('tool.list')(Fixtures.UNREADABLE, Fixtures.JUDGED, next),
      await registered('ui.log')(Fixtures.UNREADABLE, Fixtures.JUDGED, next),
      await registered('plugin.register')(
        Fixtures.UNREADABLE,
        Fixtures.JUDGED,
        next,
      ),
    ]).toEqual(['last', 'last', 'last', 'last'])
  })

  test('the classic and settings handlers answer past theirs', async () => {
    const registered = Fixtures.handlersRegistered()
    const next = Fixtures.uncalled('beneath', 'past')

    expect(
      await Promise.all(
        Fixtures.PASS_OVER_EVENTS.flatMap(event => [
          registered(event)(Fixtures.UNREADABLE, Fixtures.JUDGED, next),
          registered(event)(Fixtures.THROWING, Fixtures.JUDGED, next),
        ]),
      ),
    ).toEqual(['past', 'past', 'past', 'past'])
  })

  test('the subject handlers keep what is theirs from the rest', async () => {
    const registered = Fixtures.handlersRegistered()
    const next = Fixtures.uncalled('beneath', 'past')

    expect(
      await Promise.all(
        Fixtures.SUBJECT_EVENTS.flatMap(event => [
          registered(event)(Fixtures.UNREADABLE, Fixtures.ORGS_SUBJECT, next),
          registered(event)(Fixtures.THROWING, Fixtures.THEIRS_SUBJECT, next),
        ]),
      ),
    ).toEqual([
      'past',
      'beneath',
      'past',
      'beneath',
      'past',
      'beneath',
      'past',
      'beneath',
    ])
  })

  test('they read the provider as their hooks do, tier by tier', async () => {
    const registered = Fixtures.handlersRegistered()
    const next = Fixtures.uncalled('beneath', 'past')

    const providers = [
      ...Fixtures.ORG_PROVIDERS,
      ...Fixtures.ODD_PROVIDERS,
      ...Fixtures.USER_REACHABLE_PROVIDERS,
    ]

    const answers = [
      ...Fixtures.ORG_PROVIDERS.map(() => 'past'),
      ...Fixtures.ODD_PROVIDERS.map(() => 'past'),
      ...Fixtures.USER_REACHABLE_PROVIDERS.map(() => 'beneath'),
    ]

    expect(
      await Promise.all(
        Fixtures.SUBJECT_EVENTS.flatMap(event =>
          providers.map(provider =>
            registered(event)(Fixtures.UNREADABLE, { provider }, next),
          ),
        ),
      ),
    ).toEqual(Fixtures.SUBJECT_EVENTS.flatMap(() => answers))

    expect(
      await Promise.all(
        Fixtures.SUBJECT_EVENTS.flatMap(event =>
          providers.map(provider =>
            registered(event, 'hook')(Fixtures.UNREADABLE, { provider }, next),
          ),
        ),
      ),
      'each hook, asked the same',
    ).toEqual(Fixtures.SUBJECT_EVENTS.flatMap(() => answers))
  })

  test('the classic and settings hooks pass over theirs', async () => {
    const registered = Fixtures.handlersRegistered()
    const next = Fixtures.uncalled('beneath', 'past')

    expect(
      await Promise.all(
        Fixtures.PASS_OVER_EVENTS.map(event =>
          registered(event, 'hook')(Fixtures.UNREADABLE, Fixtures.JUDGED, next),
        ),
      ),
    ).toEqual(['past', 'past'])
  })

  test('each of the six that had called next gets that call back', async () => {
    const registered = Fixtures.handlersRegistered()
    const next = Fixtures.replaying('last')

    expect(
      await Promise.all(
        [...Fixtures.PASS_OVER_EVENTS, ...Fixtures.SUBJECT_EVENTS].map(event =>
          registered(event)(Fixtures.UNREADABLE, Fixtures.ORGS_SUBJECT, next),
        ),
      ),
    ).toEqual(['last', 'last', 'last', 'last', 'last', 'last'])
  })

  test('a line the check hook cannot log changes no answer', async () => {
    const next = Fixtures.rechecked(
      [
        Fixtures.linkOf('easy', 'user', Fixtures.ALLOWED),
        Fixtures.linkOf('engine', 'core', Fixtures.CAPPED_ASK),
      ],
      Fixtures.CAPPED_ASK,
    )

    expect([
      await Fixtures.handlersRegistered()('tool.check', 'hook')(
        Fixtures.THROWING,
        Fixtures.CAPPED,
        next,
      ),
      await Fixtures.handlersRegistered()('tool.check', 'hook')(
        Fixtures.UNREADABLE,
        Fixtures.CAPPED,
        next,
      ),
    ]).toEqual([Fixtures.CAPPED_ASK, Fixtures.CAPPED_ASK])
  })

  test('nor does the line of a deny rule that held', async () => {
    const next = Fixtures.rechecked(
      [
        Fixtures.linkOf('easy', 'user', Fixtures.ALLOWED),
        Fixtures.linkOf('engine', 'core', Fixtures.RULE_DENY),
      ],
      Fixtures.RULE_DENY,
    )

    expect([
      await Fixtures.handlersRegistered()('tool.check', 'hook')(
        Fixtures.THROWING,
        Fixtures.CHECKED,
        next,
      ),
      await Fixtures.handlersRegistered()('tool.check', 'hook')(
        Fixtures.UNREADABLE,
        Fixtures.CHECKED,
        next,
      ),
    ]).toEqual([Fixtures.RULE_DENY, Fixtures.RULE_DENY])
  })

  test('the list hook starts its two runs together', async () => {
    const order: string[] = []

    const listed = Hooks.toolsListed(
      Fixtures.ALLOWLIST,
      Fixtures.JUDGED,
      Fixtures.started(text => {
        order.push(text)
      }),
    )

    expect(order, 'both are started before either settles').toEqual([
      'chain',
      'past append',
    ])

    expect((await listed).value).toEqual([...Fixtures.TOOLS])
  })

  test('a call that throws where it is made is a rejection', async () => {
    await expect(
      Hooks.attempted(Fixtures.THROWING.settings.read),
    ).rejects.toThrow('settings unreadable')

    expect(Hooks.quietly(Fixtures.THROWING.ui.log)).toBe(undefined)
  })
})
