/**
 * Session file access analytics hooks.
 * Tracks access to session memory and transcript files via Read, Grep, Glob tools.
 * Also tracks memdir file access via Read, Grep, Glob, Edit, and Write tools.
 */
import { feature } from 'bun:bundle'
import { registerHookCallbacks } from '../bootstrap/state.js'
import type { HookInput, HookJSONOutput } from '../entrypoints/agentSdkTypes.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import { FILE_EDIT_TOOL_NAME } from '../tools/FileEditTool/constants.js'
import { inputSchema as editInputSchema } from '../tools/FileEditTool/types.js'
import { FileReadTool } from '../tools/FileReadTool/FileReadTool.js'
import { FILE_READ_TOOL_NAME } from '../tools/FileReadTool/prompt.js'
import { FileWriteTool } from '../tools/FileWriteTool/FileWriteTool.js'
import { FILE_WRITE_TOOL_NAME } from '../tools/FileWriteTool/prompt.js'
import { GlobTool } from '../tools/GlobTool/GlobTool.js'
import { GLOB_TOOL_NAME } from '../tools/GlobTool/prompt.js'
import { GrepTool } from '../tools/GrepTool/GrepTool.js'
import { GREP_TOOL_NAME } from '../tools/GrepTool/prompt.js'
import type { HookCallback } from '../types/hooks.js'
import {
  detectSessionFileType,
  detectSessionPatternType,
  isAutoMemFile,
  memoryScopeForPath,
} from './memoryFileDetection.js'

/* eslint-disable @typescript-eslint/no-require-imports */
const teamMemPaths = feature('TEAMMEM')
  ? (require('../memdir/teamMemPaths.js') as typeof import('../memdir/teamMemPaths.js'))
  : null
const teamMemWatcher = feature('TEAMMEM')
  ? (require('../services/teamMemorySync/watcher.js') as typeof import('../services/teamMemorySync/watcher.js'))
  : null
const memoryShapeTelemetry = feature('MEMORY_SHAPE_TELEMETRY')
  ? (require('../memdir/memoryShapeTelemetry.js') as typeof import('../memdir/memoryShapeTelemetry.js'))
  : null

/* eslint-enable @typescript-eslint/no-require-imports */
import { getSubagentLogName } from './agentContext.js'

/**
 * Extract the file path from a tool input for memdir detection.
 * Covers Read (file_path), Edit (file_path), and Write (file_path).
 */
function getFilePathFromInput(
  toolName: string,
  toolInput: unknown,
): string | null {
  switch (toolName) {
    case FILE_READ_TOOL_NAME: {
      const parsed = FileReadTool.inputSchema.safeParse(toolInput)
      return parsed.success ? parsed.data.file_path : null
    }
    case FILE_EDIT_TOOL_NAME: {
      const parsed = editInputSchema().safeParse(toolInput)
      return parsed.success ? parsed.data.file_path : null
    }
    case FILE_WRITE_TOOL_NAME: {
      const parsed = FileWriteTool.inputSchema.safeParse(toolInput)
      return parsed.success ? parsed.data.file_path : null
    }
    default:
      return null
  }
}

/**
 * Extract file type from tool input.
 * Returns the detected session file type or null.
 */
function getSessionFileTypeFromInput(
  toolName: string,
  toolInput: unknown,
): 'session_memory' | 'session_transcript' | null {
  switch (toolName) {
    case FILE_READ_TOOL_NAME: {
      const parsed = FileReadTool.inputSchema.safeParse(toolInput)
      if (!parsed.success) return null
      return detectSessionFileType(parsed.data.file_path)
    }
    case GREP_TOOL_NAME: {
      const parsed = GrepTool.inputSchema.safeParse(toolInput)
      if (!parsed.success) return null
      // Check path if provided
      if (parsed.data.path) {
        const pathType = detectSessionFileType(parsed.data.path)
        if (pathType) return pathType
      }
      // Check glob pattern
      if (parsed.data.glob) {
        const globType = detectSessionPatternType(parsed.data.glob)
        if (globType) return globType
      }
      return null
    }
    case GLOB_TOOL_NAME: {
      const parsed = GlobTool.inputSchema.safeParse(toolInput)
      if (!parsed.success) return null
      // Check path if provided
      if (parsed.data.path) {
        const pathType = detectSessionFileType(parsed.data.path)
        if (pathType) return pathType
      }
      // Check pattern
      const patternType = detectSessionPatternType(parsed.data.pattern)
      if (patternType) return patternType
      return null
    }
    default:
      return null
  }
}

