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
    "a plugin of theirs named as an organization's server adds no tool",
    {
      plugins: [
        Fixtures.registering('corp'),
        Fixtures.registering('mine'),
        Fixtures.registering('bundled', 'builtin'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.SERVER_POLICY }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['mine', 'bundled'])
    },
  )

  test(
    "a plugin of theirs named as a seated plugin's own server adds no tool",
    {
      plugins: [
        Fixtures.registering('plugin-corp-suite-corp-jira'),
        Fixtures.registering('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.SEATED_SUITE }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['mine'])
    },
  )

  test(
    "the organization's own plugin under such a name still adds its tool",
    { plugins: [Fixtures.registering('corp', 'append')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.SERVER_POLICY }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['corp'])
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
    "a seated plugin's own server tools are listed as its tiers listed them",
    { plugins: [Fixtures.relabeling, Fixtures.listing] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.SEATED_SUITE }))
      on('tool.list', () => ({ value: [...Fixtures.SUITE_TOOLS] }))

      const { text } = await $.command.run(Fixtures.TOOLS_COMMAND)

      expect(text?.split('\n')).toEqual([
        'mcp__plugin_corp-suite_corp-jira__create_ticket: Creates a ticket.',
        'Bash: relabeled',
      ])
    },
  )

  test(
    'a seated plugin listed in another case has its server tools listed too',
    { plugins: [Fixtures.relabeling, Fixtures.listing] },
    async ($, on) => {
      on('settings.read', () => ({
        value: { prependPlugins: ['Corp-Suite@market'] },
      }))
      on('tool.list', () => ({ value: [...Fixtures.SUITE_TOOLS] }))

      const { text } = await $.command.run(Fixtures.TOOLS_COMMAND)

      expect(text?.split('\n')).toEqual([
        'mcp__plugin_corp-suite_corp-jira__create_ticket: Creates a ticket.',
        'Bash: relabeled',
      ])
    },
  )

  test(
    'a plugin named as one a version-pinned entry turns on adds no tool',
    {
      plugins: [
        Fixtures.registering('corp-suite'),
        Fixtures.registering('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({
        value: { enabledPlugins: { 'corp-suite@market': ['^1.0.0'] } },
      }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['mine'])
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
    'what the engine attaches passes over the plugins the person installed',
    { plugins: [Fixtures.droppingAttachments] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))
      on('prompt.attachment', ($, e) => ({ text: e.text }))

      expect(await $.prompt.attachment(Fixtures.HOOK_NOTE)).toEqual({
        text: Fixtures.HOOK_NOTE.text,
      })
    },
  )

  test(
    'a row the engine injects is kept whole over the plugins they installed',
    { plugins: [Fixtures.blankingRows] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))

      expect(await $.session.append(Fixtures.HOOK_CONTEXT_ROW)).toMatchObject({
        message: { content: Fixtures.HOOK_CONTEXT_ROW.message.content },
      })
      expect(await $.session.append(Fixtures.REMINDER_ROW)).toMatchObject({
        message: { content: Fixtures.REMINDER_ROW.message.content },
      })
    },
  )

  test(
    'any other row is theirs to shape as before',
    { plugins: [Fixtures.blankingRows] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))

      expect(await $.session.append(Fixtures.PROMPT_ROW)).not.toMatchObject({
        message: { content: Fixtures.PROMPT_ROW.message.content },
      })
    },
  )

  test(
    "an organization plugin's note is not theirs to blank; their own is",
    {
      plugins: [
        Fixtures.blankingRows,
        Fixtures.noting('mine'),
        Fixtures.noting('suite', 'append'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))
      on('session.start', ($, e) => ({ cwd: e.cwd }))

      const kept: string[] = []

      on('ui.log', ($, e, next) => {
        kept.push(`${next.origin.plugin} kept ${e.text}`)

        return { value: undefined }
      })

      await $.session.start(Fixtures.SESSION)

      expect(kept.toSorted()).toEqual([
        'mine kept []',
        'suite kept [{"type":"text","text":"a note"}]',
      ])
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
        `transcript: ${Hooks.heldNotice('easy', 'Bash', Fixtures.RULE_DENY, 'lift')}`,
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
        `transcript: ${Hooks.heldNotice('first', 'Bash', Fixtures.RULE_DENY, 'lift')}`,
        `transcript: ${Hooks.heldNotice('second', 'Bash', Fixtures.RULE_DENY, 'lift')}`,
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
    'an ask rule holds over an allow from a plugin the person installed',
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_ASK)

      expect(lines).toEqual([
        `transcript: ${Hooks.heldNotice('easy', 'Bash', Fixtures.RULE_ASK, 'lift')}`,
      ])
    },
  )

  test(
    "a classic hook's ask holds over an allow from a plugin of the person",
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.HOOK_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.HOOK_ASK)

      expect(lines).toEqual([
        `transcript: ${Hooks.heldNotice('easy', 'Bash', Fixtures.HOOK_ASK, 'lift')}`,
      ])
    },
  )

  test(
    "the read block's ask on a shell read holds over their allow",
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.SETTING_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.SETTING_ASK)

      expect(lines).toEqual([
        `transcript: ${Hooks.heldNotice('easy', 'Bash', Fixtures.SETTING_ASK, 'lift')}`,
      ])
    },
  )

  test(
    "the mode's own ask, where a host answers it, holds over their allow",
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.HOST_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.HOST_ASK)

      expect(lines).toEqual([
        `transcript: ${Hooks.heldNotice('easy', 'Bash', Fixtures.HOST_ASK, 'lift')}`,
      ])
    },
  )

  test(
    "an organization plugin's allow over a host's ask stands",
    { plugins: [Fixtures.allowing('corp', 'append')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))
      Fixtures.checksAnswered(on, Fixtures.HOST_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual({
        decision: 'allow',
      })
    },
  )

  test(
    "a classic hook's deny holds over their allow",
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.HOOK_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.HOOK_DENY)

      expect(lines).toEqual([
        `transcript: ${Hooks.heldNotice('easy', 'Bash', Fixtures.HOOK_DENY, 'lift')}`,
      ])
    },
  )

  test(
    "a classic hook's deny holds over their ask",
    { plugins: [Fixtures.asking('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))
      Fixtures.logged(on)
      Fixtures.checksAnswered(on, Fixtures.HOOK_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.HOOK_DENY)
    },
  )

  test(
    'an allow that never called next meets the ask rule all the same',
    { plugins: [Fixtures.blindAllowing] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))
      Fixtures.logged(on)

      const evaluations = Fixtures.checksAnswered(on, Fixtures.RULE_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_ASK)
      expect(evaluations()).toBe(1)
    },
  )

  test(
    "an organization plugin's allow over an ask rule stands",
    {
      plugins: [
        Fixtures.allowing('suite', 'append'),
        Fixtures.allowing('easy'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ALLOWED)
      expect(lines).toEqual([])
    },
  )

  test(
    "an ask of theirs over an ask rule is the rule's ask again, whole",
    { plugins: [Fixtures.asking('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_ASK)

      expect(lines).toEqual([
        'transcript: ' +
          Hooks.heldNotice('easy', 'Bash', Fixtures.RULE_ASK, 'reword'),
      ])
    },
  )

  test(
    "a deny of theirs over a deny rule is the rule's deny again, whole",
    { plugins: [Fixtures.tightening] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)

      expect(lines).toEqual([
        'transcript: ' +
          Hooks.heldNotice('strict', 'Bash', Fixtures.RULE_DENY, 'reword'),
      ])
    },
  )

  test(
    'an ask of theirs that says what it heard costs no second look',
    { plugins: [Fixtures.asking('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)
      const evaluations = Fixtures.checksAnswered(on, Fixtures.ASKED)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ASKED)
      expect({ lines, evaluations: evaluations() }).toEqual({
        lines: [],
        evaluations: 1,
      })
    },
  )

  test(
    'the option that lets them override deny rules lets them override these',
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.overridePolicyOf(true) }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ALLOWED)
      expect(lines).toEqual([])
    },
  )

  test(
    "the mode's own ask, no rule or hook behind it, is theirs to allow",
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
    'a deny holds whatever decided it: it may stand before a rule or a hook',
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.PLAIN_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.PLAIN_DENY)

      expect(lines).toEqual([
        `transcript: ${Hooks.heldNotice('easy', 'Bash', Fixtures.PLAIN_DENY, 'lift')}`,
      ])
    },
  )

  test(
    'the notice is no door: a plugin of theirs never runs inside this hook',
    { plugins: [Fixtures.sneaking] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_DENY)

      expect(lines).toEqual([
        'transcript: ' +
          Hooks.heldNotice('sneaking', 'Bash', Fixtures.RULE_DENY, 'lift'),
      ])
    },
  )

  test(
    'nor is the notice theirs to drop',
    { plugins: [Fixtures.muting] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.RULE_ASK)

      expect(lines).toEqual([
        `transcript: ${Hooks.heldNotice('muting', 'Bash', Fixtures.RULE_ASK, 'lift')}`,
      ])
    },
  )

  test(
    "an organization's line is not theirs to drop; a line of their own is",
    {
      plugins: [
        Fixtures.muting,
        Fixtures.logging('mine'),
        Fixtures.logging('bundled', 'builtin'),
        Fixtures.logging('suite', 'append'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))
      on('session.start', ($, e) => ({ cwd: e.cwd }))

      const heard: string[] = []

      on('ui.log', ($, e, next) => {
        heard.push(next.origin.plugin)

        return { value: undefined }
      })

      await $.session.start(Fixtures.SESSION)

      expect(heard).toEqual(['suite'])
    },
  )

  test(
    'each plugin is told of a kind, by the tool it answered on',
    { plugins: [Fixtures.allowingBash, Fixtures.allowingRead] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_DENY)

      await $.tool.check(Fixtures.CHECKED)
      await $.tool.check(Fixtures.CHECKED_READ)

      expect(lines).toEqual([
        `transcript: ${Hooks.heldNotice('basher', 'Bash', Fixtures.RULE_DENY, 'lift')}`,
        `transcript: ${Hooks.heldNotice('reader', 'Read', Fixtures.RULE_DENY, 'lift')}`,
      ])
    },
  )

  test(
    "an organization's appended plugin has its say in the run past theirs",
    {
      plugins: [Fixtures.allowing('suite', 'append'), Fixtures.blindAllowing],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)

      Fixtures.checksAnswered(on, Fixtures.RULE_ASK)

      expect(await $.tool.check(Fixtures.CHECKED)).toEqual(Fixtures.ALLOWED)
      expect(lines).toEqual([])
    },
  )

  test(
    'a plugin is told once of each kind of thing that held over it',
    { plugins: [Fixtures.allowing('easy')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)
      const verdicts = [
        Fixtures.RULE_DENY,
        Fixtures.RULE_ASK,
        Fixtures.RULE_ASK,
        Fixtures.HOOK_ASK,
        Fixtures.PLAIN_DENY,
        Fixtures.RULE_DENY,
      ]
      const turn = Fixtures.checksAnsweredInTurn(on, verdicts)

      for (const verdict of verdicts) {
        expect(await $.tool.check(Fixtures.CHECKED)).toEqual(verdict)
        turn()
      }

      expect(lines).toEqual(
        [
          Fixtures.RULE_DENY,
          Fixtures.RULE_ASK,
          Fixtures.HOOK_ASK,
          Fixtures.PLAIN_DENY,
        ].map(
          held =>
            `transcript: ${Hooks.heldNotice('easy', 'Bash', held, 'lift')}`,
        ),
      )
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
          'transcript: ' +
            Hooks.heldNotice('blind', 'Bash', Fixtures.RULE_DENY, 'lift'),
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
        'transcript: ' +
          Hooks.heldNotice('forging', 'Bash', Fixtures.RULE_DENY, 'lift'),
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

  test('the refusal of a pinned variable names the setting and it', () => {
    expect(Hooks.pinnedVariableRefusal('CORP_PROXY')).toBe(
      'env (managed): CORP_PROXY is not for plugins outside policy to change',
    )
  })

  test('a name managed env sets is pinned, in any case; no other is', () => {
    expect(
      ['CORP_PROXY', 'corp_proxy', 'Corp_Proxy', 'CORP', 'CORP_PROXY_2'].map(
        name => Hooks.isPinnedVariable(Fixtures.PINNING_POLICY, name),
      ),
    ).toEqual([true, true, true, false, false])
  })

  test('whichever case managed env itself spells it in', () => {
    expect(
      ['CORP_PROXY', 'corp_proxy', 'CORP'].map(name =>
        Hooks.isPinnedVariable(Fixtures.LOWER_CASE_PINNING_POLICY, name),
      ),
    ).toEqual([true, true, false])
  })

  test('a name managed env sets to nothing is pinned all the same', () => {
    expect(
      Hooks.isPinnedVariable({ env: { CORP_PROXY: '' } }, 'CORP_PROXY'),
    ).toBe(true)
  })

  test('settings with no env pin nothing', () => {
    expect(
      [Fixtures.MANAGED_POLICY, {}, { env: {} }].map(policy =>
        Hooks.isPinnedVariable(policy, 'CORP_PROXY'),
      ),
    ).toEqual([false, false, false])
  })

  test(
    'a variable managed settings pin is not for a plugin of the person to set',
    {
      plugins: [
        Fixtures.settingProxy('suite', 'prepend'),
        Fixtures.settingProxy('mine'),
        Fixtures.settingProxy('bundled', 'builtin'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.PINNING_POLICY }))

      const lines = Fixtures.logged(on)
      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual(['suite CORP_PROXY=mine', 'bundled CORP_PROXY=mine'])
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(Hooks.pinnedVariableRefusal('CORP_PROXY'))
    },
  )

  test(
    'nor to unset',
    { plugins: [Fixtures.unsettingProxy] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.PINNING_POLICY }))

      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual([])
    },
  )

  test(
    'nor under another case, which some systems read as the same name',
    { plugins: [Fixtures.settingLowerCase] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.PINNING_POLICY }))
      Fixtures.logged(on)

      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual([])
    },
  )

  test(
    "what an organization's plugin reads is not theirs to answer",
    {
      plugins: [
        Fixtures.answeringReads,
        Fixtures.readingProxy('mine'),
        Fixtures.readingProxy('suite', 'append'),
        Fixtures.readingProxy('guard', 'prepend'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.PINNING_POLICY }))
      on('session.start', ($, e) => ({ cwd: e.cwd }))
      on('env.get', () => ({ value: 'as the engine holds it' }))

      const lines = Fixtures.loggedBy(on)

      await $.session.start(Fixtures.SESSION)

      expect(lines.toSorted()).toEqual([
        'guard read as the engine holds it',
        'mine read theirs',
        'suite read as the engine holds it',
      ])
    },
  )

  test(
    "nor to rewrite what an organization's plugin sets, pinned or not",
    {
      plugins: [
        Fixtures.revaluing,
        Fixtures.settingProxy('suite', 'append'),
        Fixtures.settingOther('audit', 'append'),
        Fixtures.settingOther('guard', 'prepend'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.PINNING_POLICY }))

      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set.toSorted()).toEqual([
        'audit OTHER=mine',
        'guard OTHER=mine',
        'suite CORP_PROXY=mine',
      ])
    },
  )

  test(
    "an organization's write waits on no policy read, so none can fail it",
    {
      plugins: [Fixtures.revaluing, Fixtures.settingOther('audit', 'append')],
    },
    async ($, on) => {
      const stopPolicy = Fixtures.policyUntilStopped(
        on,
        Fixtures.MANAGED_POLICY,
        'managed settings unreadable',
      )

      Fixtures.logged(on)

      on('prompt.section', ($, e) => ({ text: e.text }))

      const set = Fixtures.variablesSet(on)

      await $.prompt.section(Fixtures.MEMORY)
      stopPolicy()
      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual(['audit OTHER=mine'])
    },
  )

  test(
    "a built-in's write of a variable nobody pins still passes their hooks",
    {
      plugins: [
        Fixtures.revaluing,
        Fixtures.settingOther('bundled', 'builtin'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.PINNING_POLICY }))

      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual(['bundled OTHER=theirs'])
    },
  )

  test(
    'the option that lets them override deny rules unpins nothing',
    { plugins: [Fixtures.settingProxy('mine')] },
    async ($, on) => {
      on('settings.read', () => ({
        value: {
          ...Fixtures.overridePolicyOf(true),
          ...Fixtures.PINNING_POLICY,
        },
      }))
      Fixtures.logged(on)

      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual([])
    },
  )

  test(
    'a variable managed settings do not pin is theirs to set',
    { plugins: [Fixtures.settingOther('mine')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.PINNING_POLICY }))

      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual(['mine OTHER=mine'])
    },
  )

  test(
    "only managed settings pin: a person's own env binds no plugin",
    { plugins: [Fixtures.settingProxy('mine')] },
    async ($, on) => {
      Fixtures.policyBySource(
        on,
        Fixtures.MANAGED_POLICY,
        Fixtures.PINNING_POLICY,
      )

      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual(['mine CORP_PROXY=mine'])
    },
  )

  test(
    'with a policy that cannot be read they set no variable: fails closed',
    { plugins: [Fixtures.settingOther('mine')] },
    async ($, on) => {
      const stopPolicy = Fixtures.policyUntilStopped(
        on,
        Fixtures.MANAGED_POLICY,
        'managed settings unreadable',
      )

      Fixtures.logged(on)

      on('prompt.section', ($, e) => ({ text: e.text }))

      const set = Fixtures.variablesSet(on)

      await $.prompt.section(Fixtures.MEMORY)
      stopPolicy()
      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual([])
    },
  )

  test("a server's own name, and any name under its tools' prefix", () => {
    expect(
      ['corp', 'corp__x', 'corp__x__y', 'corp._x'].map(plugin =>
        Hooks.namesOrgTool(Fixtures.SERVER_POLICY, plugin, 'greet'),
      ),
    ).toEqual([true, true, true, true])
  })

  test('a name that only begins like one is no server of theirs', () => {
    expect(
      ['corporate', 'corpx', 'x__corp', 'x-corp', 'mine'].map(plugin =>
        Hooks.namesOrgTool(Fixtures.SERVER_POLICY, plugin, 'greet'),
      ),
    ).toEqual([false, false, false, false, false])
  })

  test('another case or other separators spell the same server', () => {
    expect(
      ['Corp', 'CORP', 'corp_x', 'corp-x', 'corp.x', '_corp_'].map(plugin =>
        Hooks.namesOrgTool(Fixtures.SERVER_POLICY, plugin, 'greet'),
      ),
    ).toEqual([true, true, true, true, true, true])
  })

  test('a claude.ai server with a run of spaces folds as its tools do', () => {
    expect(
      ['mcp__claude_ai_tools__x', 'mcp__claude_ai__tools__x'].map(tool =>
        Hooks.isOrgTool(
          { managedMcpServers: { 'claude.ai  tools': {} } },
          tool,
        ),
      ),
    ).toEqual([true, true])
  })

  test('a plugin and its tool that spell a server together count too', () => {
    expect(
      [
        ['corp', 'prod__deploy'],
        ['corp', 'deploy'],
        ['corp_tools', 'greet'],
        ['corp', 'tools__greet'],
      ].map(([plugin = '', tool = '']) =>
        Hooks.namesOrgTool(
          { managedMcpServers: { corp__prod: {}, 'corp.tools': {} } },
          plugin,
          tool,
        ),
      ),
    ).toEqual([true, false, true, true])
  })

  test("a seated plugin's own servers are the organization's", () => {
    expect([
      Hooks.namesOrgTool(
        Fixtures.SEATED_SUITE,
        'plugin_corp-suite_corp-jira',
        'create_ticket',
      ),
      Hooks.namesOrgTool(Fixtures.SEATED_SUITE, 'Plugin.Corp_Suite.x', 'y'),
      Hooks.isOrgTool(
        Fixtures.SEATED_SUITE,
        'mcp__plugin_corp-suite_corp-jira__create_ticket',
      ),
    ]).toEqual([true, true, true])
  })

  test('a seated plugin is told in any case, as the engine seats it', () => {
    const listed = { prependPlugins: ['Corp-Suite@market'] }

    expect([
      Hooks.isOrgTool(listed, 'mcp__plugin_corp-suite_corp-jira__x'),
      Hooks.isOrgTool(listed, 'mcp__corp-suite__greet'),
      Hooks.isOrgTool(Fixtures.SEATED_SUITE, 'mcp__plugin_Corp-Suite_j__x'),
      Hooks.isOrgTool(listed, 'mcp__plugin_corp-suites_j__x'),
      Hooks.isOrgTool(Fixtures.SERVER_POLICY, 'mcp__Corp__search'),
    ]).toEqual([true, true, true, false, false])
  })

  test('an entry that pins versions turns its plugin on, as true does', () => {
    const pinned = { enabledPlugins: { 'corp-suite@market': ['^1.0.0'] } }
    const off = { enabledPlugins: { 'corp-suite@market': false } }

    expect([
      Hooks.namesOrgTool(pinned, 'corp-suite', 'greet'),
      Hooks.isOrgTool(pinned, 'mcp__corp-suite__greet'),
      Hooks.namesOrgTool(off, 'corp-suite', 'greet'),
      Hooks.namesOrgTool(pinned, 'mine', 'greet'),
    ]).toEqual([true, true, false, false])
  })

  test('a name in the other normalization form is the same name', () => {
    const policy = { prependPlugins: ['caf\u00e9-suite@market'] }

    expect([
      Hooks.namesOrgTool(policy, 'cafe\u0301-suite', 'x'),
      Hooks.isOrgTool(policy, 'mcp__plugin_cafe\u0301-suite_jira__x'),
      Hooks.isOrgTool(policy, 'mcp__cafe\u0301-suite__x'),
    ]).toEqual([true, true, true])
  })

  test('only the id managed settings turn on keeps its own name', () => {
    const policy = {
      enabledPlugins: { 'corp-guard@corp-market': true },
      appendPlugins: ['corp-guard@corp-market'],
    }
    const asked = (id?: string) =>
      Hooks.namesOrgTool(policy, 'corp-guard', 'x', id)

    expect([
      asked('corp-guard@corp-market'),
      asked('Corp-Guard@Corp-Market'),
      asked('corp-guard@inline'),
      asked('corp-guard@elsewhere'),
      asked('corp_guard@corp-market'),
      asked(),
      Hooks.namesOrgTool(
        { ...policy, managedMcpServersUnreadable: true },
        'corp-guard',
        'x',
        'corp-guard@corp-market',
      ),
      Hooks.namesOrgTool({}, 'corp-guard', 'x', 'corp-guard@inline'),
    ]).toEqual([false, false, true, true, true, true, true, false])
  })

  test('an accented name is told as the engine spells it in a tool', () => {
    const composed = { prependPlugins: ['caf\u00e9-suite@market'] }
    const decomposed = { prependPlugins: ['cafe\u0301-suite@market'] }

    expect([
      Hooks.isOrgTool(composed, 'mcp__caf_-suite__x'),
      Hooks.isOrgTool(composed, 'mcp__cafe_-suite__x'),
      Hooks.isOrgTool(decomposed, 'mcp__caf_-suite__x'),
      Hooks.isOrgTool(decomposed, 'mcp__cafe_-suite__x'),
      Hooks.isOrgTool(composed, 'mcp__plugin_caf_-suite_jira__x'),
      Hooks.namesOrgTool(composed, 'caf.-suite', 'x'),
      Hooks.namesOrgTool(composed, 'cafe\u0301-suite', 'x'),
      Hooks.namesOrgTool(decomposed, 'caf\u00e9-suite', 'x'),
    ]).toEqual([true, true, true, true, true, true, true, true])
  })

  test('a combining mark on a plain letter does not part a name', () => {
    const decomposed = { prependPlugins: ['cafe\u0301-suite@market'] }

    expect([
      Hooks.namesOrgTool(Fixtures.SEATED_SUITE, 'corp-suite\u0301', 'x'),
      Hooks.isOrgTool(
        Fixtures.SEATED_SUITE,
        'mcp__plugin_corp-suite\u0301_jira__x',
      ),
      Hooks.namesOrgTool(decomposed, 'cafe\u0301-suite', 'x'),
      Hooks.isOrgTool(decomposed, 'mcp__cafe\u0301-suite__x'),
    ]).toEqual([true, true, true, true])
  })

  test('a name in plain letters folds exactly as before', () => {
    expect(
      ['Corp__Tools', 'corp-tools', 'corp.tools', 'CORP TOOLS'].map(
        Hooks.toolPrefixOf,
      ),
    ).toEqual([
      'mcp_corp_tools_',
      'mcp_corp_tools_',
      'mcp_corp_tools_',
      'mcp_corp_tools_',
    ])
  })

  test("a name unlike a seated plugin's servers is nobody else's", () => {
    expect([
      Hooks.namesOrgTool(Fixtures.SEATED_SUITE, 'mine', 'greet'),
      Hooks.namesOrgTool(Fixtures.SEATED_SUITE, 'plugin_mine_jira', 'x'),
      Hooks.namesOrgTool(Fixtures.SEATED_SUITE, 'plugin_corp-suites', 'x'),
      Hooks.isOrgTool(Fixtures.SEATED_SUITE, 'mcp__plugin_mine_jira__x'),
      Hooks.isOrgTool(Fixtures.SEATED_SUITE, 'mcp__plugin_corp-suites_j__x'),
      Hooks.isOrgTool(Fixtures.SEATED_SUITE, 'mcp__mine__greet'),
    ]).toEqual([false, false, false, false, false, false])
  })

  test('a server the allowlist names counts as one it delivers does', () => {
    expect(
      [Fixtures.ALLOWLIST, Fixtures.NO_ALLOWLIST, {}].map(policy =>
        Hooks.namesOrgTool(policy, 'corp__x', 'greet'),
      ),
    ).toEqual([true, false, false])
  })

  test('a server named with a dot or a space owns its tools', () => {
    expect(
      ['mcp__corp_tools__x', 'mcp__my_wiki__x', 'mcp__corp__x'].map(tool =>
        Hooks.isOrgTool(
          { managedMcpServers: { 'corp.tools': {}, 'my wiki': {} } },
          tool,
        ),
      ),
    ).toEqual([true, true, false])
  })

  test("an organization's ask cap holds over a plugin's allow", () => {
    expect(Hooks.holdsOver(Fixtures.CEILING_ASK, Fixtures.CEILING_ALLOW)).toBe(
      true,
    )
  })

  test('the launcher variable is pinned where policy names a launcher', () => {
    expect(
      [
        'CLAUDE_CODE_PROCESS_WRAPPER',
        'claude_code_process_wrapper',
        'CORP_PROXY',
      ].map(name => Hooks.isPinnedVariable(Fixtures.WRAPPING_POLICY, name)),
    ).toEqual([true, true, false])
  })

  test('a server whose name folds to nothing refuses every name', () => {
    expect(
      ['mine', 'corp', 'x__y'].map(plugin =>
        Hooks.namesOrgTool(Fixtures.UNFOLDABLE_POLICY, plugin, 'greet'),
      ),
    ).toEqual([true, true, true])
  })

  test("a server's tools are told by its name whole, as the engine spells it", () => {
    expect(
      ['mcp__corp__x', 'mcp__corp-tools__x', 'mcp__Corp__x', 'mcp__--__x'].map(
        tool =>
          Hooks.isOrgTool({ managedMcpServers: { corp: {}, '--': {} } }, tool),
      ),
    ).toEqual([true, false, false, true])
  })

  test("a server named corp does not claim a corp-tools server's tools", () => {
    expect(
      Hooks.isOrgTool(
        { managedMcpServers: { corp: {} } },
        'mcp__corp-tools__x',
      ),
    ).toBe(false)
  })

  test(
    'a compaction is not theirs to answer',
    { plugins: [Fixtures.compacting] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))
      on('session.compact', ($, e) => ({ messages: e.messages }))

      expect(
        await $.session.compact({
          trigger: 'plugin',
          messages: [Fixtures.COMPACTED_TURN],
        }),
      ).toEqual({ messages: [Fixtures.COMPACTED_TURN] })
    },
  )

  test("a tool whose own name folds to nothing reads as the server's too", () => {
    expect(
      [
        ['Corp', '-'],
        ['Corp', '_'],
        ['other', '-'],
      ].map(([plugin = '', tool = '']) =>
        Hooks.namesOrgTool({ managedMcpServers: { corp: {} } }, plugin, tool),
      ),
    ).toEqual([true, true, false])
  })

  test("an organization's own plugins' names are refused like its servers'", () => {
    const policy = {
      prependPlugins: ['corp-guard@market'],
      appendPlugins: ['corp-audit@market', 'plain'],
    }

    expect(
      [
        ['Corp_Audit', 'x'],
        ['corp.guard', 'x'],
        ['PLAIN', 'x'],
        ['mine', 'x'],
      ].map(([plugin = '', tool = '']) =>
        Hooks.namesOrgTool(policy, plugin, tool),
      ),
    ).toEqual([true, true, true, false])
    expect(
      ['mcp__corp-audit__x', 'mcp__plain__x', 'mcp__mine__x'].map(tool =>
        Hooks.isOrgTool(policy, tool),
      ),
    ).toEqual([true, true, false])
  })

  test('an unreadable server file refuses every name and owns every server tool', () => {
    const policy = { managedMcpServersUnreadable: true }

    expect(Hooks.namesOrgTool(policy, 'mine', 'greet')).toBe(true)
    expect(
      ['mcp__any__x', 'Bash'].map(tool => Hooks.isOrgTool(policy, tool)),
    ).toEqual([true, false])
    expect(Hooks.isPinnedVariable(policy, 'CORP_PROXY')).toBe(false)
  })

  test(
    "a compaction's summary is kept whole over the plugins they installed",
    { plugins: [Fixtures.blankingRows] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))

      expect(await $.session.append(Fixtures.COMPACTION_ROW)).toMatchObject({
        message: { content: Fixtures.COMPACTION_ROW.message.content },
      })
    },
  )

  test("a plugin managed settings turn on is the organization's by name too", () => {
    const policy = {
      enabledPlugins: {
        'corp-guard@corp-market': true,
        'left-off@corp-market': false,
        'diff@builtin': true,
      },
    }

    expect(
      ['Corp_Guard', 'left-off', 'diff', 'mine'].map(plugin =>
        Hooks.namesOrgTool(policy, plugin, 'x'),
      ),
    ).toEqual([true, false, false, false])
    expect(
      ['mcp__corp-guard__x', 'mcp__left-off__x'].map(tool =>
        Hooks.isOrgTool(policy, tool),
      ),
    ).toEqual([true, false])
  })

  test(
    "a skill the Skill tool hands over is kept whole; another tool's row is theirs",
    { plugins: [Fixtures.blankingRows] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))

      expect(await $.session.append(Fixtures.SKILL_ROW)).toMatchObject({
        message: { content: Fixtures.SKILL_ROW.message.content },
      })
      expect(
        await $.session.append(Fixtures.READ_MESSAGE_ROW),
      ).not.toMatchObject({
        message: { content: Fixtures.READ_MESSAGE_ROW.message.content },
      })
    },
  )

  test(
    "the organization's own plugin in the user tier keeps its name",
    {
      plugins: [
        Fixtures.registering('corp-guard'),
        Fixtures.registering('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({
        value: { enabledPlugins: { 'corp-guard@claude-plugin-test': true } },
      }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['corp-guard', 'mine'])
    },
  )

  test(
    'and keeps it when a version list turns it on',
    {
      plugins: [
        Fixtures.registering('corp-guard'),
        Fixtures.registering('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({
        value: {
          enabledPlugins: { 'corp-guard@claude-plugin-test': ['^1.0.0'] },
        },
      }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['corp-guard', 'mine'])
    },
  )

  test(
    'an id in another letter case is the same id, as the engine folds one',
    {
      plugins: [
        Fixtures.registering('corp-guard'),
        Fixtures.registering('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({
        value: { enabledPlugins: { 'Corp-Guard@Claude-Plugin-Test': true } },
      }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['corp-guard', 'mine'])
    },
  )

  test(
    'an id listed only for its place exempts nobody',
    {
      plugins: [
        Fixtures.registering('corp-guard'),
        Fixtures.registering('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({
        value: { prependPlugins: ['corp-guard@claude-plugin-test'] },
      }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['mine'])
    },
  )

  test(
    'an id managed settings turn off exempts nobody',
    {
      plugins: [
        Fixtures.registering('corp-guard'),
        Fixtures.registering('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({
        value: {
          enabledPlugins: { 'corp-guard@claude-plugin-test': false },
          appendPlugins: ['corp-guard@claude-plugin-test'],
        },
      }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['mine'])
    },
  )

  test(
    "a plugin whose name only folds to the organization's is refused",
    {
      plugins: [
        Fixtures.registering('corp--guard'),
        Fixtures.registering('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({
        value: { enabledPlugins: { 'corp-guard@claude-plugin-test': true } },
      }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['mine'])
    },
  )

  test(
    'the plugin the engine seats as the organization keeps its own name',
    { plugins: [Fixtures.registering('corp-guard', 'prepend')] },
    async ($, on) => {
      on('settings.read', () => ({
        value: { enabledPlugins: { 'corp-guard@claude-plugin-test': true } },
      }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['corp-guard'])
    },
  )

  test(
    'a plugin of the same name from another source is refused it',
    {
      plugins: [
        Fixtures.registering('corp-guard'),
        Fixtures.registering('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({
        value: { enabledPlugins: { 'corp-guard@corp-market': true } },
      }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual(['mine'])
    },
  )

  test(
    'the folder managed settings are read from is not theirs to repoint',
    { plugins: [Fixtures.repointingSettings('mine')] },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.NO_ALLOWLIST }))
      Fixtures.logged(on)

      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual([])
    },
  )

  test('that variable is pinned whatever managed settings hold, in any case', () => {
    expect(
      [
        'CLAUDE_CODE_MANAGED_SETTINGS_PATH',
        'claude_code_managed_settings_path',
        'CORP_PROXY',
      ].map(name => Hooks.isPinnedVariable({}, name)),
    ).toEqual([true, true, false])
  })

  test('a scoped id is parted at its last at-sign', () => {
    const policy = { prependPlugins: ['@scope/corp-guard@npm'] }

    expect(
      ['scope-corp-guard', 'Scope.Corp.Guard', 'mine'].map(plugin =>
        Hooks.namesOrgTool(policy, plugin, 'x'),
      ),
    ).toEqual([true, true, false])
    expect(Hooks.isOrgTool(policy, 'mcp__scope_corp-guard__x')).toBe(true)
  })

  test('the override switch in a policy the person can write lifts nothing', () => {
    const written = {
      pluginConfigs: {
        'cc-plugin-sec-default@builtin': {
          options: { allowModsToOverrideDenyRules: true },
        },
      },
    }

    expect(
      [written, { ...written, personWritablePolicy: true }].map(policy =>
        Hooks.denyRulesHold(policy),
      ),
    ).toEqual([false, true])
  })

  test('every variable that says where policy is read from is pinned', () => {
    expect(
      [
        'CLAUDE_CODE_MANAGED_SETTINGS_PATH',
        'CLAUDE_CODE_REMOTE_SETTINGS_PATH',
        'CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION',
        'CLAUDE_CODE_MOCK_REMOTE_SETTINGS',
        'CLAUDE_CONFIG_DIR',
        'CLAUDE_SECURESTORAGE_CONFIG_DIR',
        'USE_LOCAL_OAUTH',
        'USE_STAGING_OAUTH',
        'CLAUDE_LOCAL_OAUTH_API_BASE',
      ].map(name => Hooks.isPinnedVariable({}, name)),
    ).toEqual([true, true, true, true, true, true, true, true, true])
  })

  test('every variable that can load code into a child is pinned', () => {
    expect(
      [
        'LD_PRELOAD',
        'LD_LIBRARY_PATH',
        'LD_AUDIT',
        'DYLD_INSERT_LIBRARIES',
        'DYLD_LIBRARY_PATH',
        'DYLD_FRAMEWORK_PATH',
        'BASH_ENV',
        'ENV',
        'ZDOTDIR',
        'NODE_OPTIONS',
        'ld_preload',
        'PATH',
        'HOME',
      ].map(name => Hooks.isPinnedVariable({}, name)),
    ).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ])
  })

  test(
    "LD_PRELOAD is not a person's plugin's to set",
    {
      plugins: [
        Fixtures.settingLdPreload('suite', 'prepend'),
        Fixtures.settingLdPreload('mine'),
        Fixtures.settingLdPreload('bundled', 'builtin'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)
      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual([
        'suite LD_PRELOAD=mine',
        'bundled LD_PRELOAD=mine',
      ])
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(Hooks.pinnedVariableRefusal('LD_PRELOAD'))
    },
  )

  test(
    "DYLD_INSERT_LIBRARIES is not a person's plugin's to set",
    {
      plugins: [
        Fixtures.settingDyldInsert('suite', 'prepend'),
        Fixtures.settingDyldInsert('mine'),
        Fixtures.settingDyldInsert('bundled', 'builtin'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)
      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual([
        'suite DYLD_INSERT_LIBRARIES=mine',
        'bundled DYLD_INSERT_LIBRARIES=mine',
      ])
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(
        Hooks.pinnedVariableRefusal('DYLD_INSERT_LIBRARIES'),
      )
    },
  )

  test(
    "BASH_ENV is not a person's plugin's to set",
    {
      plugins: [
        Fixtures.settingBashEnv('suite', 'prepend'),
        Fixtures.settingBashEnv('mine'),
        Fixtures.settingBashEnv('bundled', 'builtin'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)
      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual([
        'suite BASH_ENV=mine',
        'bundled BASH_ENV=mine',
      ])
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(Hooks.pinnedVariableRefusal('BASH_ENV'))
    },
  )

  test(
    "NODE_OPTIONS is not a person's plugin's to set",
    {
      plugins: [
        Fixtures.settingNodeOptions('suite', 'prepend'),
        Fixtures.settingNodeOptions('mine'),
        Fixtures.settingNodeOptions('bundled', 'builtin'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)
      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual([
        'suite NODE_OPTIONS=mine',
        'bundled NODE_OPTIONS=mine',
      ])
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(Hooks.pinnedVariableRefusal('NODE_OPTIONS'))
    },
  )

  test(
    'nor is NODE_OPTIONS theirs to unset',
    {
      plugins: [
        Fixtures.unsettingNodeOptions('suite', 'prepend'),
        Fixtures.unsettingNodeOptions('mine'),
      ],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: Fixtures.MANAGED_POLICY }))

      const lines = Fixtures.logged(on)
      const set = Fixtures.variablesSet(on)

      await $.session.start(Fixtures.SESSION)

      expect(set).toEqual(['suite NODE_OPTIONS=undefined'])
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(Hooks.pinnedVariableRefusal('NODE_OPTIONS'))
    },
  )

  test(
    'a listed id that is one at-sign refuses every registration of theirs',
    {
      plugins: [Fixtures.registering('mine'), Fixtures.registering('other')],
    },
    async ($, on) => {
      on('settings.read', () => ({ value: { prependPlugins: ['@'] } }))

      const registered = Fixtures.toolsRegistered(on)

      await $.session.start(Fixtures.SESSION)

      expect(registered).toEqual([])
    },
  )

  test('a listed id with no name half protects what follows its at-sign', () => {
    const policy = { prependPlugins: ['@market'] }

    expect(
      ['market', 'Market', 'mine'].map(plugin =>
        Hooks.namesOrgTool(policy, plugin, 'x'),
      ),
    ).toEqual([true, true, false])
  })
})
