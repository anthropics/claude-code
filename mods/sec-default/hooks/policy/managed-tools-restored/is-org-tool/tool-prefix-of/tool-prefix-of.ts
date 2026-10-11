import { foldedName } from './folded-name'

/**
 * What the folded name of every tool under an MCP server, or of a plugin's
 * own registered tools, begins with: `mcp_<folded name>_`.
 *
 * Compared fold to fold (foldedName), never as written: a name in another
 * case, or with other separators, is the same server to a model.
 *
 * @param name a server's name, or a registering plugin's
 * @returns the folded prefix
 */
export const toolPrefixOf = (name: string) => `mcp_${foldedName(name)}_`
