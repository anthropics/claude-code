import type { Settings, ToolInfo, ValueOrDeny } from 'claude-code'

import { isOrgTool } from './is-org-tool'

/**
 * A `tool.list` answer with the managed servers' tools as the organization's
 * tiers listed them, and every other tool as the user tier left it.
 *
 * A refusal from either listing, or no policy to read, leaves the
 * organization's listing standing whole (fail closed).
 *
 * @param policy the managed settings, or undefined when the read failed
 * @param real the listing past the user tier (`next.to(e, "append")`)
 * @param seen the listing through every tier (`next(e)`)
 * @returns the merged answer
 */
export function managedToolsRestored(
  policy: Settings | undefined,
  real: ValueOrDeny<ToolInfo[]>,
  seen: ValueOrDeny<ToolInfo[]>,
): ValueOrDeny<ToolInfo[]> {
  const isWhole =
    policy === undefined || real.value === undefined || seen.value === undefined

  return isWhole
    ? real
    : {
        value: [
          ...real.value.filter(tool => isOrgTool(policy, tool.name)),
          ...seen.value.filter(tool => !isOrgTool(policy, tool.name)),
        ],
      }
}
