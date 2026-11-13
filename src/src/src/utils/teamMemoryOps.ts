import { isTeamMemFile } from '../memdir/teamMemPaths.js'
import { FILE_EDIT_TOOL_NAME } from '../tools/FileEditTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../tools/FileWriteTool/prompt.js'

export { isTeamMemFile }

/**
 * Check if a search tool use targets team memory files by examining its path.
 */
export function isTeamMemorySearch(toolInput: unknown): boolean {
  const input = toolInput as
    | { path?: string; pattern?: string; glob?: string }
    | undefined
  if (!input) {
    return false
  }
  if (input.path && isTeamMemFile(input.path)) {
    return true
  }
  return false
}

/**
 * Check if a Write or Edit tool use targets a team memory file.
 */
export function isTeamMemoryWriteOrEdit(
  toolName: string,
  toolInput: unknown,
): boolean {
  if (toolName !== FILE_WRITE_TOOL_NAME && toolName !== FILE_EDIT_TOOL_NAME) {
    return false
  }
  const input = toolInput as { file_path?: string; path?: string } | undefined
  const filePath = input?.file_path ?? input?.path
  return filePath !== undefined && isTeamMemFile(filePath)
}

/**
 * Append team memory summary parts to the parts array.
 * Encapsulates all team memory verb/string logic for getSearchReadSummaryText.
 */
export function appendTeamMemorySummaryParts(
  memoryCounts: {
    teamMemoryReadCount?: number
    teamMemorySearchCount?: number
    teamMemoryWriteCount?: number
  },
  isActive: boolean,
  parts: string[],
): void {
  const teamReadCount = memoryCounts.teamMemoryReadCount ?? 0
  const teamSearchCount = memoryCounts.teamMemorySearchCount ?? 0
  const teamWriteCount = memoryCounts.teamMemoryWriteCount ?? 0
  if (teamReadCount > 0) {
    const verb = isActive
      ? parts.length === 0
        ? 'Recalling'
        : 'recalling'
      : parts.length === 0
        ? 'Recalled'
        : 'recalled'
    parts.push(
      `${verb} ${teamReadCount} team ${teamReadCount === 1 ? 'memory' : 'memories'}`,
    )
  }
  if (teamSearchCount > 0) {
    const verb = isActive
      ? parts.length === 0
        ? 'Searching'
        : 'searching'
      : parts.length === 0
        ? 'Searched'
        : 'searched'
    parts.push(`${verb} team memories`)
  }
  if (teamWriteCount > 0) {
    const verb = isActive
      ? parts.length === 0
        ? 'Writing'
        : 'writing'
      : parts.length === 0
        ? 'Wrote'
        : 'wrote'
    parts.push(
      `${verb} ${teamWriteCount} team ${teamWriteCount === 1 ? 'memory' : 'memories'}`,
    )
  }
}
