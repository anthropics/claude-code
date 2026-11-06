/**
 * Terminal Launcher
 *
 * Detects the user's preferred terminal emulator and launches Claude Code
 * inside it. Used by the deep link protocol handler when invoked by the OS
 * (i.e., not already running inside a terminal).
 *
 * Platform support:
 *   macOS  — Terminal.app, iTerm2, Ghostty, Kitty, Alacritty, WezTerm
 *   Linux  — $TERMINAL, x-terminal-emulator, gnome-terminal, konsole, etc.
 *   Windows — Windows Terminal (wt.exe), PowerShell, cmd.exe
 */

import { spawn } from 'child_process'
import { basename } from 'path'
import { getGlobalConfig } from '../config.js'
import { logForDebugging } from '../debug.js'
import { execFileNoThrow } from '../execFileNoThrow.js'
import { which } from '../which.js'

export type TerminalInfo = {
  name: string
  command: string
}

// macOS terminals in preference order.
// Each entry: [display name, app bundle name or CLI command, detection method]
const MACOS_TERMINALS: Array<{
  name: string
  bundleId: string
  app: string
}> = [
  { name: 'iTerm2', bundleId: 'com.googlecode.iterm2', app: 'iTerm' },
  { name: 'Ghostty', bundleId: 'com.mitchellh.ghostty', app: 'Ghostty' },
  { name: 'Kitty', bundleId: 'net.kovidgoyal.kitty', app: 'kitty' },
  { name: 'Alacritty', bundleId: 'org.alacritty', app: 'Alacritty' },
  { name: 'WezTerm', bundleId: 'com.github.wez.wezterm', app: 'WezTerm' },
  {
    name: 'Terminal.app',
    bundleId: 'com.apple.Terminal',
    app: 'Terminal',
  },
]

// Linux terminals in preference order (command name)
const LINUX_TERMINALS = [
  'ghostty',
  'kitty',
  'alacritty',
  'wezterm',
  'gnome-terminal',
  'konsole',
  'xfce4-terminal',
  'mate-terminal',
  'tilix',
  'xterm',
]

/**
 * Detect the user's preferred terminal on macOS.
 * Checks running processes first (most likely to be what the user prefers),
 * then falls back to checking installed .app bundles.
 */
async function detectMacosTerminal(): Promise<TerminalInfo> {
  // Stored preference from a previous interactive session. This is the only
  // signal that survives into the headless LaunchServices context — the env
  // var check below never hits when we're launched from a browser link.
  const stored = getGlobalConfig().deepLinkTerminal
  if (stored) {
    const match = MACOS_TERMINALS.find(t => t.app === stored)
    if (match) {
      return { name: match.name, command: match.app }
    }
  }

  // Check the TERM_PROGRAM env var — if set, the user has a clear preference.
  // TERM_PROGRAM may include a .app suffix (e.g., "iTerm.app"), so strip it.
  const termProgram = process.env.TERM_PROGRAM
  if (termProgram) {
    const normalized = termProgram.replace(/\.app$/i, '').toLowerCase()
    const match = MACOS_TERMINALS.find(
      t =>
        t.app.toLowerCase() === normalized ||
        t.name.toLowerCase() === normalized,
    )
    if (match) {
      return { name: match.name, command: match.app }
    }
  }

  // Check which terminals are installed by looking for .app bundles.
  // Try mdfind first (Spotlight), but fall back to checking /Applications
  // directly since mdfind can return empty results if Spotlight is disabled
  // or hasn't indexed the app yet.
  for (const terminal of MACOS_TERMINALS) {
    const { code, stdout } = await execFileNoThrow(
      'mdfind',
      [`kMDItemCFBundleIdentifier == "${terminal.bundleId}"`],
      { timeout: 5000, useCwd: false },
    )
    if (code === 0 && stdout.trim().length > 0) {
      return { name: terminal.name, command: terminal.app }
    }
  }

  // Fallback: check /Applications directly (mdfind may not work if
  // Spotlight indexing is disabled or incomplete)
  for (const terminal of MACOS_TERMINALS) {
    const { code: lsCode } = await execFileNoThrow(
      'ls',
      [`/Applications/${terminal.app}.app`],
      { timeout: 1000, useCwd: false },
    )
    if (lsCode === 0) {
      return { name: terminal.name, command: terminal.app }
    }
  }

  // Terminal.app is always available on macOS
  return { name: 'Terminal.app', command: 'Terminal' }
}

/**
 * Detect the user's preferred terminal on Linux.
 * Checks $TERMINAL, then x-terminal-emulator, then walks a priority list.
 */
