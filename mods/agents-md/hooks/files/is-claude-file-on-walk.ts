import type { InstructionFile } from 'claude-code'

import Frames from '../frames'
import Names from '../names'
import { isProjectOwn } from './is-project-own.js'
import { projectDirOf } from './project-dir-of.js'

/**
 * Whether a handed instruction file is a CLAUDE.md, `.claude/CLAUDE.md` or
 * CLAUDE.local.md of a directory on the walk down to the session's root.
 *
 * What makes a project "have a CLAUDE.md of its own" for
 * `claude-md-or-agents-md`, the same files the Read walk asks for; a rules
 * file, an imported file or an added directory's CLAUDE.md is not one.
 *
 * @param file the handed instruction file
 * @param root the session's project root, absolute
 * @returns true for the project's own CLAUDE.md files on the walk
 */
export function isClaudeFileOnWalk(
  file: InstructionFile,
  root: string,
): boolean {
  const isOwnClaudeFile =
    isProjectOwn(file) &&
    file.parent === undefined &&
    Names.CLAUDE_NAMES.some(name =>
      Frames.normalSpellingOf(file.path).endsWith(`/${name}`),
    )

  if (!isOwnClaudeFile) {
    return false
  }

  const dir = projectDirOf(file.path)
  const spelledRoot = Frames.normalSpellingOf(root)

  return dir === spelledRoot || Frames.isBelow(spelledRoot, dir)
}
