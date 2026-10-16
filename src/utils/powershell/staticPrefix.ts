/**
 * PowerShell static command prefix extraction.
 *
 * Mirrors bash's getCommandPrefixStatic / getCompoundCommandPrefixesStatic
 * (src/utils/bash/prefix.ts) but uses the PowerShell AST parser instead of
 * tree-sitter. The AST gives us cmd.name and cmd.args already split; for
 * external commands we feed those into the same fig-spec walker bash uses
 * (src/utils/shell/specPrefix.ts) — git/npm/kubectl CLIs are shell-agnostic.
 *
 * Feeds the "Yes, and don't ask again for: ___" editable input in the
 * permission dialog — static extractor provides a best-guess prefix, user
 * edits it down if needed.
 */

import { getCommandSpec } from '../bash/registry.js'
import { buildPrefix, DEPTH_RULES } from '../shell/specPrefix.js'
import { countCharInString } from '../stringUtils.js'
import { NEVER_SUGGEST } from './dangerousCmdlets.js'
import {
  getAllCommands,
  type ParsedCommandElement,
  parsePowerShellCommand,
} from './parser.js'

/**
 * Extract a static prefix from a single parsed command element.
 * Returns null for commands we won't suggest (shells, eval cmdlets, path-like
 * invocations) or can't extract a meaningful prefix from.
 */
async function extractPrefixFromElement(
  cmd: ParsedCommandElement,
): Promise<string | null> {
  // nameType === 'application' means the raw name had path chars (./x, x\y,
  // x.exe) — PowerShell will run a file, not a named cmdlet. Don't suggest.
  // Same reasoning as the permission engine's nameType gate (PR #20096).
  if (cmd.nameType === 'application') {
    return null
  }

  const name = cmd.name
  if (!name) {
    return null
  }

  if (NEVER_SUGGEST.has(name.toLowerCase())) {
    return null
  }

  // Cmdlets (Verb-Noun): the name alone is the right prefix granularity.
  // Get-Process -Name pwsh → Get-Process. There's no subcommand concept.
  if (cmd.nameType === 'cmdlet') {
    return name
  }

  // External command. Guard the argv before feeding it to buildPrefix.
  //
  // elementTypes[0] (command name) must be a literal. `& $cmd status` has
  // elementTypes[0]='Variable', name='$cmd' — classifies as 'unknown' (no path
  // chars), passes NEVER_SUGGEST, getCommandSpec('$cmd')=null → returns bare
  // '$cmd' → dead rule. Cheap to gate here.
  //
  // elementTypes[1..] (args) must all be StringConstant or Parameter. Anything
  // dynamic (Variable/SubExpression/ScriptBlock/ExpandableString) would embed
  // `$foo`/`$(...)` in the prefix → dead rule.
  if (cmd.elementTypes?.[0] !== 'StringConstant') {
    return null
  }
  for (let i = 0; i < cmd.args.length; i++) {
    const t = cmd.elementTypes[i + 1]
    if (t !== 'StringConstant' && t !== 'Parameter') {
      return null
    }
  }

  // Consult the fig spec — same oracle bash uses. If git's spec says -C takes
  // a value, buildPrefix skips -C /repo and finds `status` as a subcommand.
  // Lowercase for lookup: fig specs are filesystem paths (git.js), case-
  // sensitive on Linux. PowerShell is case-insensitive (Git === git) so `Git`
  // must resolve to the git spec. macOS hides this bug (case-insensitive fs).
  // Call buildPrefix unconditionally — calculateDepth consults DEPTH_RULES
  // before its own `if (!spec) return 2` fallback, so gcloud/aws/kubectl/az
  // get depth-aware prefixes even without a loaded spec. The old
  // `if (!spec) return name` short-circuit produced bare `gcloud:*` which
  // auto-allows every gcloud subcommand.
  const nameLower = name.toLowerCase()
  const spec = await getCommandSpec(nameLower)
  const prefix = await buildPrefix(name, cmd.args, spec)

  // Post-buildPrefix word integrity: buildPrefix space-joins consumed args
  // into the prefix string. parser.ts:685 stores .value (quote-stripped) for
  // single-quoted literals: git 'push origin' → args=['push origin']. If
  // that arg is consumed, buildPrefix emits 'git push origin' — silently
  // promoting 1 argv element to 3 prefix words. Rule PowerShell(git push
  // origin:*) then matches `git push origin --force` (3-element argv) — not
  // what the user approved.
  //
  // The old set-membership check (`!cmd.args.includes(word)`) was defeated
  // by decoy args: `git 'push origin' push origin` → args=['push origin',
  // 'push', 'origin'], prefix='git push origin'. Each word ∈ args (decoys at
  // indices 1,2 satisfy .includes()) → passed. Now POSITIONAL: walk args in
  // order; each prefix word must exactly match the next non-flag arg. A
  // positional that doesn't match means buildPrefix split it. Flags and
  // their values are skipped (buildPrefix skips them too) so
  // `git -C '/my repo' status` and `git commit -m 'fix typo'` still pass.
  // Backslash (C:\repo) rejected: dead over-specific rule.
  let argIdx = 0
  for (const word of prefix.split(' ').slice(1)) {
    if (word.includes('\\')) return null
    while (argIdx < cmd.args.length) {
      const a = cmd.args[argIdx]!
      if (a === word) break
      if (a.startsWith('-')) {
        argIdx++
        // Only skip the flag's value if the spec says this flag takes a
        // value argument. Without spec info, treat as a switch (no value)
        // — fail-safe avoids over-skipping positional args. (bug #16)
        if (
          spec?.options &&
          argIdx < cmd.args.length &&
          cmd.args[argIdx] !== word &&
          !cmd.args[argIdx]!.startsWith('-')
        ) {
          const flagLower = a.toLowerCase()
          const opt = spec.options.find(o =>
            Array.isArray(o.name)
              ? o.name.includes(flagLower)
              : o.name === flagLower,
          )
          if (opt?.args) {
            argIdx++
          }
        }
        continue
      }
      // Positional arg that isn't the expected word → arg was split.
      return null
    }
    if (argIdx >= cmd.args.length) return null
    argIdx++
  }

  // Bare-root guard: buildPrefix returns 'git' for `git` with no subcommand
  // found (empty args, or only global flags). That's too broad — would
  // auto-allow `git push --force` forever. Bash's extractor doesn't gate this
  // (bash/prefix.ts:363, separate fix). Reject single-word results for
  // commands whose spec declares subcommands OR that have DEPTH_RULES entries
  // (gcloud, aws, kubectl, etc.) which implies subcommand structure even
  // without a loaded spec. (bug #17)
  if (
    !prefix.includes(' ') &&
    (spec?.subcommands?.length || DEPTH_RULES[nameLower])
  ) {
    return null
  }
  return prefix
}

