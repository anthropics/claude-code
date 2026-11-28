import type { z } from 'zod/v4'
import {
  isUnsafeCompoundCommand_DEPRECATED,
  splitCommand_DEPRECATED,
} from '../../utils/bash/commands.js'
import {
  buildParsedCommandFromRoot,
  type IParsedCommand,
  ParsedCommand,
} from '../../utils/bash/ParsedCommand.js'
import { type Node, PARSE_ABORTED } from '../../utils/bash/parser.js'
import type { PermissionResult } from '../../utils/permissions/PermissionResult.js'
import type { PermissionUpdate } from '../../utils/permissions/PermissionUpdateSchema.js'
import { createPermissionRequestMessage } from '../../utils/permissions/permissions.js'
import { BashTool } from './BashTool.js'
import { bashCommandIsSafeAsync_DEPRECATED } from './bashSecurity.js'

export type CommandIdentityCheckers = {
  isNormalizedCdCommand: (command: string) => boolean
  isNormalizedGitCommand: (command: string) => boolean
}

async function segmentedCommandPermissionResult(
  input: z.infer<typeof BashTool.inputSchema>,
  segments: string[],
  bashToolHasPermissionFn: (
    input: z.infer<typeof BashTool.inputSchema>,
  ) => Promise<PermissionResult>,
  checkers: CommandIdentityCheckers,
): Promise<PermissionResult> {
  // Check for multiple cd commands across all segments
  const cdCommands = segments.filter(segment => {
    const trimmed = segment.trim()
    return checkers.isNormalizedCdCommand(trimmed)
  })
  if (cdCommands.length > 1) {
    const decisionReason = {
      type: 'other' as const,
      reason:
        'Multiple directory changes in one command require approval for clarity',
    }
    return {
      behavior: 'ask',
      decisionReason,
      message: createPermissionRequestMessage(BashTool.name, decisionReason),
    }
  }

  // SECURITY: Check for cd+git across pipe segments to prevent bare repo fsmonitor bypass.
  // When cd and git are in different pipe segments (e.g., "cd sub && echo | git status"),
  // each segment is checked independently and neither triggers the cd+git check in
  // bashPermissions.ts. We must detect this cross-segment pattern here.
  // Each pipe segment can itself be a compound command (e.g., "cd sub && echo"),
  // so we split each segment into subcommands before checking.
  {
    let hasCd = false
    let hasGit = false
    for (const segment of segments) {
      const subcommands = splitCommand_DEPRECATED(segment)
      for (const sub of subcommands) {
        const trimmed = sub.trim()
        if (checkers.isNormalizedCdCommand(trimmed)) {
          hasCd = true
        }
        if (checkers.isNormalizedGitCommand(trimmed)) {
          hasGit = true
        }
      }
    }
    if (hasCd && hasGit) {
      const decisionReason = {
        type: 'other' as const,
        reason:
          'Compound commands with cd and git require approval to prevent bare repository attacks',
      }
      return {
        behavior: 'ask',
        decisionReason,
        message: createPermissionRequestMessage(BashTool.name, decisionReason),
      }
    }
  }

  const segmentResults = new Map<string, PermissionResult>()

  // Check each segment through the full permission system
  for (const segment of segments) {
    const trimmedSegment = segment.trim()
    if (!trimmedSegment) continue // Skip empty segments

    const segmentResult = await bashToolHasPermissionFn({
      ...input,
      command: trimmedSegment,
    })
    segmentResults.set(trimmedSegment, segmentResult)
  }

  // Check if any segment is denied (after evaluating all)
  const deniedSegment = Array.from(segmentResults.entries()).find(
    ([, result]) => result.behavior === 'deny',
  )

  if (deniedSegment) {
    const [segmentCommand, segmentResult] = deniedSegment
    return {
      behavior: 'deny',
      message:
        segmentResult.behavior === 'deny'
          ? segmentResult.message
          : `Permission denied for: ${segmentCommand}`,
      decisionReason: {
        type: 'subcommandResults',
        reasons: segmentResults,
      },
    }
  }

  const allAllowed = Array.from(segmentResults.values()).every(
    result => result.behavior === 'allow',
  )

  if (allAllowed) {
    return {
      behavior: 'allow',
      updatedInput: input,
      decisionReason: {
        type: 'subcommandResults',
        reasons: segmentResults,
      },
    }
  }

  // Collect suggestions from segments that need approval
  const suggestions: PermissionUpdate[] = []
  for (const [, result] of segmentResults) {
    if (
      result.behavior !== 'allow' &&
      'suggestions' in result &&
      result.suggestions
    ) {
      suggestions.push(...result.suggestions)
    }
  }

  const decisionReason = {
    type: 'subcommandResults' as const,
    reasons: segmentResults,
  }

  return {
    behavior: 'ask',
    message: createPermissionRequestMessage(BashTool.name, decisionReason),
    decisionReason,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  }
}

