import chalk from 'chalk'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import { color } from '../components/design-system/color.js'
import { supportsHyperlinks } from '../ink/supports-hyperlinks.js'
import { logForDebugging } from './debug.js'
import { isENOENT } from './errors.js'
import { execFileNoThrow } from './execFileNoThrow.js'
import { logError } from './log.js'
import type { ThemeName } from './theme.js'

const EOL = '\n'

type ShellInfo = {
  name: string
  rcFile: string
  cacheFile: string
  completionLine: string
  shellFlag: string
}

function detectShell(): ShellInfo | null {
  const shell = process.env.SHELL || ''
  const home = homedir()
  const claudeDir = join(home, '.claude')

  if (shell.endsWith('/zsh') || shell.endsWith('/zsh.exe')) {
    const cacheFile = join(claudeDir, 'completion.zsh')
    return {
      name: 'zsh',
      rcFile: join(home, '.zshrc'),
      cacheFile,
      completionLine: `[[ -f "${cacheFile}" ]] && source "${cacheFile}"`,
      shellFlag: 'zsh',
    }
  }
  if (shell.endsWith('/bash') || shell.endsWith('/bash.exe')) {
    const cacheFile = join(claudeDir, 'completion.bash')
    return {
      name: 'bash',
      rcFile: join(home, '.bashrc'),
      cacheFile,
      completionLine: `[ -f "${cacheFile}" ] && source "${cacheFile}"`,
      shellFlag: 'bash',
    }
  }
  if (shell.endsWith('/fish') || shell.endsWith('/fish.exe')) {
    const xdg = process.env.XDG_CONFIG_HOME || join(home, '.config')
    const cacheFile = join(claudeDir, 'completion.fish')
    return {
      name: 'fish',
      rcFile: join(xdg, 'fish', 'config.fish'),
      cacheFile,
      completionLine: `[ -f "${cacheFile}" ] && source "${cacheFile}"`,
      shellFlag: 'fish',
    }
  }
  return null
}

function formatPathLink(filePath: string): string {
  if (!supportsHyperlinks()) {
    return filePath
  }
  const fileUrl = pathToFileURL(filePath).href
  return `\x1b]8;;${fileUrl}\x07${filePath}\x1b]8;;\x07`
}

/**
 * Generate and cache the completion script, then add a source line to the
 * shell's rc file. Returns a user-facing status message.
 */
export async function setupShellCompletion(theme: ThemeName): Promise<string> {
  const shell = detectShell()
  if (!shell) {
    return ''
  }

  // Ensure the cache directory exists
  try {
    await mkdir(dirname(shell.cacheFile), { recursive: true })
  } catch (e: unknown) {
    logError(e)
    return `${EOL}${color('warning', theme)(`Could not write ${shell.name} completion cache`)}${EOL}${chalk.dim(`Run manually: claude completion ${shell.shellFlag} > ${shell.cacheFile}`)}${EOL}`
  }

  // Generate the completion script by writing directly to the cache file.
  // Using --output avoids piping through stdout where process.exit() can
  // truncate output before the pipe buffer drains.
  const claudeBin = process.argv[1] || 'claude'
  const result = await execFileNoThrow(claudeBin, [
    'completion',
    shell.shellFlag,
    '--output',
    shell.cacheFile,
  ])
  if (result.code !== 0) {
    return `${EOL}${color('warning', theme)(`Could not generate ${shell.name} shell completions`)}${EOL}${chalk.dim(`Run manually: claude completion ${shell.shellFlag} > ${shell.cacheFile}`)}${EOL}`
  }

  // Check if rc file already sources completions
  let existing = ''
  try {
    existing = await readFile(shell.rcFile, { encoding: 'utf-8' })
    if (
      existing.includes('claude completion') ||
      existing.includes(shell.cacheFile)
    ) {
      return `${EOL}${color('success', theme)(`Shell completions updated for ${shell.name}`)}${EOL}${chalk.dim(`See ${formatPathLink(shell.rcFile)}`)}${EOL}`
    }
  } catch (e: unknown) {
    if (!isENOENT(e)) {
      logError(e)
      return `${EOL}${color('warning', theme)(`Could not install ${shell.name} shell completions`)}${EOL}${chalk.dim(`Add this to ${formatPathLink(shell.rcFile)}:`)}${EOL}${chalk.dim(shell.completionLine)}${EOL}`
    }
  }

  // Append source line to rc file
  try {
    const configDir = dirname(shell.rcFile)
    await mkdir(configDir, { recursive: true })

    const separator = existing && !existing.endsWith('\n') ? '\n' : ''
    const content = `${existing}${separator}\n# Claude Code shell completions\n${shell.completionLine}\n`
    await writeFile(shell.rcFile, content, { encoding: 'utf-8' })

    return `${EOL}${color('success', theme)(`Installed ${shell.name} shell completions`)}${EOL}${chalk.dim(`Added to ${formatPathLink(shell.rcFile)}`)}${EOL}${chalk.dim(`Run: source ${shell.rcFile}`)}${EOL}`
  } catch (error) {
    logError(error)
    return `${EOL}${color('warning', theme)(`Could not install ${shell.name} shell completions`)}${EOL}${chalk.dim(`Add this to ${formatPathLink(shell.rcFile)}:`)}${EOL}${chalk.dim(shell.completionLine)}${EOL}`
  }
}

/**
 * Regenerate cached shell completion scripts in ~/.claude/.
 * Called after `claude update` so completions stay in sync with the new binary.
 */
export async function regenerateCompletionCache(): Promise<void> {
  const shell = detectShell()
  if (!shell) {
    return
  }

  logForDebugging(`update: Regenerating ${shell.name} completion cache`)

  const claudeBin = process.argv[1] || 'claude'
  const result = await execFileNoThrow(claudeBin, [
    'completion',
    shell.shellFlag,
    '--output',
    shell.cacheFile,
  ])

  if (result.code !== 0) {
    logForDebugging(
      `update: Failed to regenerate ${shell.name} completion cache`,
    )
    return
  }

  logForDebugging(
    `update: Regenerated ${shell.name} completion cache at ${shell.cacheFile}`,
  )
}
