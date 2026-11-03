import type { ConfigLocation } from '../../../config-location'

/**
 * Where the CLI keeps its global config: `.claude.json` under the config
 * directory when one is named, else under the home or profile directory.
 *
 * @param location the three variables as read
 * @returns the file's path, or undefined when no directory is named
 */
export function globalConfigPath(location: ConfigLocation): string | undefined {
  const directory = location.configDir || location.home || location.userProfile

  const separator =
    directory?.includes('\\') && !directory.includes('/') ? '\\' : '/'

  return directory
    ? `${directory.replace(/[\\/]+$/, '')}${separator}.claude.json`
    : undefined
}
