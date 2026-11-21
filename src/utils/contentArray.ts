/**
 * Utility for inserting a block into a content array relative to tool_result
 * blocks. Used by the API layer to position supplementary content (e.g.,
 * cache editing directives) correctly within user messages.
 *
 * Placement rules:
 * - If tool_result blocks exist: insert after the last one
 * - Otherwise: insert before the last block
 * - If the inserted block would be the final element, a text continuation
 *   block is appended (some APIs require the prompt not to end with
 *   non-text content)
 */

/**
 * Inserts a block into the content array after the last tool_result block.
 * Mutates the array in place.
 *
 * @param content - The content array to modify
 * @param block - The block to insert
 */
export function insertBlockAfterToolResults(
  content: unknown[],
  block: unknown,
): void {
  // Find position after the last tool_result block
  let lastToolResultIndex = -1
  for (let i = 0; i < content.length; i++) {
    const item = content[i]
    if (
      item &&
      typeof item === 'object' &&
      'type' in item &&
      (item as { type: string }).type === 'tool_result'
    ) {
      lastToolResultIndex = i
    }
  }

  if (lastToolResultIndex >= 0) {
    const insertPos = lastToolResultIndex + 1
    content.splice(insertPos, 0, block)
    // Append a text continuation if the inserted block is now last
    if (insertPos === content.length - 1) {
      content.push({ type: 'text', text: '.' })
    }
  } else {
    // No tool_result blocks — insert before the last block
    const insertIndex = Math.max(0, content.length - 1)
    content.splice(insertIndex, 0, block)
  }
}
