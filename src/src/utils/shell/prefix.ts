/**
 * Shared command prefix extraction using Haiku LLM
 *
 * This module provides a factory for creating command prefix extractors
 * that can be used by different shell tools. The core logic
 * (Haiku query, response validation) is shared, while tool-specific
 * aspects (examples, pre-checks) are configurable.
 */

import chalk from 'chalk'
import type { QuerySource } from '../../constants/querySource.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { queryHaiku } from '../../services/api/claude.js'
import { startsWithApiErrorPrefix } from '../../services/api/errors.js'
import { memoizeWithLRU } from '../memoize.js'
import { jsonStringify } from '../slowOperations.js'
import { asSystemPrompt } from '../systemPromptType.js'

/**
 * Shell executables that must never be accepted as bare prefixes.
 * Allowing e.g. "bash:*" would let any command through, defeating
 * the permission system. Includes Unix shells and Windows equivalents.
 */
const DANGEROUS_SHELL_PREFIXES = new Set([
  'sh',
  'bash',
  'zsh',
  'fish',
  'csh',
  'tcsh',
  'ksh',
  'dash',
  'cmd',
  'cmd.exe',
  'powershell',
  'powershell.exe',
  'pwsh',
  'pwsh.exe',
  'bash.exe',
])

/**
 * Result of command prefix extraction
 */
export type CommandPrefixResult = {
  /** The detected command prefix, or null if no prefix could be determined */
  commandPrefix: string | null
}

/**
 * Result including subcommand prefixes for compound commands
 */
export type CommandSubcommandPrefixResult = CommandPrefixResult & {
  subcommandPrefixes: Map<string, CommandPrefixResult>
}

/**
 * Configuration for creating a command prefix extractor
 */
export type PrefixExtractorConfig = {
  /** Tool name for logging and warning messages */
  toolName: string

  /** The policy spec containing examples for Haiku */
  policySpec: string
  /** Analytics event name for logging */
  eventName: string

  /** Query source identifier for the API call */
  querySource: QuerySource

  /** Optional pre-check function that can short-circuit the Haiku call */
  preCheck?: (command: string) => CommandPrefixResult | null
}

/**
 * Creates a memoized command prefix extractor function.
 *
 * Uses two-layer memoization: the outer memoized function creates the promise
 * and attaches a .catch handler that evicts the cache entry on rejection.
 * This prevents aborted or failed Haiku calls from poisoning future lookups.
 *
 * Bounded to 200 entries via LRU to prevent unbounded growth in heavy sessions.
 *
 * @param config - Configuration for the extractor
 * @returns A memoized async function that extracts command prefixes
 */
export function createCommandPrefixExtractor(config: PrefixExtractorConfig) {
  const { toolName, policySpec, eventName, querySource, preCheck } = config

  const memoized = memoizeWithLRU(
    (
      command: string,
      abortSignal: AbortSignal,
      isNonInteractiveSession: boolean,
    ): Promise<CommandPrefixResult | null> => {
      const promise = getCommandPrefixImpl(
        command,
        abortSignal,
        isNonInteractiveSession,
        toolName,
        policySpec,
        eventName,
        querySource,
        preCheck,
      )
      // Evict on rejection so aborted calls don't poison future turns.
      // Identity guard: after LRU eviction, a newer promise may occupy
      // this key; a stale rejection must not delete it.
      promise.catch(() => {
        if (memoized.cache.get(command) === promise) {
          memoized.cache.delete(command)
        }
      })
      return promise
    },
    command => command, // memoize by command only
    200,
  )

  return memoized
}

/**
 * Creates a memoized function to get prefixes for compound commands with subcommands.
 *
 * Uses the same two-layer memoization pattern as createCommandPrefixExtractor:
 * a .catch handler evicts the cache entry on rejection to prevent poisoning.
 *
 * @param getPrefix - The single-command prefix extractor (from createCommandPrefixExtractor)
 * @param splitCommand - Function to split a compound command into subcommands
 * @returns A memoized async function that extracts prefixes for the main command and all subcommands
 */
export function createSubcommandPrefixExtractor(
  getPrefix: ReturnType<typeof createCommandPrefixExtractor>,
  splitCommand: (command: string) => string[] | Promise<string[]>,
) {
  const memoized = memoizeWithLRU(
    (
      command: string,
      abortSignal: AbortSignal,
      isNonInteractiveSession: boolean,
    ): Promise<CommandSubcommandPrefixResult | null> => {
      const promise = getCommandSubcommandPrefixImpl(
        command,
        abortSignal,
        isNonInteractiveSession,
        getPrefix,
        splitCommand,
      )
      // Evict on rejection so aborted calls don't poison future turns.
      // Identity guard: after LRU eviction, a newer promise may occupy
      // this key; a stale rejection must not delete it.
      promise.catch(() => {
        if (memoized.cache.get(command) === promise) {
          memoized.cache.delete(command)
        }
      })
      return promise
    },
    command => command, // memoize by command only
    200,
  )

  return memoized
}

