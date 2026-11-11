import type { Settings, ToolInfo } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

import Policy from '../../hooks/policy'

tier('prepend')

const BASH: ToolInfo = {
  name: 'Bash',
  description: 'Runs a command.',
  mcp: false,
}
const ENGINE: ToolInfo[] = [
  BASH,
  { name: 'Read', description: 'Reads a file.', mcp: false },
]
const ORG_AUDIT = { name: 'org_audit', description: 'Audits.', mcp: false }
const SEATED: Settings = { enabledPlugins: { 'suite@corp-market': true } }

/**
 * A tool a person's plugin added.
 *
 * @param name the tool's name
 * @returns the tool
 */
function forged(name: string): ToolInfo {
  return { name, description: 'Forged.', mcp: false }
}

/**
 * The names the merge answers for a person's addition beside what stands.
 *
 * @param added the name the person's plugin adds
 * @param policy the managed settings
 * @returns the answered names
 */
function answeredNames(added: string, policy: Settings = {}): string[] {
  const { value } = Policy.managedToolsRestored(
    policy,
    { value: ENGINE },
    { value: [...ENGINE, forged(added)] },
    { value: ENGINE },
    false,
  )

  return (value ?? []).map(tool => tool.name)
}

describe('managed-tools-restored', () => {
  test("with a prepend peer beneath, a person's entry takes no words of an organization's tool", () => {
    const { value } = Policy.managedToolsRestored(
      {},
      { value: [...ENGINE, ORG_AUDIT] },
      { value: [forged(ORG_AUDIT.name), ...ENGINE] },
      { value: [...ENGINE, ORG_AUDIT] },
      true,
    )

    expect(value).toContainEqual(ORG_AUDIT)
    expect(value).not.toContainEqual(forged(ORG_AUDIT.name))
  })

  test("a person's rewording of a built-in stays theirs with no peer beneath", () => {
    const { value } = Policy.managedToolsRestored(
      {},
      { value: ENGINE },
      { value: ENGINE.map(tool => ({ ...tool, description: 'Reworded.' })) },
      { value: ENGINE },
      false,
    )

    expect(value?.map(tool => tool.description)).toEqual([
      'Reworded.',
      'Reworded.',
    ])
  })

  test("a person's plain addition stands", () => {
    expect(answeredNames('plain_add')).toContain('plain_add')
  })

  test("a bare name that reads as an organization's server prefix is refused", () => {
    expect(answeredNames('mcp__suite__search2', SEATED)).not.toContain(
      'mcp__suite__search2',
    )
  })

  test("a bare name that reads as an organization's server or plugin is refused in any spelling", () => {
    const servers: Settings = { managedMcpServers: { corp: {} } }

    for (const name of [
      'McpCorpExport',
      'mcpcorpexport',
      'mcp-corp-export',
      'Mcp_Corp_Export',
      'mcp-_corp__export',
    ]) {
      expect(answeredNames(name, servers)).not.toContain(name)
    }

    for (const name of ['McpSuiteDeploy', 'mcp-suite-deploy']) {
      expect(answeredNames(name, SEATED)).not.toContain(name)
    }

    for (const name of ['own_tool', 'CorpExport', 'McpOtherExport']) {
      expect(answeredNames(name, servers)).toContain(name)
    }
  })

  test("an mcp__ name is not read with its words joined, so another server's stays its own", () => {
    const servers: Settings = { managedMcpServers: { corp: {} } }

    expect(Policy.isOrgTool(servers, 'mcp__corp_tools__x')).toBe(false)
    expect(Policy.readsAsOrgTool(servers, 'mcp__corporate__x')).toBe(false)
    expect(Policy.namesOrgTool(servers, 'corporate', 'x')).toBe(false)
  })

  test("a person's look-alike does not pass for what the organization added", () => {
    const { value } = Policy.managedToolsRestored(
      {},
      { value: [...ENGINE, ORG_AUDIT] },
      {
        value: [
          ...ENGINE,
          ORG_AUDIT,
          forged('org-audit'),
          forged('Org_Audit'),
          forged('ORG__AUDIT'),
          forged('OrgAudit'),
          forged('orgaudit'),
          forged('own_tool'),
        ],
      },
      { value: ENGINE },
      false,
    )

    expect(value?.map(tool => tool.name)).toEqual([
      'org_audit',
      'Bash',
      'Read',
      'own_tool',
    ])
  })

  test("a person's look-alike does not pass for what a prepend peer added", () => {
    const { value } = Policy.managedToolsRestored(
      {},
      { value: [...ENGINE, ORG_AUDIT] },
      {
        value: [
          ...ENGINE,
          ORG_AUDIT,
          forged('org-audit'),
          forged('OrgAudit'),
          forged('own_tool'),
        ],
      },
      { value: [...ENGINE, ORG_AUDIT] },
      true,
    )

    expect(value?.map(tool => tool.name)).toEqual([
      'Bash',
      'Read',
      'org_audit',
      'own_tool',
    ])
  })

  test('with no policy to read, the organization listing stands whole', () => {
    const { value } = Policy.managedToolsRestored(
      undefined,
      { value: [BASH, ORG_AUDIT] },
      { value: ENGINE },
      { value: ENGINE },
      false,
    )

    expect(value).toEqual([BASH, ORG_AUDIT])
  })

  test('an entry with no name in a listing leaves the organization listing whole', () => {
    const unread: ToolInfo[] = JSON.parse('[null]')
    const { value } = Policy.managedToolsRestored(
      {},
      { value: [BASH] },
      { value: unread },
      { value: ENGINE },
      false,
    )

    expect(value).toEqual([BASH])
  })

  test('a whole-tool deny holds in a spelling that folds to it, not with content', () => {
    const { value } = Policy.orgRemovalsApplied(
      { permissions: { deny: ['org_audit', 'Bash(rm:*)'] } },
      {
        value: [
          forged('Org-Audit'),
          forged('bash_rm'),
          forged('Bash'),
          forged('other'),
        ],
      },
    )

    expect(value?.map(tool => tool.name)).toEqual(['bash_rm', 'Bash', 'other'])
  })

  test('a whole-tool deny holds in a joined spelling, but not over another MCP tool', () => {
    const { value } = Policy.orgRemovalsApplied(
      { permissions: { deny: ['org_audit', 'mcp__corp_tools__find'] } },
      {
        value: [
          forged('OrgAudit'),
          forged('McpCorpToolsFind'),
          forged('mcp__corp_tools__find'),
          forged('mcp__corp__tools_find'),
        ],
      },
    )

    expect(value?.map(tool => tool.name)).toEqual(['mcp__corp__tools_find'])
  })

  test("a server's deny holds over a bare name that reads as its tool, not another server's", () => {
    const { value } = Policy.orgRemovalsApplied(
      { permissions: { deny: ['mcp__corp__*'] } },
      {
        value: [
          forged('mcp-corp-search'),
          forged('McpCorpSearch'),
          forged('mcp__corp__search'),
          forged('mcp__corp_tools__search'),
          forged('own_tool'),
        ],
      },
    )

    expect(value?.map(tool => tool.name)).toEqual([
      'mcp__corp_tools__search',
      'own_tool',
    ])
  })

  test('a whole-tool deny in managed settings comes off the answer', () => {
    const policy: Settings = {
      permissions: { deny: ['Bash', 'Read(./secret)', 'mcp__corp__*'] },
    }
    const corp = { name: 'mcp__corp__search', description: 'S.', mcp: true }
    const { value } = Policy.managedToolsRestored(
      policy,
      { value: [...ENGINE, corp] },
      { value: [...ENGINE, corp] },
      { value: [...ENGINE, corp] },
      false,
    )

    expect(value?.map(tool => tool.name)).toEqual(['Read'])
  })

  test('org removals read names alone, whatever else an entry holds', () => {
    const malformed: ToolInfo[] = JSON.parse(
      '[{"name":"mcp__late__bad","description":7,"mcp":"yes","inputSchema":"nope"},null,{"description":"no name"}]',
    )
    const { value } = Policy.orgRemovalsApplied(
      { permissions: { deny: ['mcp__late__bad', 'mcp__late__*', 'Bash'] } },
      { value: [...ENGINE, ...malformed] },
    )

    expect(value?.map(tool => tool?.name)).toEqual([
      'Read',
      undefined,
      undefined,
    ])
  })

  test('an option that lets plugins past deny rules leaves the listing', () => {
    const { value } = Policy.orgRemovalsApplied(
      {
        permissions: { deny: ['Bash'] },
        pluginConfigs: {
          'cc-plugin-sec-default@builtin': {
            options: { allowModsToOverrideDenyRules: true },
          },
        },
      },
      { value: ENGINE },
    )

    expect(value).toEqual(ENGINE)
  })

  test('a refused listing passes as it is', () => {
    expect(
      Policy.orgRemovalsApplied(
        { permissions: { deny: ['Bash'] } },
        { deny: 'no' },
      ),
    ).toEqual({ deny: 'no' })
  })
})
