import type { InstructionFile } from 'claude-code'

import { chainRootOf } from './chain-root-of.js'
import { insertionIndex } from './insertion-index.js'
import { projectDirOf } from './project-dir-of.js'

/**
 * The engine's instruction files with the AGENTS.md files placed where the
 * engine would place a project file of their directory; as is when none.
 *
 * @param handed the files the engine handed the hook, in its order
 * @param added the AGENTS.md instruction files to add, root first
 * @returns the merged list
 */
export function withProjectFiles(
  handed: readonly InstructionFile[],
  added: readonly InstructionFile[],
): readonly InstructionFile[] {
  if (added.length === 0) {
    return handed
  }

  const merged = [...handed]
  const byPath = new Map(added.map(file => [file.path, file]))
  const byDir = new Map<string, InstructionFile[]>()

  for (const file of added) {
    const dir = projectDirOf(chainRootOf(file, byPath))
    byDir.set(dir, [...(byDir.get(dir) ?? []), file])
  }

  for (const [dir, files] of byDir) {
    merged.splice(insertionIndex(merged, dir), 0, ...files)
  }

  return merged
}
