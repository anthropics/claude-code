import { stat } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { getGlobalConfig, saveGlobalConfig } from './config.js'
import { execFileNoThrow } from './execFileNoThrow.js'
import { logError } from './log.js'
export function markTerminalSetupInProgress(backupPath: string): void {
  saveGlobalConfig(current => ({
    ...current,
    appleTerminalSetupInProgress: true,
    appleTerminalBackupPath: backupPath,
  }))
}

export function markTerminalSetupComplete(): void {
  saveGlobalConfig(current => ({
    ...current,
    appleTerminalSetupInProgress: false,
  }))
}

function getTerminalRecoveryInfo(): {
  inProgress: boolean
  backupPath: string | null
} {
  const config = getGlobalConfig()
  return {
    inProgress: config.appleTerminalSetupInProgress ?? false,
    backupPath: config.appleTerminalBackupPath || null,
  }
}

export function getTerminalPlistPath(): string {
  return join(homedir(), 'Library', 'Preferences', 'com.apple.Terminal.plist')
}

export async function backupTerminalPreferences(): Promise<string | null> {
  const terminalPlistPath = getTerminalPlistPath()
  const backupPath = `${terminalPlistPath}.bak`

  try {
    const { code } = await execFileNoThrow('defaults', [
      'export',
      'com.apple.Terminal',
      terminalPlistPath,
    ])

    if (code !== 0) {
      return null
    }

    try {
      await stat(terminalPlistPath)
    } catch {
      return null
    }

    await execFileNoThrow('defaults', [
      'export',
      'com.apple.Terminal',
      backupPath,
    ])

    markTerminalSetupInProgress(backupPath)

    return backupPath
  } catch (error) {
    logError(error)
    return null
  }
}

type RestoreResult =
  | {
      status: 'restored' | 'no_backup'
    }
  | {
      status: 'failed'
      backupPath: string
    }

export async function checkAndRestoreTerminalBackup(): Promise<RestoreResult> {
  const { inProgress, backupPath } = getTerminalRecoveryInfo()
  if (!inProgress) {
    return { status: 'no_backup' }
  }

  if (!backupPath) {
    markTerminalSetupComplete()
    return { status: 'no_backup' }
  }

  try {
    await stat(backupPath)
  } catch {
    markTerminalSetupComplete()
    return { status: 'no_backup' }
  }

  try {
    const { code } = await execFileNoThrow('defaults', [
      'import',
      'com.apple.Terminal',
      backupPath,
    ])

    if (code !== 0) {
      return { status: 'failed', backupPath }
    }

    await execFileNoThrow('killall', ['cfprefsd'])

    markTerminalSetupComplete()
    return { status: 'restored' }
  } catch (restoreError) {
    logError(
      new Error(
        `Failed to restore Terminal.app settings with: ${restoreError}`,
      ),
    )
    markTerminalSetupComplete()
    return { status: 'failed', backupPath }
  }
}
