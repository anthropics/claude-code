import type { SessionMachine } from 'claude-code'

/**
 * What the engine says of the session's Mac: Darwin on arm64, npm and pnpm
 * on the PATH, bun and node too.
 */
export const MAC_MACHINE: SessionMachine = {
  sysname: 'Darwin',
  release: '25.6.0',
  machine: 'arm64',
  packageManagers: ['npm', 'pnpm'],
  runtimes: ['bun', 'node'],
}
