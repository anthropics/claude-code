import type { FsAncestor } from 'claude-code'

/**
 * The AGENTS.md files standing in a directory with no CLAUDE.md of its own,
 * in walk order.
 *
 * Where the engine attaches a directory's CLAUDE.md, that directory's
 * AGENTS.md is left out rather than merged.
 *
 * @param agents the AGENTS.md files of a walk, root first
 * @param claude the CLAUDE.md files of the same walk
 * @returns the AGENTS.md files whose directory holds no CLAUDE.md
 */
export function outsideClaudeDirs(
  agents: readonly FsAncestor[],
  claude: readonly FsAncestor[],
): readonly FsAncestor[] {
  const taken = new Set(claude.map(file => file.dir))

  return agents.filter(file => !taken.has(file.dir))
}
