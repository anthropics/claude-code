/**
 * Fig-spec-driven command prefix extraction.
 *
 * Given a command name + args array + its @withfig/autocomplete spec, walks
 * the spec to find how deep into the args a meaningful prefix extends.
 * `git -C /repo status --short` → `git status` (spec says -C takes a value,
 * skip it, find `status` as a known subcommand).
 *
 * Pure over (string, string[], CommandSpec) — no parser dependency. Extracted
 * from src/utils/bash/prefix.ts so PowerShell's extractor can reuse it;
 * external CLIs (git, npm, kubectl) are shell-agnostic.
 */

import type { CommandSpec } from '../bash/registry.js'

const URL_PROTOCOLS = ['http://', 'https://', 'ftp://']

// Overrides for commands whose fig specs aren't available at runtime
// (dynamic imports don't work in native/node builds). Without these,
// calculateDepth falls back to 2, producing overly broad prefixes.
export const DEPTH_RULES: Record<string, number> = {
  rg: 2, // pattern argument is required despite variadic paths
  'pre-commit': 2,
  // CLI tools with deep subcommand trees (e.g. gcloud scheduler jobs list)
  gcloud: 4,
  'gcloud compute': 6,
  'gcloud beta': 6,
  aws: 4,
  az: 4,
  kubectl: 3,
  docker: 3,
  dotnet: 3,
  'git push': 2,
}

const toArray = <T>(val: T | T[]): T[] => (Array.isArray(val) ? val : [val])

// Check if an argument matches a known subcommand (case-insensitive: PS
// callers pass original-cased args; fig spec names are lowercase)
function isKnownSubcommand(arg: string, spec: CommandSpec | null): boolean {
  if (!spec?.subcommands?.length) return false
  const argLower = arg.toLowerCase()
  return spec.subcommands.some(sub =>
    Array.isArray(sub.name)
      ? sub.name.some(n => n.toLowerCase() === argLower)
      : sub.name.toLowerCase() === argLower,
  )
}

// Check if a flag takes an argument based on spec, or use heuristic
function flagTakesArg(
  flag: string,
  nextArg: string | undefined,
  spec: CommandSpec | null,
): boolean {
  // Check if flag is in spec.options
  if (spec?.options) {
    const option = spec.options.find(opt =>
      Array.isArray(opt.name) ? opt.name.includes(flag) : opt.name === flag,
    )
    if (option) return !!option.args
  }
  // Heuristic: if next arg isn't a flag and isn't a known subcommand, assume it's a flag value
  if (spec?.subcommands?.length && nextArg && !nextArg.startsWith('-')) {
    return !isKnownSubcommand(nextArg, spec)
  }
  return false
}

// Find the first subcommand by skipping flags and their values
function findFirstSubcommand(
  args: string[],
  spec: CommandSpec | null,
): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg) continue
    if (arg.startsWith('-')) {
      if (flagTakesArg(arg, args[i + 1], spec)) i++
      continue
    }
    if (!spec?.subcommands?.length) return arg
    if (isKnownSubcommand(arg, spec)) return arg
  }
  return undefined
}

export async function buildPrefix(
  command: string,
  args: string[],
  spec: CommandSpec | null,
): Promise<string> {
  const maxDepth = await calculateDepth(command, args, spec)
  const parts = [command]
  const hasSubcommands = !!spec?.subcommands?.length
  let foundSubcommand = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg || parts.length >= maxDepth) break

    if (arg.startsWith('-')) {
      // Special case: python -c should stop after -c
      if (arg === '-c' && ['python', 'python3'].includes(command.toLowerCase()))
        break

      // Check for isCommand/isModule flags that should be included in prefix
      if (spec?.options) {
        const option = spec.options.find(opt =>
          Array.isArray(opt.name) ? opt.name.includes(arg) : opt.name === arg,
        )
        if (
          option?.args &&
          toArray(option.args).some(a => a?.isCommand || a?.isModule)
        ) {
          parts.push(arg)
          continue
        }
      }

      // For commands with subcommands, skip global flags to find the subcommand
      if (hasSubcommands && !foundSubcommand) {
        if (flagTakesArg(arg, args[i + 1], spec)) i++
        continue
      }
      break // Stop at flags (original behavior)
    }

    if (await shouldStopAtArg(arg, args.slice(0, i), spec)) break
    if (hasSubcommands && !foundSubcommand) {
      foundSubcommand = isKnownSubcommand(arg, spec)
    }
    parts.push(arg)
  }

  return parts.join(' ')
}

