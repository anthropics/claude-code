/**
 * What one probe of the machine answers for the rows' `env` block: the
 * system's own name, the architecture, the kernel, and what is on the PATH.
 *
 * `platformRaw` is the system's name lowercased (`darwin`, `linux`,
 * `freebsd`, `win32`); the package managers and runtimes are comma-joined,
 * an empty string for none.
 */
export type Machine = {
  readonly platformRaw: string
  readonly arch: string
  readonly kernel: string | undefined
  readonly packageManagers: string
  readonly runtimes: string
}
