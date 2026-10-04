import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'
import Fixtures from './fixtures'

tier('prepend')

describe('register', () => {
  test(
    'under an MCP allowlist a plugin the person installed may not add a tool',
    {
      plugins: [
        Fixtures.registering('suite', 'prepend'),
        Fixtures.registering('mine'),
        Fixtures.registering('bundled', 'builtin'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.ALLOWLIST }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['suite', 'bundled'])
    },
  )

  test(
    'with no allowlist, a plugin the person installed adds its tool',
    { plugins: [Fixtures.registering('mine')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['mine'])
    },
  )

  test(
    "an organization's registration passes over a refusing user plugin",
    {
      plugins: [
        Fixtures.registering('suite', 'prepend'),
        Fixtures.denying,
        Fixtures.registering('bundled', 'builtin'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(
        registered,
        "a built-in's registration still meets the user's deny",
      ).toEqual(['suite'])
    },
  )

  test(
    'a policy that cannot be read counts as one in force',
    { plugins: [Fixtures.registering('mine')] },
    async ($, on) => {
      const stopPolicy = Fixtures.policyUntilStopped(
        on,
        Fixtures.NO_ALLOWLIST,
        'managed settings unreadable',
      )

      const registered = Fixtures.toolsRegistered(on)

      on('prompt.section', ($, e) => ({ text: e.text }))

      await $.prompt.section(Fixtures.MEMORY)
      stopPolicy()
      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual([])
    },
  )

  test(
    'the organization tools are listed as its tiers listed them',
    { plugins: [Fixtures.relabeling, Fixtures.listing] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.ALLOWLIST }))
      on('tool.list', () => ({ value: [...Fixtures.TOOLS] }))

      const { text } = await $.command.run(Fixtures.TOOLS_COMMAND)

      expect(text?.split('\n')).toEqual([
        'mcp__corp__search: Searches the corp wiki.',
        'Bash: relabeled',
      ])
    },
  )

  test(
    'a server policy delivers itself counts as a tool policy, unlisted',
    { plugins: [Fixtures.relabeling, Fixtures.listing] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.SERVER_POLICY }))
      on('tool.list', () => ({ value: [...Fixtures.TOOLS] }))

      const { text } = await $.command.run(Fixtures.TOOLS_COMMAND)

      expect(text?.split('\n')).toEqual([
        'mcp__corp__search: Searches the corp wiki.',
        'Bash: relabeled',
      ])
    },
  )

  test(
    "with no policy to read the organization's listing stands whole",
    { plugins: [Fixtures.relabeling, Fixtures.listing] },
    async ($, on) => {
      const stopPolicy = Fixtures.policyUntilStopped(
        on,
        Fixtures.ALLOWLIST,
        'settings unreadable',
      )

      on('prompt.section', ($, e) => ({ text: e.text }))
      on('tool.list', () => ({ value: [...Fixtures.TOOLS] }))

      await $.prompt.section(Fixtures.MEMORY)
      stopPolicy()

      const { text } = await $.command.run(Fixtures.TOOLS_COMMAND)

      expect(text?.split('\n')).toEqual([
        'mcp__corp__search: Searches the corp wiki.',
        'Bash: Runs a command.',
      ])
    },
  )

  test(
    'a prompt section passes over the plugins the person installed',
    { plugins: [Fixtures.dropping, Fixtures.signing] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))
      on('prompt.section', ($, e) => ({ text: e.text }))

      expect(await $.prompt.section(Fixtures.MEMORY)).toEqual({
        text: 'the org says hi (signed)',
      })
    },
  )

  test(
    "the system prompt's sections pass over the plugins the person installed",
    { plugins: [Fixtures.emptying, Fixtures.heading] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))

      on('prompt.compose', () => ({
        sections: [{ id: 'body', text: 'the body', scope: 'shared' }],
      }))

      expect(await $.prompt.compose(Fixtures.COMPOSED)).toEqual({
        sections: [
          { id: 'heading:org', text: 'the org says hi', scope: 'shared' },
          { id: 'body', text: 'the body', scope: 'shared' },
        ],
      })
    },
  )

  test(
    "nor does a person's plugin drop or reword a section it asked for",
    { plugins: [Fixtures.rewording, Fixtures.heading] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))

      on('prompt.compose', () => ({
        sections: [{ id: 'body', text: 'the body', scope: 'shared' }],
      }))

      expect(await $.prompt.compose(Fixtures.COMPOSED)).toEqual({
        sections: [
          { id: 'heading:org', text: 'the org says hi', scope: 'shared' },
          { id: 'body', text: 'the body', scope: 'shared' },
        ],
      })
    },
  )

  test(
    "a user plugin's rewrite of policy is skipped for every other reader",
    {
      plugins: [
        Fixtures.stripping,
        Fixtures.reading,
        Fixtures.registering('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const registered = Fixtures.toolsRegistered(on)
      const { text } = await $.command.run(Fixtures.POLICY_COMMAND)

      await $.session.start(Fixtures.SESSION)

      expect(
        JSON.parse(text ?? 'null'),
        "another user plugin's read sees the allowlist the stripper hides",
      ).toEqual(Fixtures.MANAGED_POLICY)

      expect(
        registered,
        "sec-default's own tool.register hook still reads the allowlist",
      ).toEqual([])
    },
  )

  test(
    "an organization provider's subject passes over the user plugins",
    { plugins: [Fixtures.marking] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))
      Fixtures.subjectsEchoed(on)

      for (const provider of Fixtures.ORG_PROVIDERS) {
        expect(
          await $.tool.describe(
            Fixtures.toolDescribed('mcp__corp__search', provider),
          ),
        ).toEqual({ description: 'd' })

        expect(
          (
            await $.command.describe(
              Fixtures.commandDescribed('suite:deploy', provider),
            )
          ).isHidden,
        ).toBe(false)

        expect(
          await $.agent.offer(
            Fixtures.agentOffered('suite:reviewer', provider),
          ),
        ).toEqual({ isOffered: true })

        expect(await $.agent.spawn(Fixtures.agentSpawned(provider))).toEqual({
          model: 'core',
        })
      }

      for (const provider of Fixtures.USER_REACHABLE_PROVIDERS) {
        expect(
          await $.tool.describe(
            Fixtures.toolDescribed('mcp__mine__search', provider),
          ),
        ).toEqual({ description: 'user: d' })

        expect(
          (
            await $.command.describe(
              Fixtures.commandDescribed('mine:deploy', provider),
            )
          ).isHidden,
        ).toBe(true)

        expect(
          await $.agent.offer(Fixtures.agentOffered('reviewer', provider)),
        ).toEqual({ isOffered: false })

        expect(await $.agent.spawn(Fixtures.agentSpawned(provider))).toEqual({
          model: 'user',
        })
      }
    },
  )

  test(
    'an odd provider passes over the user plugins: it fails closed',
    { plugins: [Fixtures.marking] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))
      Fixtures.subjectsEchoed(on)

      for (const provider of Fixtures.ODD_PROVIDERS) {
        expect(
          await $.tool.describe(Fixtures.toolDescribed('Bash', provider)),
        ).toEqual({ description: 'd' })

        expect(await $.agent.spawn(Fixtures.agentSpawned(provider))).toEqual({
          model: 'core',
        })
      }
    },
  )

  test(
    'a subject decision reads no policy; a burst of listings reads once',
    { plugins: [Fixtures.listing] },
    async ($, on) => {
      const reads = Fixtures.policyReads(on, Fixtures.MANAGED_POLICY)

      Fixtures.subjectsEchoed(on)
      on('tool.list', () => ({ value: [...Fixtures.TOOLS] }))

      for (const provider of Fixtures.ORG_PROVIDERS) {
        await $.tool.describe(Fixtures.toolDescribed('mcp__corp__x', provider))
        await $.agent.spawn(Fixtures.agentSpawned(provider))
      }

      expect(reads(), "one read: the person's plugin was admitted").toBe(1)

      await Promise.all([
        $.command.run(Fixtures.TOOLS_COMMAND),
        $.command.run(Fixtures.TOOLS_COMMAND),
        $.command.run(Fixtures.TOOLS_COMMAND),
      ])

      expect(reads()).toBe(2)
    },
  )

  test(
    'the refusal a user-tier caller reads names the allowlist',
    {
      plugins: [
        {
          name: 'asking',
          register(on) {
            on('command.run', { command: 'greet' }, $ =>
              $.tool
                .register({
                  name: 'greet',
                  description: 'Says hello.',
                  inputSchema: { type: 'object' },
                })
                .then(
                  () => ({ text: 'registered' }),
                  (error: unknown) => ({ text: String(error) }),
                ),
            )
          },
        },
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.ALLOWLIST }))

      const { text } = await $.command.run({
        command: 'greet',
        args: '',
        origin: { kind: 'composer' },
        presentation: Fixtures.FULLSCREEN,
      })

      expect(text).toEndWith(
        `asking: $.tool.register: ${Hooks.TOOL_REGISTER_REFUSAL}`,
      )
    },
  )

  test(
    "under allowManagedModsOnly a person's mod is kept out, told why",
    { plugins: [Fixtures.registering('mine')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_MODS_ONLY }))

      const registered = Fixtures.toolsRegistered(on)

      await expect($.session.start(Fixtures.SESSION)).rejects.toThrow(
        Hooks.managedModsOnlyRefusal('mine'),
      )

      expect(registered, 'no hook of it ever ran').toEqual([])
    },
  )

  test(
    "under it the organization's mods and the built-ins load",
    {
      plugins: [
        Fixtures.registering('suite', 'prepend'),
        Fixtures.registering('after', 'append'),
        Fixtures.registering('bundled', 'builtin'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_MODS_ONLY }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['suite', 'after', 'bundled'])
    },
  )

  test(
    'set to false, a mod the person installed loads as before',
    { plugins: [Fixtures.registering('mine')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.modsPolicyOf(false) }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['mine'])
    },
  )

  test(
    "a person's copy under an organization mod's name is still theirs",
    { plugins: [Fixtures.registering('suite')] },
    async ($, on) => {
      on('settings.read', () => ({
        value: { ...Fixtures.MANAGED_POLICY, ...Fixtures.MANAGED_MODS_ONLY },
      }))

      const registered = Fixtures.toolsRegistered(on)

      await expect($.session.start(Fixtures.SESSION)).rejects.toThrow(
        Hooks.managedModsOnlyRefusal('suite'),
      )

      expect(registered).toEqual([])
    },
  )

  test(
    "only managed settings are asked: a person's own cannot loosen it",
    { plugins: [Fixtures.registering('mine')] },
    async ($, on) => {
      Fixtures.policyBySource(
        on,
        Fixtures.MANAGED_MODS_ONLY,
        Fixtures.modsPolicyOf(false),
      )

      const registered = Fixtures.toolsRegistered(on)

      await expect($.session.start(Fixtures.SESSION)).rejects.toThrow(
        Hooks.managedModsOnlyRefusal('mine'),
      )

      expect(registered).toEqual([])
    },
  )

  test(
    "nor turn it on: set only in a person's settings, it is not read",
    { plugins: [Fixtures.registering('mine')] },
    async ($, on) => {
      Fixtures.policyBySource(
        on,
        Fixtures.NO_ALLOWLIST,
        Fixtures.MANAGED_MODS_ONLY,
      )

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['mine'])
    },
  )

  test(
    "a policy that cannot be read keeps a person's mod out: the hook's catch",
    { plugins: [Fixtures.registering('mine')] },
    async ($, on) => {
      on('settings.read', () => ({ deny: 'managed settings unreadable' }))

      const lines = Fixtures.logged(on)
      const registered = Fixtures.toolsRegistered(on)

      await expect($.session.start(Fixtures.SESSION)).rejects.toThrow(
        Hooks.managedModsOnlyRefusal('mine'),
      )

      expect({ registered, lines }).toEqual({
        registered: [],
        lines: [
          'debug: plugin.register hook failed judging mine (throw): ' +
            'sec-default: $.settings.read: managed settings unreadable',
        ],
      })
    },
  )

  test(
    'a deny rule holds over an allow from a plugin the person installed',
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)

      expect(lines).toEqual([
        `transcript: ${Hooks.heldNotice('easy', 'Bash', 'Bash(echo *)')}`,
      ])
    },
  )

  test(
    'two plugins of the person chained are each named once in a session',
    {
      plugins: [Fixtures.allowing('first'), Fixtures.asking('second')],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)
      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)

      expect(lines.toSorted()).toEqual([
        `transcript: ${Hooks.heldNotice('first', 'Bash', 'Bash(echo *)')}`,
        `transcript: ${Hooks.heldNotice('second', 'Bash', 'Bash(echo *)')}`,
      ])
    },
  )

  test(
    'a deny rule turned into an ask by a plugin of the person holds too',
    { plugins: [Fixtures.asking('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))
      Fixtures.logged(on)
      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)
    },
  )

  test(
    "an organization plugin's allow over a deny rule stands, above or below",
    {
      plugins: [
        Fixtures.allowing('suite', 'append'),
        Fixtures.allowing('easy'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ALLOWED)
      expect(lines).toEqual([])
    },
  )

  test(
    "a prepended organization plugin's allow over a deny rule stands",
    { plugins: [Fixtures.allowing('guard', 'prepend')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ALLOWED)
      expect(lines).toEqual([])
    },
  )

  test(
    "a built-in's allow over a deny rule stands",
    { plugins: [Fixtures.allowing('bundled', 'builtin')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ALLOWED)
      expect(lines).toEqual([])
    },
  )

  test(
    'an ask a plugin of the person allows, no deny rule behind it, stands',
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.ASKED)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ALLOWED)
      expect(lines).toEqual([])
    },
  )

  test(
    'a deny no rule decided is still theirs to answer over',
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.PLAIN_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ALLOWED)
      expect(lines).toEqual([])
    },
  )

  test(
    'a plugin of the person that tightens is heard, with one evaluation',
    { plugins: [Fixtures.tightening] },
    async ($, on) => {
      const reads = Fixtures.policyReads(on, Fixtures.MANAGED_POLICY)
      const evaluations = Fixtures.checksAnswered(on, Fixtures.ASKED)

      await $.tool.check(Fixtures.CHECKED)

      const loaded = { reads: reads(), evaluations: evaluations() }

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.PLAIN_DENY)

      expect(
        {
          reads: reads() - loaded.reads,
          evaluations: evaluations() - loaded.evaluations,
        },
        'once its plugins have loaded, a check reads no policy',
      ).toEqual({ reads: 0, evaluations: 1 })
    },
  )

  test(
    "a deny rule holds when an organization's plugin listens above theirs",
    {
      plugins: [
        Fixtures.listening('audit', 'prepend'),
        Fixtures.allowing('easy'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)

      expect(
        lines.map(line => line.includes('easy')),
        'one line, naming the plugin of theirs, alone or in its batch',
      ).toEqual([true])
    },
  )

  test(
    'a plugin of the person that only listens costs no second evaluation',
    { plugins: [Fixtures.listening('listening')] },
    async ($, on) => {
      const reads = Fixtures.policyReads(on, Fixtures.MANAGED_POLICY)
      const evaluations = Fixtures.checksAnswered(on, Fixtures.ASKED)

      await $.tool.check(Fixtures.CHECKED)

      const loaded = { reads: reads(), evaluations: evaluations() }

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ASKED)

      expect(
        {
          reads: reads() - loaded.reads,
          evaluations: evaluations() - loaded.evaluations,
        },
        'once its plugins have loaded, a check reads no policy',
      ).toEqual({ reads: 0, evaluations: 1 })
    },
  )

  test('with none of their plugins the verdict passes once', async ($, on) => {
    const reads = Fixtures.policyReads(on, Fixtures.MANAGED_POLICY)
    const evaluations = Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

    expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)

    expect({ reads: reads(), evaluations: evaluations() }).toEqual({
      reads: 0,
      evaluations: 1,
    })
  })

  test(
    'an allow that never called next meets the deny rule all the same',
    { plugins: [Fixtures.blindAllowing] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)
      const evaluations = Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)

      expect({ lines, evaluations: evaluations() }).toEqual({
        lines: [
          `transcript: ${Hooks.heldNotice('blind', 'Bash', 'Bash(echo *)')}`,
        ],
        evaluations: 1,
      })
    },
  )

  test(
    'a rule a plugin of the person writes into its answer is never read',
    { plugins: [Fixtures.forging] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)

      expect(lines).toEqual([
        `transcript: ${Hooks.heldNotice('forging', 'Bash', 'Bash(echo *)')}`,
      ])
    },
  )

  test(
    'a plugin of the person asking about another command is left out',
    { plugins: [Fixtures.rewriting] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))
      Fixtures.logged(on)

      const asked: unknown[] = []

      on('tool.check', ($, e) => {
        asked.push(e.input)

        return Fixtures.RULE_DENY
      })

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)

      expect(
        asked,
        'the rules were asked about the command that would run, only',
      ).toEqual([Fixtures.CHECKED.input])
    },
  )

  test(
    'managed settings may let the plugins a person installs override',
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.overridePolicyOf(true) }))

      const lines = Fixtures.logged(on)
      const evaluations = Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ALLOWED)

      expect({ lines, evaluations: evaluations() }).toEqual({
        lines: [],
        evaluations: 1,
      })
    },
  )

  test(
    "only managed settings are asked: a person's own cannot lift a deny rule",
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      Fixtures.policyBySource(
        on,
        Fixtures.MANAGED_POLICY,
        Fixtures.overridePolicyOf(true),
      )

      Fixtures.logged(on)
      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)
    },
  )

  test(
    'the option mistyped lifts nothing: only the literal true does',
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.overridePolicyOf('true') }))
      Fixtures.logged(on)
      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)
    },
  )

  test(
    'with a policy that cannot be read the deny rule holds: fails closed',
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      const stopPolicy = Fixtures.policyUntilStopped(
        on,
        Fixtures.overridePolicyOf(true),
        'managed settings unreadable',
      )

      Fixtures.logged(on)
      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)
      on('prompt.section', ($, e) => ({ text: e.text }))

      await $.prompt.section(Fixtures.MEMORY)
      stopPolicy()

      expect(
        await $.tool.check(Fixtures.CHECKED),
        'the policy that read let plugins override; unread, the rule holds',
      ).toEqual(Fixtures.RULE_DENY)
    },
  )

  test(
    "when the rules cannot be evaluated the call is refused: the hook's catch",
    { plugins: [Fixtures.blindAllowing] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))
      Fixtures.logged(on)

      on('tool.check', () => {
        throw new Error('the evaluation failed')
      })

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Hooks.UNCHECKED_DENY)
    },
  )
})