async function calculateDepth(
  command: string,
  args: string[],
  spec: CommandSpec | null,
): Promise<number> {
  // Find first subcommand by skipping flags and their values
  const firstSubcommand = findFirstSubcommand(args, spec)
  const commandLower = command.toLowerCase()
  const key = firstSubcommand
    ? `${commandLower} ${firstSubcommand.toLowerCase()}`
    : commandLower
  if (DEPTH_RULES[key]) return DEPTH_RULES[key]
  if (DEPTH_RULES[commandLower]) return DEPTH_RULES[commandLower]
  if (!spec) return 2

  if (spec.options && args.some(arg => arg?.startsWith('-'))) {
    for (const arg of args) {
      if (!arg?.startsWith('-')) continue
      const option = spec.options.find(opt =>
        Array.isArray(opt.name) ? opt.name.includes(arg) : opt.name === arg,
      )
      if (
        option?.args &&
        toArray(option.args).some(arg => arg?.isCommand || arg?.isModule)
      )
        return 3
    }
  }

  // Find subcommand spec using the already-found firstSubcommand
  if (firstSubcommand && spec.subcommands?.length) {
    const firstSubLower = firstSubcommand.toLowerCase()
    const subcommand = spec.subcommands.find(sub =>
      Array.isArray(sub.name)
        ? sub.name.some(n => n.toLowerCase() === firstSubLower)
        : sub.name.toLowerCase() === firstSubLower,
    )
    if (subcommand) {
      if (subcommand.args) {
        const subArgs = toArray(subcommand.args)
        if (subArgs.some(arg => arg?.isCommand)) return 3
        if (subArgs.some(arg => arg?.isVariadic)) return 2
      }
      if (subcommand.subcommands?.length) return 4
      // Leaf subcommand with NO args declared (git show, git log, git tag):
      // the 3rd word is transient (SHA, ref, tag name) → dead over-specific
      // rule like PowerShell(git show 81210f8:*). NOT the isOptional case —
      // `git fetch` declares optional remote/branch and `git fetch origin`
      // is tested (bash/prefix.test.ts:912) as intentional remote scoping.
      if (!subcommand.args) return 2
      return 3
    }
  }

  if (spec.args) {
    const argsArray = toArray(spec.args)

    if (argsArray.some(arg => arg?.isCommand)) {
      return !Array.isArray(spec.args) && spec.args.isCommand
        ? 2
        : Math.min(2 + argsArray.findIndex(arg => arg?.isCommand), 3)
    }

    if (!spec.subcommands?.length) {
      if (argsArray.some(arg => arg?.isVariadic)) return 1
      if (argsArray[0] && !argsArray[0].isOptional) return 2
    }
  }

  return spec.args && toArray(spec.args).some(arg => arg?.isDangerous) ? 3 : 2
}

async function shouldStopAtArg(
  arg: string,
  args: string[],
  spec: CommandSpec | null,
): Promise<boolean> {
  if (arg.startsWith('-')) return true

  const dotIndex = arg.lastIndexOf('.')
  const hasExtension =
    dotIndex > 0 &&
    dotIndex < arg.length - 1 &&
    !arg.substring(dotIndex + 1).includes(':')

  const hasFile = arg.includes('/') || hasExtension
  const hasUrl = URL_PROTOCOLS.some(proto => arg.startsWith(proto))

  if (!hasFile && !hasUrl) return false

  // Check if we're after a -m flag for python modules
  if (spec?.options && args.length > 0 && args[args.length - 1] === '-m') {
    const option = spec.options.find(opt =>
      Array.isArray(opt.name) ? opt.name.includes('-m') : opt.name === '-m',
    )
    if (option?.args && toArray(option.args).some(arg => arg?.isModule)) {
      return false // Don't stop at module names
    }
  }

  // For actual files/URLs, always stop regardless of context
  return true
}
