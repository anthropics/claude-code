/**
 * Shared infrastructure for classifier-based permission systems.
 *
 * This module provides common types, schemas, and utilities used by both:
 * - bashClassifier.ts (semantic Bash command matching)
 * - yoloClassifier.ts (YOLO mode security classification)
 */

import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages.js'
import type { z } from 'zod/v4'

/**
 * Extract tool use block from message content by tool name.
 */
export function extractToolUseBlock(
  content: BetaContentBlock[],
  toolName: string,
): Extract<BetaContentBlock, { type: 'tool_use' }> | null {
  const block = content.find(b => b.type === 'tool_use' && b.name === toolName)
  if (!block || block.type !== 'tool_use') {
    return null
  }
  return block
}

/**
 * Parse and validate classifier response from tool use block.
 * Returns null if parsing fails.
 */
export function parseClassifierResponse<T extends z.ZodTypeAny>(
  toolUseBlock: Extract<BetaContentBlock, { type: 'tool_use' }>,
  schema: T,
): z.infer<T> | null {
  const parseResult = schema.safeParse(toolUseBlock.input)
  if (!parseResult.success) {
    return null
  }
  return parseResult.data
}
