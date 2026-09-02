/**
 * PowerShell Common Parameters (available on all cmdlets via [CmdletBinding()]).
 * Source: about_CommonParameters (PowerShell docs) + Get-Command output.
 *
 * Shared between pathValidation.ts (merges into per-cmdlet known-param sets)
 * and readOnlyValidation.ts (merges into safeFlags check). Split out to break
 * what would otherwise be an import cycle between those two files.
 *
 * Stored lowercase with leading dash — callers `.toLowerCase()` their input.
 */

export const COMMON_SWITCHES = ['-verbose', '-debug']

export const COMMON_VALUE_PARAMS = [
  '-erroraction',
  '-warningaction',
  '-informationaction',
  '-progressaction',
  '-errorvariable',
  '-warningvariable',
  '-informationvariable',
  '-outvariable',
  '-outbuffer',
  '-pipelinevariable',
]

export const COMMON_PARAMETERS: ReadonlySet<string> = new Set([
  ...COMMON_SWITCHES,
  ...COMMON_VALUE_PARAMS,
])
