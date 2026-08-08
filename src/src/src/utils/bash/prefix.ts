import { buildPrefix } from '../shell/specPrefix.js'
import { splitCommand_DEPRECATED } from './commands.js'
import { extractCommandArguments, parseCommand } from './parser.js'
import { getCommandSpec } from './registry.js'

const NUMERIC = /^\d+$/
const ENV_VAR = /^[A-Za-z_][A-Za-z0-9_]*=/

// Wrapper commands with complex option handling that can't be expressed in specs
const WRAPPER_COMMANDS = new Set([
  'nice', // command position varies based on options
])

const toArray = <T>(val: T | T[]): T[] => (Array.isArray(val) ? val : [val])

// Check if args[0] matches a known subcommand (disambiguates wrapper commands
// that also have subcommands, e.g. the git spec has isCommand args for aliases).
function isKnownSubcommand(
  arg: string,
  spec: { subcommands?: { name: string | string[] }[] } | null,
): boolean {
  if (!spec?.subcommands?.length) return false
  return spec.subcommands.some(sub =>
    Array.isArray(sub.name) ? sub.name.includes(arg) : sub.name === arg,
  )
}

export async function getCommandPrefixStatic(
  command: string,
  recursionDepth = 0,
  wrapperCount = 0,
): Promise<{ commandPrefix: string | null } | null> {
  if (wrapperCount > 2 || recursionDepth > 10) return null

  const parsed = await parseCommand(command)
  if (!parsed) return null
  if (!parsed.commandNode) {
    return { commandPrefix: null }
  }

  const { envVars, commandNode } = parsed
  const cmdArgs = extractCommandArguments(commandNode)

  const [cmd, ...args] = cmdArgs
  if (!cmd) return { commandPrefix: null }

  // Check if this is a wrapper command by looking at its spec
  const spec = await getCommandSpec(cmd)
  // Check if this is a wrapper command
  let isWrapper =
    WRAPPER_COMMANDS.has(cmd) ||
    (spec?.args && toArray(spec.args).some(arg => arg?.isCommand))

  // Special case: if the command has subcommands and the first arg matches a subcommand,
  // treat it as a regular command, not a wrapper
  if (isWrapper && args[0] && isKnownSubcommand(args[0], spec)) {
    isWrapper = false
  }

  const prefix = isWrapper
    ? await handleWrapper(cmd, args, recursionDepth, wrapperCount)
    : await buildPrefix(cmd, args, spec)

  if (prefix === null && recursionDepth === 0 && isWrapper) {
    return null
  }

  const envPrefix = envVars.length ? `${envVars.join(' ')} ` : ''
  return { commandPrefix: prefix ? envPrefix + prefix : null }
}

async function handleWrapper(
  command: string,
  args: string[],
  recursionDepth: number,
  wrapperCount: number,
): Promise<string | null> {
  const spec = await getCommandSpec(command)

  if (spec?.args) {
    const commandArgIndex = toArray(spec.args).findIndex(arg => arg?.isCommand)

    if (commandArgIndex !== -1) {
      const parts = [command]

      for (let i = 0; i < args.length && i <= commandArgIndex; i++) {
        if (i === commandArgIndex) {
          const result = await getCommandPrefixStatic(
            args.slice(i).join(' '),
            recursionDepth + 1,
            wrapperCount + 1,
          )
          if (result?.commandPrefix) {
            parts.push(...result.commandPrefix.split(' '))
            return parts.join(' ')
          }
          break
        } else if (
          args[i] &&
          !args[i]!.startsWith('-') &&
          !ENV_VAR.test(args[i]!)
        ) {
          parts.push(args[i]!)
        }
      }
    }
  }

  const wrapped = args.find(
    arg => !arg.startsWith('-') && !NUMERIC.test(arg) && !ENV_VAR.test(arg),
  )
  if (!wrapped) return command

  const result = await getCommandPrefixStatic(
    args.slice(args.indexOf(wrapped)).join(' '),
    recursionDepth + 1,
    wrapperCount + 1,
  )

  return !result?.commandPrefix ? null : `${command} ${result.commandPrefix}`
}

/**
 * Computes prefixes for a compound command (with && / || / ;).
 * For single commands, returns a single-element array with the prefix.
 *
 * For compound commands, computes per-subcommand prefixes and collapses
 * them: subcommands sharing a root (first word) are collapsed via
 * word-aligned longest common prefix.
 *
 * @param excludeSubcommand — optional filter; return true for subcommands
 *   that should be excluded from the prefix suggestion (e.g. read-only
 *   commands that are already auto-allowed).
 */
export async function getCompoundCommandPrefixesStatic(
  command: string,
  excludeSubcommand?: (subcommand: string) => boolean,
): Promise<string[]> {
  const subcommands = splitCommand_DEPRECATED(command)
  if (subcommands.length <= 1) {
    const result = await getCommandPrefixStatic(command)
    return result?.commandPrefix ? [result.commandPrefix] : []
  }

  const prefixes: string[] = []
  for (const subcmd of subcommands) {
    const trimmed = subcmd.trim()
    if (excludeSubcommand?.(trimmed)) continue
    const result = await getCommandPrefixStatic(trimmed)
    if (result?.commandPrefix) {
      prefixes.push(result.commandPrefix)
    }
  }

  if (prefixes.length === 0) return []

  // Group prefixes by their first word (root command)
  const groups = new Map<string, string[]>()
  for (const prefix of prefixes) {
    const root = prefix.split(' ')[0]!
    const group = groups.get(root)
    if (group) {
      group.push(prefix)
    } else {
      groups.set(root, [prefix])
    }
  }

  // Collapse each group via word-aligned LCP
  const collapsed: string[] = []
  for (const [, group] of groups) {
    collapsed.push(longestCommonPrefix(group))
  }
  return collapsed
}

/**
 * Compute the longest common prefix of strings, aligned to word boundaries.
 * e.g. ["git fetch", "git worktree"] → "git"
 *      ["npm run test", "npm run lint"] → "npm run"
 */
function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return ''
  if (strings.length === 1) return strings[0]!

  const first = strings[0]!
  const words = first.split(' ')
  let commonWords = words.length

  for (let i = 1; i < strings.length; i++) {
    const otherWords = strings[i]!.split(' ')
    let shared = 0
    while (
      shared < commonWords &&
      shared < otherWords.length &&
      words[shared] === otherWords[shared]
    ) {
      shared++
    }
    commonWords = shared
  }

  return words.slice(0, Math.max(1, commonWords)).join(' ')
}
