/**
 * The shell tool whose backslash escapes nothing.
 */
export const POWERSHELL_TOOL = 'PowerShell'

/**
 * The tools that run a line, whose whole input this guard reads, and whose
 * named scripts it reads too.
 */
export const SHELL_TOOLS: readonly string[] = [
  'Bash',
  'Monitor',
  POWERSHELL_TOOL,
]

/**
 * How many names the `shellTools` option adds, and how long each may be. A
 * matcher past the engine's limits is refused, and the guard with it.
 */
export const MOST_NAMED_TOOLS = 64
export const MOST_NAME_CHARS = 128
