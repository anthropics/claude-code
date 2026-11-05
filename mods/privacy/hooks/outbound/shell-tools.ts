/**
 * The tools that run a line, the only calls this guard reads.
 */
export const SHELL_TOOLS: readonly string[] = ['Bash', 'Monitor', 'PowerShell']

/**
 * Where a host adds a shell tool of its own, once, before the plugin registers
 * (register.ts reads it there). Empty as shipped.
 */
// module-state-allow: module-evaluation code wiring — a compiling host adds a constant tool name once before registration and never removes it
export const INSTALLED_SHELL_TOOLS = new Set<string>()