async function getCommandPrefixImpl(
  command: string,
  abortSignal: AbortSignal,
  isNonInteractiveSession: boolean,
  toolName: string,
  policySpec: string,
  eventName: string,
  querySource: QuerySource,
  preCheck?: (command: string) => CommandPrefixResult | null,
): Promise<CommandPrefixResult | null> {
  if (process.env.NODE_ENV === 'test') {
    return null
  }

  // Run pre-check if provided (e.g., isHelpCommand for Bash)
  if (preCheck) {
    const preCheckResult = preCheck(command)
    if (preCheckResult !== null) {
      return preCheckResult
    }
  }

  let preflightCheckTimeoutId: NodeJS.Timeout | undefined
  const startTime = Date.now()
  let result: CommandPrefixResult | null = null

  try {
    // Log a warning if the pre-flight check takes too long
    preflightCheckTimeoutId = setTimeout(
      (tn, nonInteractive) => {
        const message = `[${tn}Tool] Pre-flight check is taking longer than expected. Run with ANTHROPIC_LOG=debug to check for failed or slow API requests.`
        if (nonInteractive) {
          process.stderr.write(jsonStringify({ level: 'warn', message }) + '\n')
        } else {
          // biome-ignore lint/suspicious/noConsole: intentional warning
          console.warn(chalk.yellow(`⚠️  ${message}`))
        }
      },
      10000, // 10 seconds
      toolName,
      isNonInteractiveSession,
    )

    const useSystemPromptPolicySpec = getFeatureValue_CACHED_MAY_BE_STALE(
      'tengu_cork_m4q',
      false,
    )

    const response = await queryHaiku({
      systemPrompt: asSystemPrompt(
        useSystemPromptPolicySpec
          ? [
              `Your task is to process ${toolName} commands that an AI coding agent wants to run.\n\n${policySpec}`,
            ]
          : [
              `Your task is to process ${toolName} commands that an AI coding agent wants to run.\n\nThis policy spec defines how to determine the prefix of a ${toolName} command:`,
            ],
      ),
      userPrompt: useSystemPromptPolicySpec
        ? `Command: ${command}`
        : `${policySpec}\n\nCommand: ${command}`,
      signal: abortSignal,
      options: {
        enablePromptCaching: useSystemPromptPolicySpec,
        querySource,
        agents: [],
        isNonInteractiveSession,
        hasAppendSystemPrompt: false,
        mcpTools: [],
      },
    })

    // Clear the timeout since the query completed
    clearTimeout(preflightCheckTimeoutId)
    const durationMs = Date.now() - startTime

    const prefix =
      typeof response.message.content === 'string'
        ? response.message.content
        : Array.isArray(response.message.content)
          ? (response.message.content.find(_ => _.type === 'text')?.text ??
            'none')
          : 'none'

    if (startsWithApiErrorPrefix(prefix)) {
      logEvent(eventName, {
        success: false,
        error:
          'API error' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        durationMs,
      })
      result = null
    } else if (prefix === 'command_injection_detected') {
      // Haiku detected something suspicious - treat as no prefix available
      logEvent(eventName, {
        success: false,
        error:
          'command_injection_detected' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        durationMs,
      })
      result = {
        commandPrefix: null,
      }
    } else if (
      prefix === 'git' ||
      DANGEROUS_SHELL_PREFIXES.has(prefix.toLowerCase())
    ) {
      // Never accept bare `git` or shell executables as a prefix
      logEvent(eventName, {
        success: false,
        error:
          'dangerous_shell_prefix' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        durationMs,
      })
      result = {
        commandPrefix: null,
      }
    } else if (prefix === 'none') {
      // No prefix detected
      logEvent(eventName, {
        success: false,
        error:
          'prefix "none"' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        durationMs,
      })
      result = {
        commandPrefix: null,
      }
    } else {
      // Validate that the prefix is actually a prefix of the command

      if (!command.startsWith(prefix)) {
        // Prefix isn't actually a prefix of the command
        logEvent(eventName, {
          success: false,
          error:
            'command did not start with prefix' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          durationMs,
        })
        result = {
          commandPrefix: null,
        }
      } else {
        logEvent(eventName, {
          success: true,
          durationMs,
        })
        result = {
          commandPrefix: prefix,
        }
      }
    }

    return result
  } catch (error) {
    clearTimeout(preflightCheckTimeoutId)
    throw error
  }
}

async function getCommandSubcommandPrefixImpl(
  command: string,
  abortSignal: AbortSignal,
  isNonInteractiveSession: boolean,
  getPrefix: ReturnType<typeof createCommandPrefixExtractor>,
  splitCommandFn: (command: string) => string[] | Promise<string[]>,
): Promise<CommandSubcommandPrefixResult | null> {
  const subcommands = await splitCommandFn(command)

  const [fullCommandPrefix, ...subcommandPrefixesResults] = await Promise.all([
    getPrefix(command, abortSignal, isNonInteractiveSession),
    ...subcommands.map(async subcommand => ({
      subcommand,
      prefix: await getPrefix(subcommand, abortSignal, isNonInteractiveSession),
    })),
  ])

  if (!fullCommandPrefix) {
    return null
  }

  const subcommandPrefixes = subcommandPrefixesResults.reduce(
    (acc, { subcommand, prefix }) => {
      if (prefix) {
        acc.set(subcommand, prefix)
      }
      return acc
    },
    new Map<string, CommandPrefixResult>(),
  )

  return {
    ...fullCommandPrefix,
    subcommandPrefixes,
  }
}
