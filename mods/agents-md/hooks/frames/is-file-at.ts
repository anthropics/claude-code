import type { InstructionFile } from 'claude-code'

import { normalSpellingOf } from './normal-spelling-of.js'

/**
 * Whether an instruction file is the file at a path, however either is
 * spelled.
 *
 * @param file the instruction file
 * @param path an absolute path
 * @returns true when both name one path
 */
export const isFileAt = (file: InstructionFile, path: string): boolean =>
  normalSpellingOf(file.path) === normalSpellingOf(path)
