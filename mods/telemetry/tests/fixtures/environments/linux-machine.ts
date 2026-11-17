import type { SessionMachine } from 'claude-code'

/**
 * What the engine says of that Linux machine: x86_64 under WSL2, npm and
 * node on the PATH.
 */
export const LINUX_MACHINE: SessionMachine = {
  sysname: 'Linux',
  release: '6.6.87.2-microsoft-standard-WSL2',
  machine: 'x86_64',
  packageManagers: ['npm'],
  runtimes: ['node'],
}
