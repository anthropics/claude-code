import type { InstructionFile } from 'claude-code'

import Frames from '../frames'
import { isProjectOwn } from './is-project-own.js'

/**
 * The candidate files the engine has not already loaded, and no candidate
 * twice.
 *
 * Leaves out one whose path is among the handed files (a CLAUDE.md that
 * `@`-imports AGENTS.md) or whose text equals a handed project file's (a
 * CLAUDE.md symlinked to AGENTS.md); other kinds' text does not count.
 *
 * @param candidates the AGENTS.md instruction files of a walk
 * @param handed the files the engine handed the hook
 * @returns the candidates worth adding, in order
 */
export function unseenFiles(
  candidates: readonly InstructionFile[],
  handed: readonly InstructionFile[],
): InstructionFile[] {
  const paths = new Set(handed.map(file => Frames.normalSpellingOf(file.path)))
  const texts = new Set(
    handed.filter(isProjectOwn).map(file => file.content.trim()),
  )
  const kept: InstructionFile[] = []

  for (const file of candidates) {
    const path = Frames.normalSpellingOf(file.path)
    const text = file.content.trim()
    const isSeen = paths.has(path) || (text !== '' && texts.has(text))

    if (!isSeen) {
      paths.add(path)
      kept.push(file)
    }
  }

  return kept
}
