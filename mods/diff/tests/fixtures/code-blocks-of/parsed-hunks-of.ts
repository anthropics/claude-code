import type Views from '../../../hooks/views'
import { hunksOf } from './hunks-of.js'
import type { ParsedHunk } from './parsed-hunk.js'

/**
 * Every hunk a body's `Code` blocks hold, in drawing order.
 *
 * @param body the file's body as `codeBlocksOf` cut it
 * @returns the hunks read back out of each block's source
 */
export const parsedHunksOf = (body: Views.CodeBody): ParsedHunk[] =>
  body.blocks.flatMap(block => hunksOf(block.source))