async function detectLinuxTerminal(): Promise<TerminalInfo | null> {
  // Check $TERMINAL env var
  const termEnv = process.env.TERMINAL
  if (termEnv) {
    const resolved = await which(termEnv)
    if (resolved) {
      return { name: basename(termEnv), command: resolved }
    }
  }

  // Check x-terminal-emulator (Debian/Ubuntu alternative)
  const xte = await which('x-terminal-emulator')
  if (xte) {
    return { name: 'x-terminal-emulator', command: xte }
  }

  // Walk the priority list
  for (const terminal of LINUX_TERMINALS) {
    const resolved = await which(terminal)
    if (resolved) {
      return { name: terminal, command: resolved }
    }
  }

  return null
}

/**
 * Detect the user's preferred terminal on Windows.
 */
async function detectWindowsTerminal(): Promise<TerminalInfo> {
  // Check for Windows Terminal first
  const wt = await which('wt.exe')
  if (wt) {
    return { name: 'Windows Terminal', command: wt }
  }

  // PowerShell 7+ (separate install)
  const pwsh = await which('pwsh.exe')
  if (pwsh) {
    return { name: 'PowerShell', command: pwsh }
  }

  // Windows PowerShell 5.1 (built into Windows)
  const powershell = await which('powershell.exe')
  if (powershell) {
    return { name: 'PowerShell', command: powershell }
  }

  // cmd.exe is always available
  return { name: 'Command Prompt', command: 'cmd.exe' }
}

/**
 * Detect the user's preferred terminal emulator.
 */
export async function detectTerminal(): Promise<TerminalInfo | null> {
  switch (process.platform) {
    case 'darwin':
      return detectMacosTerminal()
    case 'linux':
      return detectLinuxTerminal()
    case 'win32':
      return detectWindowsTerminal()
    default:
      return null
  }
}

/**
 * Launch Claude Code in the detected terminal emulator.
 *
 * Pure argv paths (no shell, user input never touches an interpreter):
 *   macOS — Ghostty, Alacritty, Kitty, WezTerm (via open -na --args)
 *   Linux — all ten in LINUX_TERMINALS
 *   Windows — Windows Terminal
 *
 * Shell-string paths (user input is shell-quoted and relied upon):
 *   macOS — iTerm2, Terminal.app (AppleScript `write text` / `do script`
 *           are inherently shell-interpreted; no argv interface exists)
 *   Windows — PowerShell -Command, cmd.exe /k (no argv exec mode)
 *
 * For pure-argv paths: claudePath, --prefill, query, cwd travel as distinct
 * argv elements end-to-end. No sh -c. No shellQuote(). The terminal does
 * chdir(cwd) and execvp(claude, argv). Spaces/quotes/metacharacters in
 * query or cwd are preserved by argv boundaries with zero interpretation.
 */
export async function launchInTerminal(
  claudePath: string,
  action: {
    query?: string
    cwd?: string
    repo?: string
    lastFetchMs?: number
  },
): Promise<boolean> {
  const terminal = await detectTerminal()
  if (!terminal) {
    logForDebugging('No terminal emulator detected', { level: 'error' })
    return false
  }

  logForDebugging(
    `Launching in terminal: ${terminal.name} (${terminal.command})`,
  )
  const claudeArgs = ['--deep-link-origin']
  if (action.repo) {
    claudeArgs.push('--deep-link-repo', action.repo)
    if (action.lastFetchMs !== undefined) {
      claudeArgs.push('--deep-link-last-fetch', String(action.lastFetchMs))
    }
  }
  if (action.query) {
    claudeArgs.push('--prefill', action.query)
  }

  switch (process.platform) {
    case 'darwin':
      return launchMacosTerminal(terminal, claudePath, claudeArgs, action.cwd)
    case 'linux':
      return launchLinuxTerminal(terminal, claudePath, claudeArgs, action.cwd)
    case 'win32':
      return launchWindowsTerminal(terminal, claudePath, claudeArgs, action.cwd)
    default:
      return false
  }
}

