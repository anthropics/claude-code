import type { Settings, ToolInfo, ValueOrDeny } from 'claude-code'

import { hasMcpAllowlist } from '../has-mcp-allowlist'
import { readsAsOrgTool } from '../reads-as-org-tool'
import { isOrgTool } from './is-org-tool'
import { orgRemovalsApplied } from './org-removals-applied'
import { joinedName } from './joined-name'

/**
 * A `tool.list` answer with the managed servers' tools as the organization's
 * tiers listed them, and every other tool as the user tier left it, but for
 * a tool an organization's hook removed, which no user-tier hook puts back,
 * and a tool a user-tier hook added where a `$.tool.register` of the same
 * reach is refused: under an MCP allowlist, or by a name that reads as the
 * organization's or as one its tiers list. A tool an organization's hook added
 * is the organization's too.
 *
 * What the answer lists is the session's tool pool, so no person's hook takes
 * an organization's tool away. A refusal from any listing, a listing that
 * cannot be read, or no policy to read, leaves the organization's listing
 * standing whole. Names are all this reads of an entry.
 *
 * @param policy the managed settings, or undefined when the read failed
 * @param real the listing past the user tier (`next.to(e, "append")`)
 * @param seen the listing through every tier (`next(e)`)
 * @param engine the listing past the plugins' tiers (`next.to(e, "builtin")`)
 * @param hasPeerBeneath a prepend peer's hook ran in the engine's listing, which
 *                       then holds what it added: no name is told for the
 *                       engine's, so each keeps the organization's own entry
 * @returns the merged answer
 */
export function managedToolsRestored(
  policy: Settings | undefined,
  real: ValueOrDeny<ToolInfo[]>,
  seen: ValueOrDeny<ToolInfo[]>,
  engine: ValueOrDeny<ToolInfo[]>,
  hasPeerBeneath: boolean,
): ValueOrDeny<ToolInfo[]> {
  const listed = real.value
  const answered = seen.value
  const engines = engine.value

  if (
    !Array.isArray(listed) ||
    !Array.isArray(answered) ||
    !Array.isArray(engines)
  ) {
    return orgRemovalsApplied(policy, real)
  }

  // A hook's answer is whatever it returned, whatever its type says.
  const isReadable = [...listed, ...answered, ...engines].every(
    tool => typeof tool?.name === 'string',
  )

  if (policy === undefined || !isReadable) {
    return orgRemovalsApplied(policy, real)
  }

  const asListed = new Map(listed.map(tool => [tool.name, tool]))
  const isEngines = new Set(engines.map(tool => tool.name))
  const orgs = new Set(
    listed
      .map(tool => tool.name)
      .filter(name => isOrgTool(policy, name) || !isEngines.has(name)),
  )
  const listedNames = new Set(listed.map(tool => joinedName(tool.name)))
  const refusesAdding = hasMcpAllowlist(policy)

  return orgRemovalsApplied(policy, {
    value: [
      ...listed.filter(tool => orgs.has(tool.name)),
      ...answered
        .filter(
          tool =>
            !orgs.has(tool.name) &&
            !isOrgTool(policy, tool.name) &&
            (isEngines.has(tool.name)
              ? asListed.has(tool.name)
              : !refusesAdding &&
                !readsAsOrgTool(policy, tool.name) &&
                !listedNames.has(joinedName(tool.name))),
        )
        .map(tool => (hasPeerBeneath ? (asListed.get(tool.name) ?? tool) : tool)),
    ],
  })
}
