import { joinedName } from './joined-name'

/**
 * Whether a bare name, one not written `mcp__`, reads as a tool under an MCP
 * prefix: a model reads `McpCorpExport` and `mcp-corp-export` as
 * `mcp__corp__export`, and a hook can write any of them. An `mcp__` name is never
 * compared this way, because joined `mcp__corp_tools__x` would pass for a tool of
 * `corp`, and it is another server's.
 *
 * @param name the name as written
 * @param prefix the prefix, in any spelling
 * @returns true when the name reads as under the prefix
 */
export function bareNameReadsUnder(name: string, prefix: string): boolean {
  return (
    !name.startsWith('mcp__') &&
    joinedName(name).startsWith(joinedName(prefix))
  )
}
