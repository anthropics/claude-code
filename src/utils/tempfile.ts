import { createHash, randomUUID } from 'crypto'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Generate a temporary file path.
 *
 * @param prefix Optional prefix for the temp file name
 * @param extension Optional file extension (defaults to '.md')
 * @param options.contentHash When provided, the identifier is derived from a
 *   SHA-256 hash of this string (first 16 hex chars). This produces a path
 *   that is stable across process boundaries — any process with the same
 *   content will get the same path. Use this when the path ends up in content
 *   sent to the Anthropic API (e.g., sandbox deny lists in tool descriptions),
 *   because a random UUID would change on every subprocess spawn and
 *   invalidate the prompt cache prefix.
 * @returns Temp file path
 */
export function generateTempFilePath(
  prefix: string = 'claude-prompt',
  extension: string = '.md',
  options?: { contentHash?: string },
): string {
  const id = options?.contentHash
    ? createHash('sha256')
        .update(options.contentHash)
        .digest('hex')
        .slice(0, 16)
    : randomUUID()
  return join(tmpdir(), `${prefix}-${id}${extension}`)
}
