import type { Settings } from 'claude-code'

/**
 * The MCP servers managed policy names, as their tools are prefixed
 * (`mcp__<name>__`): allowlist entries with a serverName, and its own.
 *
 * Its own are the servers it delivers (managedMcpServers keys), which need
 * no allowedMcpServers entry.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns one name per named or delivered server; none without either
 */
export function orgServerNames(policy: Settings): string[] {
  const allowlist = policy.allowedMcpServers
  const delivered = policy.managedMcpServers
  const isMap = typeof delivered === 'object' && !Array.isArray(delivered)

  return [
    ...(Array.isArray(allowlist) ? allowlist : []).flatMap((entry: unknown) => {
      const isEntry =
        typeof entry === 'object' && entry !== null && 'serverName' in entry

      const name = isEntry ? entry.serverName : undefined
      const isNamed = typeof name === 'string' && name !== ''

      return isNamed ? [name] : []
    }),
    ...Object.keys(isMap ? (delivered ?? {}) : {}),
  ]
}
