import { createHash } from 'crypto'
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { logForDebugging } from './debug.js'
import { getClaudeConfigHomeDir } from './envUtils.js'
import { isENOENT } from './errors.js'

const PASTE_STORE_DIR = 'paste-cache'

/**
 * Get the paste store directory (persistent across sessions).
 */
function getPasteStoreDir(): string {
  return join(getClaudeConfigHomeDir(), PASTE_STORE_DIR)
}

/**
 * Generate a hash for paste content to use as filename.
 * Exported so callers can get the hash synchronously before async storage.
 */
export function hashPastedText(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/**
 * Get the file path for a paste by its content hash.
 */
function getPastePath(hash: string): string {
  return join(getPasteStoreDir(), `${hash}.txt`)
}

/**
 * Store pasted text content to disk.
 * The hash should be pre-computed with hashPastedText() so the caller
 * can use it immediately without waiting for the async disk write.
 */
export async function storePastedText(
  hash: string,
  content: string,
): Promise<void> {
  try {
    const dir = getPasteStoreDir()
    await mkdir(dir, { recursive: true })

    const pastePath = getPastePath(hash)

    // Content-addressable: same hash = same content, so overwriting is safe
    await writeFile(pastePath, content, { encoding: 'utf8', mode: 0o600 })
    logForDebugging(`Stored paste ${hash} to ${pastePath}`)
  } catch (error) {
    logForDebugging(`Failed to store paste: ${error}`)
  }
}

/**
 * Retrieve pasted text content by its hash.
 * Returns null if not found or on error.
 */
export async function retrievePastedText(hash: string): Promise<string | null> {
  try {
    const pastePath = getPastePath(hash)
    return await readFile(pastePath, { encoding: 'utf8' })
  } catch (error) {
    // ENOENT is expected when paste doesn't exist
    if (!isENOENT(error)) {
      logForDebugging(`Failed to retrieve paste ${hash}: ${error}`)
    }
    return null
  }
}

/**
 * Clean up old paste files that are no longer referenced.
 * This is a simple time-based cleanup - removes files older than cutoffDate.
 */
export async function cleanupOldPastes(cutoffDate: Date): Promise<void> {
  const pasteDir = getPasteStoreDir()

  let files
  try {
    files = await readdir(pasteDir)
  } catch {
    // Directory doesn't exist or can't be read - nothing to clean up
    return
  }

  const cutoffTime = cutoffDate.getTime()
  for (const file of files) {
    if (!file.endsWith('.txt')) {
      continue
    }

    const filePath = join(pasteDir, file)
    try {
      const stats = await stat(filePath)
      if (stats.mtimeMs < cutoffTime) {
        await unlink(filePath)
        logForDebugging(`Cleaned up old paste: ${filePath}`)
      }
    } catch {
      // Ignore errors for individual files
    }
  }
}
