import { logForDebugging } from './debug.js'
import { which } from './which.js'

// Session cache to avoid repeated checks
const binaryCache = new Map<string, boolean>()

/**
 * Check if a binary/command is installed and available on the system.
 * Uses 'which' on Unix systems (macOS, Linux, WSL) and 'where' on Windows.
 *
 * @param command - The command name to check (e.g., 'gopls', 'rust-analyzer')
 * @returns Promise<boolean> - true if the command exists, false otherwise
 */
export async function isBinaryInstalled(command: string): Promise<boolean> {
  // Edge case: empty or whitespace-only command
  if (!command || !command.trim()) {
    logForDebugging('[binaryCheck] Empty command provided, returning false')
    return false
  }

  // Trim the command to handle whitespace
  const trimmedCommand = command.trim()

  // Check cache first
  const cached = binaryCache.get(trimmedCommand)
  if (cached !== undefined) {
    logForDebugging(
      `[binaryCheck] Cache hit for '${trimmedCommand}': ${cached}`,
    )
    return cached
  }

  let exists = false
  if (await which(trimmedCommand).catch(() => null)) {
    exists = true
  }

  // Cache the result
  binaryCache.set(trimmedCommand, exists)

  logForDebugging(
    `[binaryCheck] Binary '${trimmedCommand}' ${exists ? 'found' : 'not found'}`,
  )

  return exists
}

/**
 * Clear the binary check cache (useful for testing)
 */
export function clearBinaryCache(): void {
  binaryCache.clear()
}
