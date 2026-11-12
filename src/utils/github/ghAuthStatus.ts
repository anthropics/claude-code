import { execa } from 'execa'
import { which } from '../which.js'

export type GhAuthStatus =
  | 'authenticated'
  | 'not_authenticated'
  | 'not_installed'

/**
 * Returns gh CLI install + auth status for telemetry.
 * Uses which() first (Bun.which — no subprocess) to detect install, then
 * exit code of `gh auth token` to detect auth. Uses `auth token` instead of
 * `auth status` because the latter makes a network request to GitHub's API,
 * while `auth token` only reads local config/keyring. Spawns with
 * stdout: 'ignore' so the token never enters this process.
 */
export async function getGhAuthStatus(): Promise<GhAuthStatus> {
  const ghPath = await which('gh')
  if (!ghPath) {
    return 'not_installed'
  }
  const { exitCode } = await execa('gh', ['auth', 'token'], {
    stdout: 'ignore',
    stderr: 'ignore',
    timeout: 5000,
    reject: false,
  })
  return exitCode === 0 ? 'authenticated' : 'not_authenticated'
}
