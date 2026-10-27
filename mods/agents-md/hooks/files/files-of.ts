import type { FsAncestor, InstructionFile } from 'claude-code'

/**
 * The found AGENTS.md files as project instruction files, one per file and
 * per file it `@`-imported, in walk and load order.
 *
 * An import names the file that brought it as its parent.
 *
 * @param found what `$.fs.ancestors` found, root first
 * @returns the instruction files, kind `project`
 */
export const filesOf = (found: readonly FsAncestor[]): InstructionFile[] =>
  found.flatMap(entry =>
    entry.parts.map((part, index) => ({
      path: part.path,
      kind: 'project' as const,
      content: part.content,
      ...(index > 0 && { parent: entry.parts[0]?.path ?? part.path }),
    })),
  )
