import { appendFile, mkdir, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { getCwd } from '../cwd.js'
import { getErrnoCode } from '../errors.js'
import { execFileNoThrowWithCwd } from '../execFileNoThrow.js'
import { dirIsInGitRepo } from '../git.js'
import { logError } from '../log.js'

/**
 * Checks if a path is ignored by git (via `git check-ignore`).
 *
 * This consults all applicable gitignore sources: repo `.gitignore` files
 * (nested), `.git/info/exclude`, and the global gitignore — with correct
 * precedence, because git itself resolves it.
 *
 * Exit codes: 0 = ignored, 1 = not ignored, 128 = not in a git repo.
 * Returns `false` for 128, so callers outside a git repo fail open.
 *
 * @param filePath The path to check (absolute or relative to cwd)
 * @param cwd The working directory to run git from
 */
export async function isPathGitignored(
  filePath: string,
  cwd: string,
): Promise<boolean> {
  const { code } = await execFileNoThrowWithCwd(
    'git',
    ['check-ignore', filePath],
    {
      preserveOutputOnError: false,
      cwd,
    },
  )

  return code === 0
}

/**
 * Gets the path to the global gitignore file (.config/git/ignore)
 * @returns The path to the global gitignore file
 */
export function getGlobalGitignorePath(): string {
  return join(homedir(), '.config', 'git', 'ignore')
}

/**
 * Adds a file pattern to the global gitignore file (.config/git/ignore)
 * if it's not already ignored by existing patterns in any gitignore file
 * @param filename The filename to add to gitignore
 * @param cwd The current working directory (optional)
 */
export async function addFileGlobRuleToGitignore(
  filename: string,
  cwd: string = getCwd(),
): Promise<void> {
  try {
    if (!(await dirIsInGitRepo(cwd))) {
      return
    }

    // First check if the pattern is already ignored by any gitignore file (including global)
    const gitignoreEntry = `**/${filename}`
    // For directory patterns (ending with /), check with a sample file inside
    const testPath = filename.endsWith('/')
      ? `${filename}sample-file.txt`
      : filename
    if (await isPathGitignored(testPath, cwd)) {
      // File is already ignored by existing patterns (local or global)
      return
    }

    // Use the global gitignore file in .config/git/ignore
    const globalGitignorePath = getGlobalGitignorePath()

    // Create the directory if it doesn't exist
    const configGitDir = dirname(globalGitignorePath)
    await mkdir(configGitDir, { recursive: true })

    // Add the entry to the global gitignore
    try {
      const content = await readFile(globalGitignorePath, { encoding: 'utf-8' })
      if (content.includes(gitignoreEntry)) {
        return // Pattern already exists, don't add again
      }
      await appendFile(globalGitignorePath, `\n${gitignoreEntry}\n`)
    } catch (e: unknown) {
      const code = getErrnoCode(e)
      if (code === 'ENOENT') {
        // Create global gitignore with entry
        await writeFile(globalGitignorePath, `${gitignoreEntry}\n`, 'utf-8')
      } else {
        throw e
      }
    }
  } catch (error) {
    logError(error)
  }
}