async function launchMacosTerminal(
  terminal: TerminalInfo,
  claudePath: string,
  claudeArgs: string[],
  cwd?: string,
): Promise<boolean> {
  switch (terminal.command) {
    // --- SHELL-STRING PATHS (AppleScript has no argv interface) ---
    // User input is shell-quoted via shellQuote(). These two are the only
    // macOS paths where shellQuote() correctness is load-bearing.

    case 'iTerm': {
      const shCmd = buildShellCommand(claudePath, claudeArgs, cwd)
      // If iTerm isn't running, `tell application` launches it and iTerm's
      // default startup behavior opens a window — so `create window` would
      // make a second one. Check `running` first: if already running (even
      // with zero windows), create a window; if not, `activate` lets iTerm's
      // startup create the first window.
      const script = `tell application "iTerm"
  if running then
    create window with default profile
  else
    activate
  end if
  tell current session of current window
    write text ${appleScriptQuote(shCmd)}
  end tell
end tell`
      const { code } = await execFileNoThrow('osascript', ['-e', script], {
        useCwd: false,
      })
      if (code === 0) return true
      break
    }

    case 'Terminal': {
      const shCmd = buildShellCommand(claudePath, claudeArgs, cwd)
      const script = `tell application "Terminal"
  do script ${appleScriptQuote(shCmd)}
  activate
end tell`
      const { code } = await execFileNoThrow('osascript', ['-e', script], {
        useCwd: false,
      })
      return code === 0
    }

    // --- PURE ARGV PATHS (no shell, no shellQuote) ---
    // open -na <App> --args <argv> → app receives argv verbatim →
    // terminal's native --working-directory + -e exec the command directly.

    case 'Ghostty': {
      const args = [
        '-na',
        terminal.command,
        '--args',
        '--window-save-state=never',
      ]
      if (cwd) args.push(`--working-directory=${cwd}`)
      args.push('-e', claudePath, ...claudeArgs)
      const { code } = await execFileNoThrow('open', args, { useCwd: false })
      if (code === 0) return true
      break
    }

    case 'Alacritty': {
      const args = ['-na', terminal.command, '--args']
      if (cwd) args.push('--working-directory', cwd)
      args.push('-e', claudePath, ...claudeArgs)
      const { code } = await execFileNoThrow('open', args, { useCwd: false })
      if (code === 0) return true
      break
    }

    case 'kitty': {
      const args = ['-na', terminal.command, '--args']
      if (cwd) args.push('--directory', cwd)
      args.push(claudePath, ...claudeArgs)
      const { code } = await execFileNoThrow('open', args, { useCwd: false })
      if (code === 0) return true
      break
    }

    case 'WezTerm': {
      const args = ['-na', terminal.command, '--args', 'start']
      if (cwd) args.push('--cwd', cwd)
      args.push('--', claudePath, ...claudeArgs)
      const { code } = await execFileNoThrow('open', args, { useCwd: false })
      if (code === 0) return true
      break
    }
  }

  logForDebugging(
    `Failed to launch ${terminal.name}, falling back to Terminal.app`,
  )
  return launchMacosTerminal(
    { name: 'Terminal.app', command: 'Terminal' },
    claudePath,
    claudeArgs,
    cwd,
  )
}

async function launchLinuxTerminal(
  terminal: TerminalInfo,
  claudePath: string,
  claudeArgs: string[],
  cwd?: string,
): Promise<boolean> {
  // All Linux paths are pure argv. Each terminal's --working-directory
  // (or equivalent) sets cwd natively; the command is exec'd directly.
  // For the few terminals without a cwd flag (xterm, and the opaque
  // x-terminal-emulator / $TERMINAL), spawn({cwd}) sets the terminal
  // process's cwd — most inherit it for the child.

  let args: string[]
  let spawnCwd: string | undefined

  switch (terminal.name) {
    case 'gnome-terminal':
      args = cwd ? [`--working-directory=${cwd}`, '--'] : ['--']
      args.push(claudePath, ...claudeArgs)
      break
    case 'konsole':
      args = cwd ? ['--workdir', cwd, '-e'] : ['-e']
      args.push(claudePath, ...claudeArgs)
      break
    case 'kitty':
      args = cwd ? ['--directory', cwd] : []
      args.push(claudePath, ...claudeArgs)
      break
    case 'wezterm':
      args = cwd ? ['start', '--cwd', cwd, '--'] : ['start', '--']
      args.push(claudePath, ...claudeArgs)
      break
    case 'alacritty':
      args = cwd ? ['--working-directory', cwd, '-e'] : ['-e']
      args.push(claudePath, ...claudeArgs)
      break
    case 'ghostty':
      args = cwd ? [`--working-directory=${cwd}`, '-e'] : ['-e']
      args.push(claudePath, ...claudeArgs)
      break
    case 'xfce4-terminal':
    case 'mate-terminal':
      args = cwd ? [`--working-directory=${cwd}`, '-x'] : ['-x']
      args.push(claudePath, ...claudeArgs)
      break
    case 'tilix':
      args = cwd ? [`--working-directory=${cwd}`, '-e'] : ['-e']
      args.push(claudePath, ...claudeArgs)
      break
    default:
      // xterm, x-terminal-emulator, $TERMINAL — no reliable cwd flag.
      // spawn({cwd}) sets the terminal's own cwd; most inherit.
      args = ['-e', claudePath, ...claudeArgs]
      spawnCwd = cwd
      break
  }

  return spawnDetached(terminal.command, args, { cwd: spawnCwd })
}

