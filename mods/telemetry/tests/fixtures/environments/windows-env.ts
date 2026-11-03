/**
 * The environment of an external build's session on Windows, in Windows
 * Terminal under cmd, its config under USERPROFILE.
 */
export const WINDOWS_ENV: Readonly<Record<string, string>> = {
  USER_TYPE: 'external',
  OS: 'Windows_NT',
  PROCESSOR_ARCHITECTURE: 'AMD64',
  COMSPEC: 'C:\\Windows\\System32\\cmd.exe',
  USERPROFILE: 'C:\\Users\\person',
  WT_SESSION: '1',
}