/**
 * Extract a prefix suggestion for a PowerShell command.
 *
 * Parses the command, takes the first CommandAst, returns a prefix suitable
 * for the permission dialog's "don't ask again for: ___" editable input.
 * Returns null when no safe prefix can be extracted (parse failure, shell
 * invocation, path-like name, bare subcommand-aware command).
 */
export async function getCommandPrefixStatic(
  command: string,
): Promise<{ commandPrefix: string | null } | null> {
  const parsed = await parsePowerShellCommand(command)
  if (!parsed.valid) {
    return null
  }

  // Find the first actual command (CommandAst). getAllCommands iterates
  // both statement.commands and statement.nestedCommands (for &&/||/if/for).
  // Skip synthetic CommandExpressionAst entries (expression pipeline sources,
  // non-PipelineAst statement placeholders).
  const firstCommand = getAllCommands(parsed).find(
    cmd => cmd.elementType === 'CommandAst',
  )
  if (!firstCommand) {
    return { commandPrefix: null }
  }

  return { commandPrefix: await extractPrefixFromElement(firstCommand) }
}

/**
 * Extract prefixes for all subcommands in a compound PowerShell command.
 *
 * For `Get-Process; git status && npm test`, returns per-subcommand prefixes.
 * Subcommands for which `excludeSubcommand` returns true (e.g. already
 * read-only/auto-allowed) are skipped — no point suggesting a rule for them.
 * Prefixes sharing a root are collapsed via word-aligned LCP:
 * `npm run test && npm run lint` → `npm run`.
 *
 * The filter receives the ParsedCommandElement (not cmd.text) because
 * PowerShell's read-only check (isAllowlistedCommand) needs the element's
 * structured fields (nameType, args). Passing text would require reparsing,
 * which spawns pwsh.exe per subcommand — expensive and wasteful since we
 * already have the parsed elements here. Bash's equivalent passes text
 * because BashTool.isReadOnly works from regex/patterns, not parsed AST.
 */