/**
 * Builds a command segment, stripping output redirections to avoid
 * treating filenames as commands in permission checking.
 * Uses ParsedCommand to preserve original quoting.
 */
async function buildSegmentWithoutRedirections(
  segmentCommand: string,
): Promise<string> {
  // Fast path: skip parsing if no redirection operators present
  if (!segmentCommand.includes('>')) {
    return segmentCommand
  }

  // Use ParsedCommand to strip redirections while preserving quotes
  const parsed = await ParsedCommand.parse(segmentCommand)
  return parsed?.withoutOutputRedirections() ?? segmentCommand
}

/**
 * Wrapper that resolves an IParsedCommand (from a pre-parsed AST root if
 * available, else via ParsedCommand.parse) and delegates to
 * bashToolCheckCommandOperatorPermissions.
 */
export async function checkCommandOperatorPermissions(
  input: z.infer<typeof BashTool.inputSchema>,
  bashToolHasPermissionFn: (
    input: z.infer<typeof BashTool.inputSchema>,
  ) => Promise<PermissionResult>,
  checkers: CommandIdentityCheckers,
  astRoot: Node | null | typeof PARSE_ABORTED,
): Promise<PermissionResult> {
  const parsed =
    astRoot && astRoot !== PARSE_ABORTED
      ? buildParsedCommandFromRoot(input.command, astRoot)
      : await ParsedCommand.parse(input.command)
  if (!parsed) {
    return { behavior: 'passthrough', message: 'Failed to parse command' }
  }
  return bashToolCheckCommandOperatorPermissions(
    input,
    bashToolHasPermissionFn,
    checkers,
    parsed,
  )
}

/**
 * Checks if the command has special operators that require behavior beyond
 * simple subcommand checking.
 */
async function bashToolCheckCommandOperatorPermissions(
  input: z.infer<typeof BashTool.inputSchema>,
  bashToolHasPermissionFn: (
    input: z.infer<typeof BashTool.inputSchema>,
  ) => Promise<PermissionResult>,
  checkers: CommandIdentityCheckers,
  parsed: IParsedCommand,
): Promise<PermissionResult> {
  // 1. Check for unsafe compound commands (subshells, command groups).
  const tsAnalysis = parsed.getTreeSitterAnalysis()
  const isUnsafeCompound = tsAnalysis
    ? tsAnalysis.compoundStructure.hasSubshell ||
      tsAnalysis.compoundStructure.hasCommandGroup
    : isUnsafeCompoundCommand_DEPRECATED(input.command)
  if (isUnsafeCompound) {
    // This command contains an operator like `>` that we don't support as a subcommand separator
    // Check if bashCommandIsSafe_DEPRECATED has a more specific message
    const safetyResult = await bashCommandIsSafeAsync_DEPRECATED(input.command)

    const decisionReason = {
      type: 'other' as const,
      reason:
        safetyResult.behavior === 'ask' && safetyResult.message
          ? safetyResult.message
          : 'This command uses shell operators that require approval for safety',
    }
    return {
      behavior: 'ask',
      message: createPermissionRequestMessage(BashTool.name, decisionReason),
      decisionReason,
      // This is an unsafe compound command, so we don't want to suggest rules since we wont be able to allow it
    }
  }

  // 2. Check for piped commands using ParsedCommand (preserves quotes)
  const pipeSegments = parsed.getPipeSegments()

  // If no pipes (single segment), let normal flow handle it
  if (pipeSegments.length <= 1) {
    return {
      behavior: 'passthrough',
      message: 'No pipes found in command',
    }
  }

  // Strip output redirections from each segment while preserving quotes
  const segments = await Promise.all(
    pipeSegments.map(segment => buildSegmentWithoutRedirections(segment)),
  )

  // Handle as segmented command
  return segmentedCommandPermissionResult(
    input,
    segments,
    bashToolHasPermissionFn,
    checkers,
  )
}
