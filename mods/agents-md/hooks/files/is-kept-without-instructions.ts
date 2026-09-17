import type { InstructionFile } from 'claude-code'

import { DROPPED_KINDS } from './dropped-kinds.js'

/**
 * Whether `none` keeps an instruction file: the organization's managed
 * files and the engine's memory stay, the project's and the person's go.
 *
 * @param file the instruction file
 * @returns true for a file `none` leaves in place
 */
export const isKeptWithoutInstructions = (file: InstructionFile): boolean =>
  !DROPPED_KINDS.includes(file.kind)
