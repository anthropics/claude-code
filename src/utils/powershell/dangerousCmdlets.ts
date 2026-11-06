/**
 * Shared constants for PowerShell cmdlets that execute arbitrary code.
 *
 * These lists are consumed by both the permission-engine validators
 * (powershellSecurity.ts) and the UI suggestion gate (staticPrefix.ts).
 * Keeping them here avoids duplicating the lists and prevents sync drift
 * — add a cmdlet once, both consumers pick it up.
 */

import { CROSS_PLATFORM_CODE_EXEC } from '../permissions/dangerousPatterns.js'
import { COMMON_ALIASES } from './parser.js'

/**
 * Cmdlets that accept a -FilePath (or positional path) and execute the
 * file's contents as a script.
 */
export const FILEPATH_EXECUTION_CMDLETS = new Set([
  'invoke-command',
  'start-job',
  'start-threadjob',
  'register-scheduledjob',
])

/**
 * Cmdlets where a scriptblock argument executes arbitrary code (not just
 * filtering/transforming pipeline input like Where-Object).
 */
export const DANGEROUS_SCRIPT_BLOCK_CMDLETS = new Set([
  'invoke-command',
  'invoke-expression',
  'start-job',
  'start-threadjob',
  'register-scheduledjob',
  'register-engineevent',
  'register-objectevent',
  'register-wmievent',
  'new-pssession',
  'enter-pssession',
])

/**
 * Cmdlets that load and execute module/script code. `.psm1` files run
 * their top-level body on import — same code-execution risk as iex.
 */
export const MODULE_LOADING_CMDLETS = new Set([
  'import-module',
  'ipmo',
  'install-module',
  'save-module',
  'update-module',
  'install-script',
  'save-script',
])

/**
 * Shells and process spawners. Small, stable — add here only for cmdlets
 * not covered by the validator lists above.
 */
const SHELLS_AND_SPAWNERS = [
  'pwsh',
  'powershell',
  'cmd',
  'bash',
  'wsl',
  'sh',
  'start-process',
  'start',
  'add-type',
  'new-object',
] as const

function aliasesOf(targets: ReadonlySet<string>): string[] {
  return Object.entries(COMMON_ALIASES)
    .filter(([, target]) => targets.has(target.toLowerCase()))
    .map(([alias]) => alias)
}

/**
 * Network cmdlets — wildcard rules for these enable exfil/download without
 * prompt. No legitimate narrow prefix exists.
 */
export const NETWORK_CMDLETS = new Set([
  'invoke-webrequest',
  'invoke-restmethod',
])

/**
 * Alias/variable mutation cmdlets — Set-Alias rebinds command resolution,
 * Set-Variable can poison $PSDefaultParameterValues. checkRuntimeStateManipulation
 * validator in powershellSecurity.ts independently gates on the permission path.
 */
export const ALIAS_HIJACK_CMDLETS = new Set([
  'set-alias',
  'sal', // alias not in COMMON_ALIASES — list explicitly
  'new-alias',
  'nal', // alias not in COMMON_ALIASES — list explicitly
  'set-variable',
  'sv', // alias not in COMMON_ALIASES — list explicitly
  'new-variable',
  'nv', // alias not in COMMON_ALIASES — list explicitly
])

/**
 * WMI/CIM process spawn — Invoke-WmiMethod -Class Win32_Process -Name Create
 * is a Start-Process equivalent that bypasses checkStartProcess. No legitimate
 * narrow prefix exists; any invocation can spawn arbitrary processes.
 * checkWmiProcessSpawn validator gates on the permission path.
 * (security finding #34)
 */
export const WMI_CIM_CMDLETS = new Set([
  'invoke-wmimethod',
  'iwmi', // alias not in COMMON_ALIASES — list explicitly
  'invoke-cimmethod',
])

/**
 * Cmdlets in CMDLET_ALLOWLIST with additionalCommandIsDangerousCallback.
 *
 * The allowlist auto-allows these for safe args (StringConstant identifiers).
 * The permission dialog only fires when the callback rejected — i.e. the args
 * contain a scriptblock, variable, subexpression, etc. Accepting a
 * `Cmdlet:*` wildcard at that point would match ALL future invocations via
 * prefix-startsWith, bypassing the callback forever.
 * `ForEach-Object:*` → `ForEach-Object { Remove-Item -Recurse / }` auto-allows.
 *
 * Sync with readOnlyValidation.ts — test/utils/powershell/dangerousCmdlets.test.ts
 * asserts this set covers every additionalCommandIsDangerousCallback entry.
 */
export const ARG_GATED_CMDLETS = new Set([
  'select-object',
  'sort-object',
  'group-object',
  'where-object',
  'measure-object',
  'write-output',
  'write-host',
  'start-sleep',
  'format-table',
  'format-list',
  'format-wide',
  'format-custom',
  'out-string',
  'out-host',
  // Native executables with callback-gated args (e.g. ipconfig /flushdns
  // is rejected, ipconfig /all is allowed). Same bypass risk.
  'ipconfig',
  'hostname',
  'route',
])

/**
 * Commands to never suggest as a wildcard prefix in the permission dialog.
 *
 * Derived from the validator lists above plus the small static shells list.
 * Add a cmdlet to the appropriate validator list and it automatically
 * appears here — no separate maintenance.
 */
export const NEVER_SUGGEST: ReadonlySet<string> = (() => {
  const core = new Set<string>([
    ...SHELLS_AND_SPAWNERS,
    ...FILEPATH_EXECUTION_CMDLETS,
    ...DANGEROUS_SCRIPT_BLOCK_CMDLETS,
    ...MODULE_LOADING_CMDLETS,
    ...NETWORK_CMDLETS,
    ...ALIAS_HIJACK_CMDLETS,
    ...WMI_CIM_CMDLETS,
    ...ARG_GATED_CMDLETS,
    // ForEach-Object's -MemberName (positional: `% Delete`) resolves against
    // the runtime pipeline object — `Get-ChildItem | % Delete` invokes
    // FileInfo.Delete(). StaticParameterBinder identifies the
    // PropertyAndMethodSet parameter set, but the set handles both; the arg
    // is a plain StringConstantExpressionAst with no property/method signal.
    // Pipeline type inference (upstream OutputType → GetMember) misses ETS
    // AliasProperty members and has no answer for `$var | %` or external
    // upstream. Not in ARG_GATED (no allowlist entry to sync with).
    'foreach-object',
    // Interpreters/runners — `node script.js` stops at the file arg and
    // suggests bare `node:*`, auto-allowing arbitrary code via -e/-p. The
    // auto-mode classifier strips these rules (isDangerousPowerShellPermission)
    // but the suggestion gate didn't. Multi-word entries ('npm run') are
    // filtered out — NEVER_SUGGEST is a single-name lookup on cmd.name.
    ...CROSS_PLATFORM_CODE_EXEC.filter(p => !p.includes(' ')),
  ])
  return new Set([...core, ...aliasesOf(core)])
})()
