import type { Settings, ToolInfo, ValueOrDeny } from 'claude-code'

import Policy from '../policy'

/**
 * A listing less each tool a person's plugin registered that registerRefusalOf
 * would refuse now, all of them with no policy. Raises overlap: the newest sets
 * `withheld` to their names once, and any other adds until a newer has judged.
 */
export function withoutRefusedTools(
  listing: ValueOrDeny<ToolInfo[]>,
  withheld: { names: Set<string>; begun: number; judged: number },
  place: number,
  policy?: Settings,
  admittedAs: ReadonlyMap<string, string> = new Map(),
): ValueOrDeny<ToolInfo[]> {
  if (!Array.isArray(listing.value)) {
    return listing
  }

  const refused = new Set<string>()

  for (const tool of listing.value) {
    const by = tool?.registeredBy
    // An id need not begin with the name its plugin's tools go under.
    const own = [...admittedAs].find(([, id]) => id === by?.plugin)?.[0]

    if (
      by?.tier === 'user' &&
      (policy === undefined ||
        Policy.hasMcpAllowlist(policy) ||
        Policy.readsAsOrgTool(
          policy,
          Policy.speltName(tool.name, own ?? by.plugin),
          by.plugin,
        ))
    ) {
      refused.add(tool.name)
    }
  }

  if (place >= withheld.judged) {
    const isNew = place === withheld.begun && place > withheld.judged
    withheld.names = new Set([...(isNew ? [] : withheld.names), ...refused])
    withheld.judged = place
  }

  return { value: listing.value.filter(tool => !refused.has(tool?.name)) }
}
