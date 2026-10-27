/**
 * Where the CLI's global config file is, read off the environment; read to
 * find the file, never sent.
 *
 * The config directory when one is named, else the home directory (the
 * profile directory on Windows).
 */
export type ConfigLocation = {
  readonly configDir: string | undefined
  readonly home: string | undefined
  readonly userProfile: string | undefined
}
