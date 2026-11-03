import type { InstructionFile } from 'claude-code'

/**
 * Whether an instruction file is one of the project's own (checked in or
 * private), as opposed to the organization's, the person's or memory.
 *
 * @param file the instruction file
 * @returns true for a `project` or `local` file
 */
export const isProjectOwn = (file: InstructionFile): boolean =>
  file.kind === 'project' || file.kind === 'local'
