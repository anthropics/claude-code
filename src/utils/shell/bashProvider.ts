import { feature } from 'bun:bundle'
import { access } from 'fs/promises'
import { tmpdir as osTmpdir } from 'os'
import { join as nativeJoin } from 'path'
import { join as posixJoin } from 'path/posix'
import { rearrangePipeCommand } from '../bash/bashPipeCommand.js'
import { createAndSaveSnapshot } from '../bash/ShellSnapshot.js'
import { formatShellPrefixCommand } from '../bash/shellPrefix.js'
import { quote } from '../bash/shellQuote.js'
import {
  quoteShellCommand,
  rewriteWindowsNullRedirect,
  shouldAddStdinRedirect,
} from '../bash/shellQuoting.js'
import { logForDebugging } from '../debug.js'
import { getPlatform } from '../platform.js'
import { getSessionEnvironmentScript } from '../sessionEnvironment.js'
import { getSessionEnvVars } from '../sessionEnvVars.js'
import {
  ensureSocketInitialized,
  getClaudeTmuxEnv,
  hasTmuxToolBeenUsed,
} from '../tmuxSocket.js'
import { windowsPathToPosixPath } from '../windowsPaths.js'
import type { ShellProvider } from './shellProvider.js'

/**
 * Returns a shell command to disable extended glob patterns for security.
 * Extended globs (bash extglob, zsh EXTENDED_GLOB) can be exploited via
 * malicious filenames that expand after our security validation.
 *
 * When CLAUDE_CODE_SHELL_PREFIX is set, the actual executing shell may differ
 * from shellPath (e.g., shellPath is zsh but the wrapper runs bash). In this
 * case, we include commands for BOTH shells. We redirect both stdout and stderr
 * to /dev/null because zsh's command_not_found_handler writes to STDOUT.
 *
 * When no shell prefix is set, we use the appropriate command for the detected shell.
 */
function getDisableExtglobCommand(shellPath: string): string | null {
  // When CLAUDE_CODE_SHELL_PREFIX is set, the wrapper may use a different shell
  // than shellPath, so we include both bash and zsh commands
  if (process.env.CLAUDE_CODE_SHELL_PREFIX) {
    // Redirect both stdout and stderr because zsh's command_not_found_handler
    // writes to stdout instead of stderr
    return '{ shopt -u extglob || setopt NO_EXTENDED_GLOB; } >/dev/null 2>&1 || true'
  }

  // No shell prefix - use shell-specific command
  if (shellPath.includes('bash')) {
    return 'shopt -u extglob 2>/dev/null || true'
  } else if (shellPath.includes('zsh')) {
    return 'setopt NO_EXTENDED_GLOB 2>/dev/null || true'
  }
  // Unknown shell - do nothing, we don't know the right command
  return null
}

