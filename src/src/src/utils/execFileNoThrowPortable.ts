import { type Options as ExecaOptions, execaSync } from 'execa'
import { getCwd } from '../utils/cwd.js'
import { slowLogging } from './slowOperations.js'

const MS_IN_SECOND = 1000
const SECONDS_IN_MINUTE = 60

type ExecSyncOptions = {
  abortSignal?: AbortSignal
  timeout?: number
  input?: string
  stdio?: ExecaOptions['stdio']
}

/**
 * @deprecated Use `execa` directly with `{ shell: true, reject: false }` for non-blocking execution.
 * Sync exec calls block the event loop and cause performance issues.
 */
export function execSyncWithDefaults_DEPRECATED(command: string): string | null
/**
 * @deprecated Use `execa` directly with `{ shell: true, reject: false }` for non-blocking execution.
 * Sync exec calls block the event loop and cause performance issues.
 */
export function execSyncWithDefaults_DEPRECATED(
  command: string,
  options: ExecSyncOptions,
): string | null
/**
 * @deprecated Use `execa` directly with `{ shell: true, reject: false }` for non-blocking execution.
 * Sync exec calls block the event loop and cause performance issues.
 */
export function execSyncWithDefaults_DEPRECATED(
  command: string,
  abortSignal: AbortSignal,
  timeout?: number,
): string | null
/**
 * @deprecated Use `execa` directly with `{ shell: true, reject: false }` for non-blocking execution.
 * Sync exec calls block the event loop and cause performance issues.
 */
export function execSyncWithDefaults_DEPRECATED(
  command: string,
  optionsOrAbortSignal?: ExecSyncOptions | AbortSignal,
  timeout = 10 * SECONDS_IN_MINUTE * MS_IN_SECOND,
): string | null {
  let options: ExecSyncOptions

  if (optionsOrAbortSignal === undefined) {
    // No second argument - use defaults
    options = {}
  } else if (optionsOrAbortSignal instanceof AbortSignal) {
    // Old signature - second argument is AbortSignal
    options = {
      abortSignal: optionsOrAbortSignal,
      timeout,
    }
  } else {
    // New signature - second argument is options object
    options = optionsOrAbortSignal
  }

  const {
    abortSignal,
    timeout: finalTimeout = 10 * SECONDS_IN_MINUTE * MS_IN_SECOND,
    input,
    stdio = ['ignore', 'pipe', 'pipe'],
  } = options

  abortSignal?.throwIfAborted()
  using _ = slowLogging`exec: ${command.slice(0, 200)}`
  try {
    const result = execaSync(command, {
      env: process.env,
      maxBuffer: 1_000_000,
      timeout: finalTimeout,
      cwd: getCwd(),
      stdio,
      shell: true, // execSync typically runs shell commands
      reject: false, // Don't throw on non-zero exit codes
      input,
    })
    if (!result.stdout) {
      return null
    }
    return result.stdout.trim() || null
  } catch {
    return null
  }
}
