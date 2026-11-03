import type { InstructionFile } from 'claude-code'

import Frames from '../frames'
import { chainRootOf } from './chain-root-of.js'
import { isProjectOwn } from './is-project-own.js'
import { projectDirOf } from './project-dir-of.js'

/**
 * Where a directory's AGENTS.md files go among the files the engine loaded,
 * as the engine orders project files root first.
 *
 * Before the first project file of a deeper directory (an imported file
 * counts with the file at the head of its chain), else after the last
 * project file, else before the engine's memory, else at the end.
 *
 * @param files the list so far
 * @param dir the directory the AGENTS.md files stand in
 * @returns the index to insert at
 */
export function insertionIndex(
  files: readonly InstructionFile[],
  dir: string,
): number {
  const byPath = new Map(files.map(file => [file.path, file]))
  const deeper = files.findIndex(
    file =>
      isProjectOwn(file) &&
      Frames.isBelow(projectDirOf(chainRootOf(file, byPath)), dir),
  )

  if (deeper !== -1) {
    return deeper
  }

  const lastOwn = files.findLastIndex(isProjectOwn)

  if (lastOwn !== -1) {
    return lastOwn + 1
  }

  const memory = files.findIndex(file => file.kind === 'memory')

  return memory === -1 ? files.length : memory
}
