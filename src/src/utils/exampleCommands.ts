import memoize from 'lodash-es/memoize.js'
import sample from 'lodash-es/sample.js'
import { getCwd } from '../utils/cwd.js'
import { getCurrentProjectConfig, saveCurrentProjectConfig } from './config.js'
import { env } from './env.js'
import { execFileNoThrowWithCwd } from './execFileNoThrow.js'
import { getIsGit, gitExe } from './git.js'
import { logError } from './log.js'
import { getGitEmail } from './user.js'

// Patterns that mark a file as non-core (auto-generated, dependency, or config).
// Used to filter example-command filename suggestions deterministically
// instead of shelling out to Haiku.
const NON_CORE_PATTERNS = [
  // lock / dependency manifests
  /(?:^|\/)(?:package-lock\.json|yarn\.lock|bun\.lock|bun\.lockb|pnpm-lock\.yaml|Pipfile\.lock|poetry\.lock|Cargo\.lock|Gemfile\.lock|go\.sum|composer\.lock|uv\.lock)$/,
  // generated / build artifacts
  /\.generated\./,
  /(?:^|\/)(?:dist|build|out|target|node_modules|\.next|__pycache__)\//,
  /\.(?:min\.js|min\.css|map|pyc|pyo)$/,
  // data / docs / config extensions (not "write a test for" material)
  /\.(?:json|ya?ml|toml|xml|ini|cfg|conf|env|lock|txt|md|mdx|rst|csv|log|svg)$/i,
  // configuration / metadata
  /(?:^|\/)\.?(?:eslintrc|prettierrc|babelrc|editorconfig|gitignore|gitattributes|dockerignore|npmrc)/,
  /(?:^|\/)(?:tsconfig|jsconfig|biome|vitest\.config|jest\.config|webpack\.config|vite\.config|rollup\.config)\.[a-z]+$/,
  /(?:^|\/)\.(?:github|vscode|idea|claude)\//,
  // docs / changelogs (not "how does X work" material)
  /(?:^|\/)(?:CHANGELOG|LICENSE|CONTRIBUTING|CODEOWNERS|README)(?:\.[a-z]+)?$/i,
]

function isCoreFile(path: string): boolean {
  return !NON_CORE_PATTERNS.some(p => p.test(path))
}

/**
 * Counts occurrences of items in an array and returns the top N items
 * sorted by count in descending order, formatted as a string.
 */
export function countAndSortItems(items: string[], topN: number = 20): string {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([item, count]) => `${count.toString().padStart(6)} ${item}`)
    .join('\n')
}

/**
 * Picks up to `want` basenames from a frequency-sorted list of paths,
 * skipping non-core files and spreading across different directories.
 * Returns empty array if fewer than `want` core files are available.
 */
export function pickDiverseCoreFiles(
  sortedPaths: string[],
  want: number,
): string[] {
  const picked: string[] = []
  const seenBasenames = new Set<string>()
  const dirTally = new Map<string, number>()

  // Greedy: on each pass allow +1 file per directory. Keeps the
  // top-5 from collapsing into a single hot folder while still
  // letting a dominant folder contribute multiple files if the
  // repo is narrow.
  for (let cap = 1; picked.length < want && cap <= want; cap++) {
    for (const p of sortedPaths) {
      if (picked.length >= want) break
      if (!isCoreFile(p)) continue
      const lastSep = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
      const base = lastSep >= 0 ? p.slice(lastSep + 1) : p
      if (!base || seenBasenames.has(base)) continue
      const dir = lastSep >= 0 ? p.slice(0, lastSep) : '.'
      if ((dirTally.get(dir) ?? 0) >= cap) continue
      picked.push(base)
      seenBasenames.add(base)
      dirTally.set(dir, (dirTally.get(dir) ?? 0) + 1)
    }
  }

  return picked.length >= want ? picked : []
}

async function getFrequentlyModifiedFiles(): Promise<string[]> {
  if (process.env.NODE_ENV === 'test') return []
  if (env.platform === 'win32') return []
  if (!(await getIsGit())) return []

  try {
    // Collect frequently-modified files, preferring the user's own commits.
    const userEmail = await getGitEmail()

    const logArgs = [
      'log',
      '-n',
      '1000',
      '--pretty=format:',
      '--name-only',
      '--diff-filter=M',
    ]

    const counts = new Map<string, number>()
    const tallyInto = (stdout: string) => {
      for (const line of stdout.split('\n')) {
        const f = line.trim()
        if (f) counts.set(f, (counts.get(f) ?? 0) + 1)
      }
    }

    if (userEmail) {
      const { stdout } = await execFileNoThrowWithCwd(
        'git',
        [...logArgs, `--author=${userEmail}`],
        { cwd: getCwd() },
      )
      tallyInto(stdout)
    }

    // Fall back to all authors if the user's own history is thin.
    if (counts.size < 10) {
      const { stdout } = await execFileNoThrowWithCwd(gitExe(), logArgs, {
        cwd: getCwd(),
      })
      tallyInto(stdout)
    }

    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p)

    return pickDiverseCoreFiles(sorted, 5)
  } catch (err) {
    logError(err as Error)
    return []
  }
}

const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000

export const getExampleCommandFromCache = memoize(() => {
  const projectConfig = getCurrentProjectConfig()
  const frequentFile = projectConfig.exampleFiles?.length
    ? sample(projectConfig.exampleFiles)
    : '<filepath>'

  const commands = [
    'fix lint errors',
    'fix typecheck errors',
    `how does ${frequentFile} work?`,
    `refactor ${frequentFile}`,
    'how do I log an error?',
    `edit ${frequentFile} to...`,
    `write a test for ${frequentFile}`,
    'create a util logging.py that...',
  ]

  return `Try "${sample(commands)}"`
})

export const refreshExampleCommands = memoize(async (): Promise<void> => {
  const projectConfig = getCurrentProjectConfig()
  const now = Date.now()
  const lastGenerated = projectConfig.exampleFilesGeneratedAt ?? 0

  // Regenerate examples if they're over a week old
  if (now - lastGenerated > ONE_WEEK_IN_MS) {
    projectConfig.exampleFiles = []
  }

  // If no example files cached, kickstart fetch in background
  if (!projectConfig.exampleFiles?.length) {
    void getFrequentlyModifiedFiles().then(files => {
      if (files.length) {
        saveCurrentProjectConfig(current => ({
          ...current,
          exampleFiles: files,
          exampleFilesGeneratedAt: Date.now(),
        }))
      }
    })
  }
})
