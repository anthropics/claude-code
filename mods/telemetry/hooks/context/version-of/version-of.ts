/**
 * A version string reduced to what a row may carry, as the CLI reduces the
 * Agent SDK's: its semver core, `unknown` as said, else `other`.
 *
 * @param version the variable as read; undefined stays undefined
 * @returns the version for the row, or undefined
 */
export function versionOf(version: string | undefined) {
  const isKept = version === undefined || version === 'unknown'
  const core = /^\d{1,8}\.\d{1,8}\.\d{1,8}(?!\d)/.exec(version ?? '')?.[0]

  return isKept ? version : (core ?? 'other')
}
