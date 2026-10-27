import type { InstructionFile } from 'claude-code'

/**
 * The path of the file at the head of an instruction file's `@`-import
 * chain; the file's own path when nothing imported it.
 *
 * Follows `parent` among the given files until a file nothing imported.
 *
 * @param file the instruction file
 * @param byPath the files it may have come through, by path
 * @returns the chain head's path
 */
export function chainRootOf(
  file: InstructionFile,
  byPath: ReadonlyMap<string, InstructionFile>,
): string {
  const seen = new Set<string>([file.path])
  let path = file.path
  let parent = file.parent

  while (parent !== undefined && !seen.has(parent)) {
    seen.add(parent)
    path = parent
    parent = byPath.get(parent)?.parent
  }

  return path
}
