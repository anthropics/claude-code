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
 * The shell tools whose whole input this guard searches for named scripts.
 */
// module-state-allow: a process constant — seeded here, and no shipped code adds or removes a name
export const INSTALLED_SHELL_TOOLS = new Set<string>(['Tmux'])