export async function getCompoundCommandPrefixesStatic(
  command: string,
  excludeSubcommand?: (element: ParsedCommandElement) => boolean,
): Promise<string[]> {
  const parsed = await parsePowerShellCommand(command)
  if (!parsed.valid) {
    return []
  }

  const commands = getAllCommands(parsed).filter(
    cmd => cmd.elementType === 'CommandAst',
  )

  // Single command — no compound collapse needed.
  if (commands.length <= 1) {
    const prefix = commands[0]
      ? await extractPrefixFromElement(commands[0])
      : null
    return prefix ? [prefix] : []
  }

  const prefixes: string[] = []
  for (const cmd of commands) {
    if (excludeSubcommand?.(cmd)) {
      continue
    }
    const prefix = await extractPrefixFromElement(cmd)
    if (prefix) {
      prefixes.push(prefix)
    }
  }

  if (prefixes.length === 0) {
    return []
  }

  // Group by root command (first word) and collapse each group via
  // word-aligned longest common prefix. `npm run test` + `npm run lint`
  // → `npm run`. But NEVER collapse down to a bare subcommand-aware root:
  // `git add` + `git commit` would LCP to `git`, which extractPrefixFromElement
  // explicitly refuses as too broad (line ~119). Collapsing through that gate
  // would suggest PowerShell(git:*) → auto-allows git push --force forever.
  // When LCP yields a bare subcommand-aware root, drop the group entirely
  // rather than suggest either the too-broad root or N un-collapsed rules.
  //
  // Bash's getCompoundCommandPrefixesStatic has this same collapse without
  // the guard (src/utils/bash/prefix.ts:360-365) — that's a separate fix.
  //
  // Grouping and word-comparison are case-insensitive (PowerShell is
  // case-insensitive: Git === git, Get-Process === get-process). The Map key
  // is lowercased; the emitted prefix keeps the first-seen casing.
  const groups = new Map<string, string[]>()
  for (const prefix of prefixes) {
    const root = prefix.split(' ')[0]!
    const key = root.toLowerCase()
    const group = groups.get(key)
    if (group) {
      group.push(prefix)
    } else {
      groups.set(key, [prefix])
    }
  }

  const collapsed: string[] = []
  for (const [rootLower, group] of groups) {
    const lcp = wordAlignedLCP(group)
    const lcpWordCount = lcp === '' ? 0 : countCharInString(lcp, ' ') + 1
    if (lcpWordCount <= 1) {
      // LCP collapsed to a single word. If that root's fig spec declares
      // subcommands, this is the same too-broad case extractPrefixFromElement
      // rejects (bare `git` → allows `git push --force`). Drop the group.
      // getCommandSpec is LRU-memoized; one lookup per distinct root.
      const rootSpec = await getCommandSpec(rootLower)
      if (rootSpec?.subcommands?.length || DEPTH_RULES[rootLower]) {
        continue
      }
    }
    collapsed.push(lcp)
  }
  return collapsed
}

/**
 * Word-aligned longest common prefix. Doesn't chop mid-word.
 * Case-insensitive comparison (PowerShell: Git === git), emits first
 * string's casing.
 * ["npm run test", "npm run lint"] → "npm run"
 * ["Git status", "git log"] → "Git" (first-seen casing)
 * ["Get-Process"] → "Get-Process"
 */
function wordAlignedLCP(strings: string[]): string {
  if (strings.length === 0) return ''
  if (strings.length === 1) return strings[0]!

  const firstWords = strings[0]!.split(' ')
  let commonWordCount = firstWords.length

  for (let i = 1; i < strings.length; i++) {
    const words = strings[i]!.split(' ')
    let matchCount = 0
    while (
      matchCount < commonWordCount &&
      matchCount < words.length &&
      words[matchCount]!.toLowerCase() === firstWords[matchCount]!.toLowerCase()
    ) {
      matchCount++
    }
    commonWordCount = matchCount
    if (commonWordCount === 0) break
  }

  return firstWords.slice(0, commonWordCount).join(' ')
}
