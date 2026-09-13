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
      on('settings.read', () => ({ deny: 'managed settings unreadable' }))

      const registered = Fixtures.toolsRegistered(on)

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
      on('settings.read', () => ({ deny: 'settings unreadable' }))
      on('tool.list', () => ({ value: [...Fixtures.TOOLS] }))

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
      on('prompt.section', ($, e) => ({ text: e.text }))

      expect(await $.prompt.section(Fixtures.MEMORY)).toEqual({
        text: 'the org says hi (signed)',
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

      expect(reads()).toBe(0)

      await Promise.all([
        $.command.run(Fixtures.TOOLS_COMMAND),
        $.command.run(Fixtures.TOOLS_COMMAND),
        $.command.run(Fixtures.TOOLS_COMMAND),
      ])

      expect(reads()).toBe(1)
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
      })

      expect(text).toEndWith(
        `asking: $.tool.register: ${Hooks.TOOL_REGISTER_REFUSAL}`,
      )
    },
  )
})
