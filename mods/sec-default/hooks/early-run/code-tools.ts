/**
 * The tools that run a command or a script, each by the key of its input
 * that holds it. The script tool goes by two names, and the desktop's
 * workspace shell is an MCP tool under a name no other server may take.
 */
export const CODE_TOOLS: ReadonlyMap<string, string> = new Map([
  ['Bash', 'command'],
  ['PowerShell', 'command'],
  ['Monitor', 'command'],
  ['mcp__workspace__bash', 'command'],
  ['REPL', 'code'],
  ['Eval', 'code'],
])
