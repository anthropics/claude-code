/**
 * The shell names a row may carry, the CLI's own list: the login shell's
 * basename when it is one of these, else `other`; `none` when unset.
 */
export const KNOWN_SHELLS: readonly string[] = [
  'zsh',
  'bash',
  'fish',
  'sh',
  'dash',
  'ash',
  'ksh',
  'tcsh',
  'csh',
  'nu',
  'nushell',
  'pwsh',
  'powershell',
  'cmd',
  'elvish',
  'xonsh',
  'ion',
]
