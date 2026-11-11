import type { Settings, ToolInfo, ValueOrDeny } from 'claude-code'

import { denyRulesHold } from '../deny-rules-hold'
import { bareNameReadsUnder } from './bare-name-reads-under'
import { joinedName } from './joined-name'
import { memberOf } from '../own-option/member-of'

/**
 * A listing without what the organization's own settings remove, whatever put
 * it there: a managed deny rule that is a tool's name, or names its MCP server
 * (`mcp__<server>`, `mcp__<server>__*`). An `mcp__` name is a real tool's, told by
 * the name whole, so another server's name that only begins like it is not taken
 * for it. Any other name a hook can write, so one that reads as a denied name
 * goes too. A rule with content (`Bash(rm:*)`) leaves the tool in. Reads names
 * alone, and leaves an entry with no name for the engine to refuse, so that no
 * tool's definition can keep a removal from holding.
 *
 * @param policy the managed settings, or undefined when the read failed
 * @param listing the listing
 * @returns the listing without them; the listing itself when it holds no list
 */
export function orgRemovalsApplied(
  policy: Settings | undefined,
  listing: ValueOrDeny<ToolInfo[]>,
): ValueOrDeny<ToolInfo[]> {
  const denied: unknown =
    policy === undefined
      ? undefined
      : ['permissions', 'deny'].reduce<unknown>(memberOf, policy)
  const rules = Array.isArray(denied)
    ? denied.filter((rule): rule is string => typeof rule === 'string')
    : []
  const wholeTools = rules
    .filter(rule => !rule.includes('('))
    .map(joinedName)
  const serverPrefixes = rules
    .map(rule => (rule.endsWith('__*') ? rule.slice(0, -3) : rule))
    .filter(
      server =>
        server.startsWith('mcp__') &&
        !server.slice('mcp__'.length).includes('__'),
    )
    .map(server => `${server}__`)

  return policy === undefined ||
    rules.length === 0 ||
    !denyRulesHold(policy) ||
    !Array.isArray(listing.value)
    ? listing
    : {
        value: listing.value.filter(tool => {
          const name: unknown = tool?.name

          return (
            typeof name !== 'string' ||
            !(name.startsWith('mcp__')
              ? rules.includes(name) ||
                serverPrefixes.some(prefix => name.startsWith(prefix))
              : wholeTools.includes(joinedName(name)) ||
                serverPrefixes.some(prefix => bareNameReadsUnder(name, prefix)))
          )
        }),
      }
}
