import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'

tier('prepend')

const TOOL = 'mcp__chart__read'

describe('register', () => {
  test("the model's call of a blocked tool is decided beneath", async ($, on) => {
    on('tool.check', () => ({ decision: 'ask', reason: 'beneath' }))

    expect(
      await $.tool.check({ tool: TOOL, input: {}, ceiling: 'deny' }),
    ).toMatchObject({ decision: 'ask', reason: 'beneath' })
  })

  test('a plugin of any tier and a settings hook are refused by name', () => {
    expect(
      (
        [
          { plugin: 'mine', tier: 'user' },
          { plugin: 'suite', tier: 'prepend' },
          { plugin: 'bundled', tier: 'builtin' },
          { plugin: 'hook:PreToolUse', tier: 'user', hookOwner: 'unknown' },
        ] as const
      ).map(origin => Hooks.blockedToolRefusal(TOOL, origin)?.reason),
    ).toEqual(
      Array(4).fill(`${TOOL} is blocked by your organization or role.`),
    )
  })

  test("the organization's own code is decided beneath", () => {
    expect(
      Hooks.blockedToolRefusal(TOOL, {
        plugin: 'suite',
        tier: 'prepend',
        isOrganizations: true,
      }),
    ).toBeUndefined()
  })
})