/**
 * Check if a tool use constitutes a memory file access.
 * Detects session memory (via Read/Grep/Glob) and memdir access (via Read/Edit/Write).
 * Uses the same conditions as the PostToolUse session file access hooks.
 */
export function isMemoryFileAccess(
  toolName: string,
  toolInput: unknown,
): boolean {
  if (getSessionFileTypeFromInput(toolName, toolInput) === 'session_memory') {
    return true
  }

  const filePath = getFilePathFromInput(toolName, toolInput)
  if (
    filePath &&
    (isAutoMemFile(filePath) ||
      (feature('TEAMMEM') && teamMemPaths!.isTeamMemFile(filePath)))
  ) {
    return true
  }

  return false
}

/**
 * PostToolUse callback to log session file access events.
 */
async function handleSessionFileAccess(
  input: HookInput,
  _toolUseID: string | null,
  _signal: AbortSignal | undefined,
): Promise<HookJSONOutput> {
  if (input.hook_event_name !== 'PostToolUse') return {}

  const fileType = getSessionFileTypeFromInput(
    input.tool_name,
    input.tool_input,
  )

  const subagentName = getSubagentLogName()
  const subagentProps = subagentName ? { subagent_name: subagentName } : {}

  if (fileType === 'session_memory') {
    logEvent('tengu_session_memory_accessed', { ...subagentProps })
  } else if (fileType === 'session_transcript') {
    logEvent('tengu_transcript_accessed', { ...subagentProps })
  }

  // Memdir access tracking
  const filePath = getFilePathFromInput(input.tool_name, input.tool_input)
  if (filePath && isAutoMemFile(filePath)) {
    logEvent('tengu_memdir_accessed', {
      tool: input.tool_name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...subagentProps,
    })

    switch (input.tool_name) {
      case FILE_READ_TOOL_NAME:
        logEvent('tengu_memdir_file_read', { ...subagentProps })
        break
      case FILE_EDIT_TOOL_NAME:
        logEvent('tengu_memdir_file_edit', { ...subagentProps })
        break
      case FILE_WRITE_TOOL_NAME:
        logEvent('tengu_memdir_file_write', { ...subagentProps })
        break
    }
  }

  // Team memory access tracking
  if (feature('TEAMMEM') && filePath && teamMemPaths!.isTeamMemFile(filePath)) {
    logEvent('tengu_team_mem_accessed', {
      tool: input.tool_name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...subagentProps,
    })

    switch (input.tool_name) {
      case FILE_READ_TOOL_NAME:
        logEvent('tengu_team_mem_file_read', { ...subagentProps })
        break
      case FILE_EDIT_TOOL_NAME:
        logEvent('tengu_team_mem_file_edit', { ...subagentProps })
        teamMemWatcher?.notifyTeamMemoryWrite()
        break
      case FILE_WRITE_TOOL_NAME:
        logEvent('tengu_team_mem_file_write', { ...subagentProps })
        teamMemWatcher?.notifyTeamMemoryWrite()
        break
    }
  }

  if (feature('MEMORY_SHAPE_TELEMETRY') && filePath) {
    const scope = memoryScopeForPath(filePath)
    if (
      scope !== null &&
      (input.tool_name === FILE_EDIT_TOOL_NAME ||
        input.tool_name === FILE_WRITE_TOOL_NAME)
    ) {
      memoryShapeTelemetry!.logMemoryWriteShape(
        input.tool_name,
        input.tool_input,
        filePath,
        scope,
      )
    }
  }

  return {}
}

/**
 * Register session file access tracking hooks.
 * Called during CLI initialization.
 */
export function registerSessionFileAccessHooks(): void {
  const hook: HookCallback = {
    type: 'callback',
    callback: handleSessionFileAccess,
    timeout: 1, // Very short timeout - just logging
    internal: true,
  }

  registerHookCallbacks({
    PostToolUse: [
      { matcher: FILE_READ_TOOL_NAME, hooks: [hook] },
      { matcher: GREP_TOOL_NAME, hooks: [hook] },
      { matcher: GLOB_TOOL_NAME, hooks: [hook] },
      { matcher: FILE_EDIT_TOOL_NAME, hooks: [hook] },
      { matcher: FILE_WRITE_TOOL_NAME, hooks: [hook] },
    ],
  })
}
