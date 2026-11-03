import type { LinuxDistro } from './linux-distro'
import { osReleaseValue } from './os-release-value'

/**
 * Reads the distribution's id and version off `/etc/os-release`, as the
 * CLI's own rows do; a file that is missing or unreadable yields neither.
 *
 * @param readOsRelease reads `/etc/os-release` as text
 * @returns the distribution
 */
export async function linuxDistroOf(
  readOsRelease: () => Promise<string>,
): Promise<LinuxDistro> {
  let content: string

  try {
    content = await readOsRelease()
  } catch {
    content = ''
  }

  return {
    id: osReleaseValue(content, 'ID'),
    version: osReleaseValue(content, 'VERSION_ID'),
  }
}
