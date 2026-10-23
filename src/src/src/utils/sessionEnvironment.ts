import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { getSessionId } from '../bootstrap/state.js'
import { logForDebugging } from './debug.js'
import { getClaudeConfigHomeDir } from './envUtils.js'
import { errorMessage, getErrnoCode } from './errors.js'
import { getPlatform } from './platform.js'

// Cache states:
// undefined = not yet loaded (need to check disk)
// null = checked disk, no files exist (don't check again)
// string = loaded and cached (use cached value)
let sessionEnvScript: string | null | undefined = undefined

export async function getSessionEnvDirPath(): Promise<string> {
  const sessionEnvDir = join(
    getClaudeConfigHomeDir(),
    'session-env',
    getSessionId(),
  )
  await mkdir(sessionEnvDir, { recursive: true })
  return sessionEnvDir
}

export async function getHookEnvFilePath(
  hookEvent: 'Setup' | 'SessionStart' | 'CwdChanged' | 'FileChanged',
  hookIndex: number,
): Promise<string> {
  const prefix = hookEvent.toLowerCase()
  return join(await getSessionEnvDirPath(), `${prefix}-hook-${hookIndex}.sh`)
}

export async function clearCwdEnvFiles(): Promise<void> {
  try {
    const dir = await getSessionEnvDirPath()
    const files = await readdir(dir)
    await Promise.all(
      files
        .filter(
          f =>
            (f.startsWith('filechanged-hook-') ||
              f.startsWith('cwdchanged-hook-')) &&
            HOOK_ENV_REGEX.test(f),
        )
        .map(f => writeFile(join(dir, f), '')),
    )
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code !== 'ENOENT') {
      logForDebugging(`Failed to clear cwd env files: ${errorMessage(e)}`)
    }
  }
}

export function invalidateSessionEnvCache(): void {
  logForDebugging('Invalidating session environment cache')
  sessionEnvScript = undefined
}

export async function getSessionEnvironmentScript(): Promise<string | null> {
  if (getPlatform() === 'windows') {
    logForDebugging('Session environment not yet supported on Windows')
    return null
  }

  if (sessionEnvScript !== undefined) {
    return sessionEnvScript
  }

  const scripts: string[] = []

  // Check for CLAUDE_ENV_FILE passed from parent process (e.g., HFI trajectory runner)
  // This allows venv/conda activation to persist across shell commands
  const envFile = process.env.CLAUDE_ENV_FILE
  if (envFile) {
    try {
      const envScript = (await readFile(envFile, 'utf8')).trim()
      if (envScript) {
        scripts.push(envScript)
        logForDebugging(
          `Session environment loaded from CLAUDE_ENV_FILE: ${envFile} (${envScript.length} chars)`,
        )
      }
    } catch (e: unknown) {
      const code = getErrnoCode(e)
      if (code !== 'ENOENT') {
        logForDebugging(`Failed to read CLAUDE_ENV_FILE: ${errorMessage(e)}`)
      }
    }
  }

  // Load hook environment files from session directory
  const sessionEnvDir = await getSessionEnvDirPath()
  try {
    const files = await readdir(sessionEnvDir)
    // We are sorting the hook env files by the order in which they are listed
    // in the settings.json file so that the resulting env is deterministic
    const hookFiles = files
      .filter(f => HOOK_ENV_REGEX.test(f))
      .sort(sortHookEnvFiles)

    for (const file of hookFiles) {
      const filePath = join(sessionEnvDir, file)
      try {
        const content = (await readFile(filePath, 'utf8')).trim()
        if (content) {
          scripts.push(content)
        }
      } catch (e: unknown) {
        const code = getErrnoCode(e)
        if (code !== 'ENOENT') {
          logForDebugging(
            `Failed to read hook file ${filePath}: ${errorMessage(e)}`,
          )
        }
      }
    }

    if (hookFiles.length > 0) {
      logForDebugging(
        `Session environment loaded from ${hookFiles.length} hook file(s)`,
      )
    }
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code !== 'ENOENT') {
      logForDebugging(
        `Failed to load session environment from hooks: ${errorMessage(e)}`,
      )
    }
  }

  if (scripts.length === 0) {
    logForDebugging('No session environment scripts found')
    sessionEnvScript = null
    return sessionEnvScript
  }

  sessionEnvScript = scripts.join('\n')
  logForDebugging(
    `Session environment script ready (${sessionEnvScript.length} chars total)`,
  )
  return sessionEnvScript
}

const HOOK_ENV_PRIORITY: Record<string, number> = {
  setup: 0,
  sessionstart: 1,
  cwdchanged: 2,
  filechanged: 3,
}
const HOOK_ENV_REGEX =
  /^(setup|sessionstart|cwdchanged|filechanged)-hook-(\d+)\.sh$/

function sortHookEnvFiles(a: string, b: string): number {
  const aMatch = a.match(HOOK_ENV_REGEX)
  const bMatch = b.match(HOOK_ENV_REGEX)
  const aType = aMatch?.[1] || ''
  const bType = bMatch?.[1] || ''
  if (aType !== bType) {
    return (HOOK_ENV_PRIORITY[aType] ?? 99) - (HOOK_ENV_PRIORITY[bType] ?? 99)
  }
  const aIndex = parseInt(aMatch?.[2] || '0', 10)
  const bIndex = parseInt(bMatch?.[2] || '0', 10)
  return aIndex - bIndex
}