async function launchWindowsTerminal(
  terminal: TerminalInfo,
  claudePath: string,
  claudeArgs: string[],
  cwd?: string,
): Promise<boolean> {
  const args: string[] = []

  switch (terminal.name) {
    // --- PURE ARGV PATH ---
    case 'Windows Terminal':
      if (cwd) args.push('-d', cwd)
      args.push('--', claudePath, ...claudeArgs)
      break

    // --- SHELL-STRING PATHS ---
    // PowerShell -Command and cmd /k take a command string. No argv exec
    // mode that also keeps the session interactive after claude exits.
    // User input is escaped per-shell; correctness of that escaping is
    // load-bearing here.

    case 'PowerShell': {
      // Single-quoted PowerShell strings have NO escape sequences (only
      // '' for a literal quote). Double-quoted strings interpret backtick
      // escapes — a query containing `" could break out.
      const cdCmd = cwd ? `Set-Location ${psQuote(cwd)}; ` : ''
      args.push(
        '-NoExit',
        '-Command',
        `${cdCmd}& ${psQuote(claudePath)} ${claudeArgs.map(psQuote).join(' ')}`,
      )
      break
    }

    default: {
      const cdCmd = cwd ? `cd /d ${cmdQuote(cwd)} && ` : ''
      args.push(
        '/k',
        `${cdCmd}${cmdQuote(claudePath)} ${claudeArgs.map(a => cmdQuote(a)).join(' ')}`,
      )
      break
    }
  }

  // cmd.exe does NOT use MSVCRT-style argument parsing. libuv's default
  // quoting for spawn() on Windows assumes MSVCRT rules and would double-
  // escape our already-cmdQuote'd string. Bypass it for cmd.exe only.
  return spawnDetached(terminal.command, args, {
    windowsVerbatimArguments: terminal.name === 'Command Prompt',
  })
}

/**
 * Spawn a terminal detached so the handler process can exit without
 * waiting for the terminal to close. Resolves false on spawn failure
 * (ENOENT, EACCES) rather than crashing.
 */
function spawnDetached(
  command: string,
  args: string[],
  opts: { cwd?: string; windowsVerbatimArguments?: boolean } = {},
): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      cwd: opts.cwd,
      windowsVerbatimArguments: opts.windowsVerbatimArguments,
    })
    child.once('error', err => {
      logForDebugging(`Failed to spawn ${command}: ${err.message}`, {
        level: 'error',
      })
      void resolve(false)
    })
    child.once('spawn', () => {
      child.unref()
      void resolve(true)
    })
  })
}

/**
 * Build a single-quoted POSIX shell command string. ONLY used by the
 * AppleScript paths (iTerm, Terminal.app) which have no argv interface.
 */
function buildShellCommand(
  claudePath: string,
  claudeArgs: string[],
  cwd?: string,
): string {
  const cdPrefix = cwd ? `cd ${shellQuote(cwd)} && ` : ''
  return `${cdPrefix}${[claudePath, ...claudeArgs].map(shellQuote).join(' ')}`
}

/**
 * POSIX single-quote escaping. Single-quoted strings have zero
 * interpretation except for the closing single quote itself.
 * Only used by buildShellCommand() for the AppleScript paths.
 */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

/**
 * AppleScript string literal escaping (backslash then double-quote).
 */
function appleScriptQuote(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * PowerShell single-quoted string. The ONLY special sequence is '' for a
 * literal single quote — no backtick escapes, no variable expansion, no
 * subexpressions. This is the safe PowerShell quoting; double-quoted
 * strings interpret `n `t `" etc. and can be escaped out of.
 */
function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

/**
 * cmd.exe argument quoting. cmd.exe does NOT use CommandLineToArgvW-style
 * backslash escaping — it toggles its quoting state on every raw "
 * character, so an embedded " breaks out of the quoted region and exposes
 * metacharacters (& | < > ^) to cmd.exe interpretation = command injection.
 *
 * Strategy: strip " from the input (it cannot be safely represented in a
 * cmd.exe double-quoted string). Escape % as %% to prevent environment
 * variable expansion (%PATH% etc.) which cmd.exe performs even inside
 * double quotes. Trailing backslashes are still doubled because the
 * *child process* (claude.exe) uses CommandLineToArgvW, where a trailing
 * \ before our closing " would eat the close-quote.
 */
function cmdQuote(arg: string): string {
  const stripped = arg.replace(/"/g, '').replace(/%/g, '%%')
  const escaped = stripped.replace(/(\\+)$/, '$1$1')
  return `"${escaped}"`
}