export async function createBashShellProvider(
  shellPath: string,
  options?: { skipSnapshot?: boolean },
): Promise<ShellProvider> {
  let currentSandboxTmpDir: string | undefined
  const snapshotPromise: Promise<string | undefined> = options?.skipSnapshot
    ? Promise.resolve(undefined)
    : createAndSaveSnapshot(shellPath).catch(error => {
        logForDebugging(`Failed to create shell snapshot: ${error}`)
        return undefined
      })
  // Track the last resolved snapshot path for use in getSpawnArgs
  let lastSnapshotFilePath: string | undefined

  return {
    type: 'bash',
    shellPath,
    detached: true,

    async buildExecCommand(
      command: string,
      opts: {
        id: number | string
        sandboxTmpDir?: string
        useSandbox: boolean
      },
    ): Promise<{ commandString: string; cwdFilePath: string }> {
      let snapshotFilePath = await snapshotPromise
      // This access() check is NOT pure TOCTOU — it's the fallback decision
      // point for getSpawnArgs. When the snapshot disappears mid-session
      // (tmpdir cleanup), we must clear lastSnapshotFilePath so getSpawnArgs
      // adds -l and the command gets login-shell init. Without this check,
      // `source ... || true` silently fails and commands run with NO shell
      // init (neither snapshot env nor login profile). The `|| true` on source
      // still guards the race between this check and the spawned shell.
      if (snapshotFilePath) {
        try {
          await access(snapshotFilePath)
        } catch {
          logForDebugging(
            `Snapshot file missing, falling back to login shell: ${snapshotFilePath}`,
          )
          snapshotFilePath = undefined
        }
      }
      lastSnapshotFilePath = snapshotFilePath

      // Stash sandboxTmpDir for use in getEnvironmentOverrides
      currentSandboxTmpDir = opts.sandboxTmpDir

      const tmpdir = osTmpdir()
      const isWindows = getPlatform() === 'windows'
      const shellTmpdir = isWindows ? windowsPathToPosixPath(tmpdir) : tmpdir

      // shellCwdFilePath: POSIX path used inside the bash command (pwd -P >| ...)
      // cwdFilePath: native OS path used by Node.js for readFileSync/unlinkSync
      // On non-Windows these are identical; on Windows, Git Bash needs POSIX paths
      // but Node.js needs native Windows paths for file operations.
      const shellCwdFilePath = opts.useSandbox
        ? posixJoin(opts.sandboxTmpDir!, `cwd-${opts.id}`)
        : posixJoin(shellTmpdir, `claude-${opts.id}-cwd`)
      const cwdFilePath = opts.useSandbox
        ? posixJoin(opts.sandboxTmpDir!, `cwd-${opts.id}`)
        : nativeJoin(tmpdir, `claude-${opts.id}-cwd`)

      // Defensive rewrite: the model sometimes emits Windows CMD-style `2>nul`
      // redirects. In POSIX bash (including Git Bash on Windows), this creates a
      // literal file named `nul` — a reserved device name that breaks git.
      // See anthropics/claude-code#4928.
      const normalizedCommand = rewriteWindowsNullRedirect(command)
      const addStdinRedirect = shouldAddStdinRedirect(normalizedCommand)
      let quotedCommand = quoteShellCommand(normalizedCommand, addStdinRedirect)

      // Debug logging for heredoc/multiline commands to trace trailer handling
      // Only log when commit attribution is enabled to avoid noise
      if (
        feature('COMMIT_ATTRIBUTION') &&
        (command.includes('<<') || command.includes('\n'))
      ) {
        logForDebugging(
          `Shell: Command before quoting (first 500 chars):\n${command.slice(0, 500)}`,
        )
        logForDebugging(
          `Shell: Quoted command (first 500 chars):\n${quotedCommand.slice(0, 500)}`,
        )
      }

      // Special handling for pipes: move stdin redirect after first command
      // This ensures the redirect applies to the first command, not to eval itself.
      // Without this, `eval 'rg foo | wc -l' \< /dev/null` becomes
      // `rg foo | wc -l < /dev/null` — wc reads /dev/null and outputs 0, and
      // rg (with no path arg) waits on the open spawn stdin pipe forever.
      // Applies to sandbox mode too: sandbox wraps the assembled commandString,
      // not the raw command (since PR #9189).
      if (normalizedCommand.includes('|') && addStdinRedirect) {
        quotedCommand = rearrangePipeCommand(normalizedCommand)
      }

      const commandParts: string[] = []

      // Source the snapshot file. The `|| true` guards the race between the
      // access() check above and the spawned shell's `source` — if the file
      // vanishes in that window, the `&&` chain still continues.
      if (snapshotFilePath) {
        const finalPath =
          getPlatform() === 'windows'
            ? windowsPathToPosixPath(snapshotFilePath)
            : snapshotFilePath
        commandParts.push(`source ${quote([finalPath])} 2>/dev/null || true`)
      }

      // Source session environment variables captured from session start hooks
      const sessionEnvScript = await getSessionEnvironmentScript()
      if (sessionEnvScript) {
        commandParts.push(sessionEnvScript)
      }

      // Disable extended glob patterns for security (after sourcing user config to override)
      const disableExtglobCmd = getDisableExtglobCommand(shellPath)
      if (disableExtglobCmd) {
        commandParts.push(disableExtglobCmd)
      }

      // When sourcing a file with aliases, they won't be expanded in the same command line
      // because the shell parses the entire line before execution. Using eval after
      // sourcing causes a second parsing pass where aliases are now available for expansion.
      commandParts.push(`eval ${quotedCommand}`)
      // Use `pwd -P` to get the physical path of the current working directory for consistency with `process.cwd()`
      commandParts.push(`pwd -P >| ${quote([shellCwdFilePath])}`)
      let commandString = commandParts.join(' && ')

      // Apply CLAUDE_CODE_SHELL_PREFIX if set
      if (process.env.CLAUDE_CODE_SHELL_PREFIX) {
        commandString = formatShellPrefixCommand(
          process.env.CLAUDE_CODE_SHELL_PREFIX,
          commandString,
        )
      }

      return { commandString, cwdFilePath }
    },

    getSpawnArgs(commandString: string): string[] {
      const skipLoginShell = lastSnapshotFilePath !== undefined
      if (skipLoginShell) {
        logForDebugging('Spawning shell without login (-l flag skipped)')
      }
      return ['-c', ...(skipLoginShell ? [] : ['-l']), commandString]
    },

    async getEnvironmentOverrides(
      command: string,
    ): Promise<Record<string, string>> {
      // TMUX SOCKET ISOLATION (DEFERRED):
      // We initialize Claude's tmux socket ONLY AFTER the Tmux tool has been used
      // at least once, OR if the current command appears to use tmux.
      // This defers the startup cost until tmux is actually needed.
      //
      // Once the Tmux tool is used (or a tmux command runs), all subsequent Bash
      // commands will use Claude's isolated socket via the TMUX env var override.
      //
      // See tmuxSocket.ts for the full isolation architecture documentation.
      const commandUsesTmux = command.includes('tmux')
      if (
        process.env.USER_TYPE === 'ant' &&
        (hasTmuxToolBeenUsed() || commandUsesTmux)
      ) {
        await ensureSocketInitialized()
      }
      const claudeTmuxEnv = getClaudeTmuxEnv()
      const env: Record<string, string> = {}
      // CRITICAL: Override TMUX to isolate ALL tmux commands to Claude's socket.
      // This is NOT the user's TMUX value - it points to Claude's isolated socket.
      // When null (before socket initializes), user's TMUX is preserved.
      if (claudeTmuxEnv) {
        env.TMUX = claudeTmuxEnv
      }
      if (currentSandboxTmpDir) {
        let posixTmpDir = currentSandboxTmpDir
        if (getPlatform() === 'windows') {
          posixTmpDir = windowsPathToPosixPath(posixTmpDir)
        }
        env.TMPDIR = posixTmpDir
        env.CLAUDE_CODE_TMPDIR = posixTmpDir
        // Zsh uses TMPPREFIX (default /tmp/zsh) for heredoc temp files,
        // not TMPDIR. Set it to a path inside the sandbox tmp dir so
        // heredocs work in sandboxed zsh commands.
        // Safe to set unconditionally — non-zsh shells ignore TMPPREFIX.
        env.TMPPREFIX = posixJoin(posixTmpDir, 'zsh')
      }
      // Apply session env vars set via /env (child processes only, not the REPL)
      for (const [key, value] of getSessionEnvVars()) {
        env[key] = value
      }
      return env
    },
  }
}
