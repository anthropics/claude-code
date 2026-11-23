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
      Array(4).fill(
        `${TOOL} is blocked by your organization or role, ` +
          'or switched off for this session.',
      ),
    )
  })

  test('a call whose ceiling is unread is refused to the same callers', () => {
    expect(
      (
        [
          { plugin: 'mine', tier: 'user' },
          { plugin: 'suite', tier: 'prepend', isOrganizations: true },
          { plugin: 'engine', tier: 'core' },
        ] as const
      ).map(origin => Hooks.unreadCeilingRefusal(TOOL, origin)?.decision),
    ).toEqual(['deny', undefined, undefined])
  })

  test("a built-in's file or process call is decided beneath, a person's is not", () => {
    expect(
      (['builtin', 'user', 'prepend'] as const).map(
        tier =>
          Hooks.directCallRefusal(
            { tool: 'Read', input: {}, op: 'fs.read' },
            { plugin: 'p', tier },
          )?.decision,
      ),
    ).toEqual([undefined, 'deny', 'deny'])
  })

  test("and so is the bundled guard's look at a settings path, and no other", () => {
    const guard = 'cc-plugin-sec-default@builtin'

    expect(
      (
        [
          [guard, 'fs.stat', '/x/.claude'],
          [guard, 'fs.stat', '/x/.claude/settings.json'],
          [guard, 'fs.stat', '/x/.claude/settings.local.json'],
          [guard, 'fs.stat', '/x/.claude/cowork_settings.json'],
          [guard, 'fs.stat', '/x/.claude/.credentials.json'],
          [guard, 'fs.stat', '/x/.claude/in/settings.json'],
          [guard, 'fs.stat', '/x/settings.json'],
          [guard, 'fs.stat', '/x/a.claude'],
          [guard, 'fs.list', '/x/.claude'],
          [guard, 'fs.read', '/x/.claude/settings.json'],
          ['diff@builtin', 'fs.stat', '/x/.claude'],
          [undefined, 'fs.stat', '/x/.claude'],
        ] as const
      ).map(
        ([provenance, op, file_path]) =>
          Hooks.directCallRefusal(
            { tool: 'Read', input: { file_path }, op },
            { plugin: 'cc-plugin-sec-default', tier: 'prepend', provenance },
          )?.decision,
      ),
    ).toEqual([...Array(4).fill(undefined), ...Array(8).fill('deny')])
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
