/**
 * What `/etc/os-release` says of a Linux machine for the row: the
 * distribution's `ID` and `VERSION_ID`, undefined when absent or unread.
 */
export type LinuxDistro = {
  readonly id: string | undefined
  readonly version: string | undefined
}
