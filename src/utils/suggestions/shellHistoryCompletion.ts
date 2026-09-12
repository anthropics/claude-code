import { getHistory } from '../../history.js'
import { logForDebugging } from '../debug.js'

/**
 * Result of shell history completion lookup
 */
export type ShellHistoryMatch = {
  /** The full command from history */
  fullCommand: string
  /** The suffix to display as ghost text (the part after user's input) */
  suffix: string
}

// Cache for shell history commands to avoid repeated async reads
// History only changes when user submits a command, so a long TTL is fine
let shellHistoryCache: string[] | null = null
let shellHistoryCacheTimestamp = 0
const CACHE_TTL_MS = 60000 // 60 seconds - history won't change while typing

/**
 * Get shell commands from history, with caching
 */
async function getShellHistoryCommands(): Promise<string[]> {
  const now = Date.now()

  // Return cached result if still fresh
  if (shellHistoryCache && now - shellHistoryCacheTimestamp < CACHE_TTL_MS) {
    return shellHistoryCache
  }

  const commands: string[] = []
  const seen = new Set<string>()

  try {
    // Read history entries and filter for bash commands
    for await (const entry of getHistory()) {
      if (entry.display && entry.display.startsWith('!')) {
        // Remove the '!' prefix to get the actual command
        const command = entry.display.slice(1).trim()
        if (command && !seen.has(command)) {
          seen.add(command)
          commands.push(command)
        }
      }
      // Limit to 50 most recent unique commands
      if (commands.length >= 50) {
        break
      }
    }
  } catch (error) {
    logForDebugging(`Failed to read shell history: ${error}`)
  }

  shellHistoryCache = commands
  shellHistoryCacheTimestamp = now
  return commands
}

/**
 * Clear the shell history cache (useful when history is updated)
 */
export function clearShellHistoryCache(): void {
  shellHistoryCache = null
  shellHistoryCacheTimestamp = 0
}

/**
 * Add a command to the front of the shell history cache without
 * flushing the entire cache.  If the command already exists in the
 * cache it is moved to the front (deduped).  When the cache hasn't
 * been populated yet this is a no-op – the next lookup will read
 * the full history which already includes the new command.
 */
export function prependToShellHistoryCache(command: string): void {
  if (!shellHistoryCache) {
    return
  }
  const idx = shellHistoryCache.indexOf(command)
  if (idx !== -1) {
    shellHistoryCache.splice(idx, 1)
  }
  shellHistoryCache.unshift(command)
}

/**
 * Find the best matching shell command from history for the given input
 *
 * @param input The current user input (without '!' prefix)
 * @returns The best match, or null if no match found
 */
export async function getShellHistoryCompletion(
  input: string,
): Promise<ShellHistoryMatch | null> {
  // Don't suggest for empty or very short input
  if (!input || input.length < 2) {
    return null
  }

  // Check the trimmed input to make sure there's actual content
  const trimmedInput = input.trim()
  if (!trimmedInput) {
    return null
  }

  const commands = await getShellHistoryCommands()

  // Find the first command that starts with the EXACT input (including spaces)
  // This ensures "ls " matches "ls -lah" but "ls  " (2 spaces) does not
  for (const command of commands) {
    if (command.startsWith(input) && command !== input) {
      return {
        fullCommand: command,
        suffix: command.slice(input.length),
      }
    }
  }

  return null
}
