import type { InstructionFile } from 'claude-code'

/**
 * An instruction file as a Read attaches it, framed as the engine frames a
 * nested CLAUDE.md: the text as loaded, trailing newline and all.
 *
 * @param file the file
 * @returns the `Contents of <path>` frame over its text
 */
export const nestedFrame = (file: InstructionFile): string =>
  `Contents of ${file.path}:\n\n${file.content}`
