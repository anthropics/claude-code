import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod/v4'
import { getSessionCreatedTeams } from '../../bootstrap/state.js'
import { logForDebugging } from '../debug.js'
import { getTeamsDir } from '../envUtils.js'
import { errorMessage, getErrnoCode } from '../errors.js'
import { execFileNoThrowWithCwd } from '../execFileNoThrow.js'
import { gitExe } from '../git.js'
import { lazySchema } from '../lazySchema.js'
import type { PermissionMode } from '../permissions/PermissionMode.js'
import { jsonParse, jsonStringify } from '../slowOperations.js'
import { getTasksDir, notifyTasksUpdated } from '../tasks.js'
import { getAgentName, getTeamName, isTeammate } from '../teammate.js'
import { type BackendType, isPaneBackend } from './backends/types.js'
import { TEAM_LEAD_NAME } from './constants.js'

export const inputSchema = lazySchema(() =>
  z.strictObject({
    operation: z
      .enum(['spawnTeam', 'cleanup'])
      .describe(
        'Operation: spawnTeam to create a team, cleanup to remove team and task directories.',
      ),
    agent_type: z
      .string()
      .optional()
      .describe(
        'Type/role of the team lead (e.g., "researcher", "test-runner"). ' +
          'Used for team file and inter-agent coordination.',
      ),
    team_name: z
      .string()
      .optional()
      .describe('Name for the new team to create (required for spawnTeam).'),
    description: z
      .string()
      .optional()
      .describe('Team description/purpose (only used with spawnTeam).'),
  }),
)

// Output types for different operations
export type SpawnTeamOutput = {
  team_name: string
  team_file_path: string
  lead_agent_id: string
}

export type CleanupOutput = {
  success: boolean
  message: string
  team_name?: string
}

export type TeamAllowedPath = {
  path: string // Directory path (absolute)
  toolName: string // The tool this applies to (e.g., "Edit", "Write")
  addedBy: string // Agent name who added this rule
  addedAt: number // Timestamp when added
}

export type TeamFile = {
  name: string
  description?: string
  createdAt: number
  leadAgentId: string
  leadSessionId?: string // Actual session UUID of the leader (for discovery)
  hiddenPaneIds?: string[] // Pane IDs that are currently hidden from the UI
  teamAllowedPaths?: TeamAllowedPath[] // Paths all teammates can edit without asking
  members: Array<{
    agentId: string
    name: string
    agentType?: string
    model?: string
    prompt?: string
    color?: string
    planModeRequired?: boolean
    joinedAt: number
    tmuxPaneId: string
    cwd: string
    worktreePath?: string
    sessionId?: string
    subscriptions: string[]
    backendType?: BackendType
    isActive?: boolean // false when idle, undefined/true when active
    mode?: PermissionMode // Current permission mode for this teammate
  }>
}

export type Input = z.infer<ReturnType<typeof inputSchema>>
// Export SpawnTeamOutput as Output for backward compatibility
export type Output = SpawnTeamOutput

/**
 * Sanitizes a name for use in tmux window names, worktree paths, and file paths.
 * Replaces all non-alphanumeric characters with hyphens and lowercases.
 */
export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
}

/**
 * Sanitizes an agent name for use in deterministic agent IDs.
 * Replaces @ with - to prevent ambiguity in the agentName@teamName format.
 */
export function sanitizeAgentName(name: string): string {
  return name.replace(/@/g, '-')
}

/**
 * Gets the path to a team's directory
 */
export function getTeamDir(teamName: string): string {
  return join(getTeamsDir(), sanitizeName(teamName))
}

/**
 * Gets the path to a team's config.json file
 */
export function getTeamFilePath(teamName: string): string {
  return join(getTeamDir(teamName), 'config.json')
}

/**
 * Reads a team file by name (sync — for sync contexts like React render paths)
 * @internal Exported for team discovery UI
 */
// sync IO: called from sync context
export function readTeamFile(teamName: string): TeamFile | null {
  try {
    const content = readFileSync(getTeamFilePath(teamName), 'utf-8')
    return jsonParse(content) as TeamFile
  } catch (e) {
    if (getErrnoCode(e) === 'ENOENT') return null
    logForDebugging(
      `[TeammateTool] Failed to read team file for ${teamName}: ${errorMessage(e)}`,
    )
    return null
  }
}

/**
 * Reads a team file by name (async — for tool handlers and other async contexts)
 */
export async function readTeamFileAsync(
  teamName: string,
): Promise<TeamFile | null> {
  try {
    const content = await readFile(getTeamFilePath(teamName), 'utf-8')
    return jsonParse(content) as TeamFile
  } catch (e) {
    if (getErrnoCode(e) === 'ENOENT') return null
    logForDebugging(
      `[TeammateTool] Failed to read team file for ${teamName}: ${errorMessage(e)}`,
    )
    return null
  }
}

/**
 * Writes a team file (sync — for sync contexts)
 */
// sync IO: called from sync context
function writeTeamFile(teamName: string, teamFile: TeamFile): void {
  const teamDir = getTeamDir(teamName)
  mkdirSync(teamDir, { recursive: true })
  writeFileSync(getTeamFilePath(teamName), jsonStringify(teamFile, null, 2))
}

/**
 * Writes a team file (async — for tool handlers)
 */
export async function writeTeamFileAsync(
  teamName: string,
  teamFile: TeamFile,
): Promise<void> {
  const teamDir = getTeamDir(teamName)
  await mkdir(teamDir, { recursive: true })
  await writeFile(getTeamFilePath(teamName), jsonStringify(teamFile, null, 2))
}

/**
 * Removes a teammate from the team file by agent ID or name.
 * Used by the leader when processing shutdown approvals.
 */
export function removeTeammateFromTeamFile(
  teamName: string,
  identifier: { agentId?: string; name?: string },
): boolean {
  const identifierStr = identifier.agentId || identifier.name
  if (!identifierStr) {
    logForDebugging(
      '[TeammateTool] removeTeammateFromTeamFile called with no identifier',
    )
    return false
  }

  const teamFile = readTeamFile(teamName)
  if (!teamFile) {
    logForDebugging(
      `[TeammateTool] Cannot remove teammate ${identifierStr}: failed to read team file for "${teamName}"`,
    )
    return false
  }

  const originalLength = teamFile.members.length
  teamFile.members = teamFile.members.filter(m => {
    if (identifier.agentId && m.agentId === identifier.agentId) return false
    if (identifier.name && m.name === identifier.name) return false
    return true
  })

  if (teamFile.members.length === originalLength) {
    logForDebugging(
      `[TeammateTool] Teammate ${identifierStr} not found in team file for "${teamName}"`,
    )
    return false
  }

  writeTeamFile(teamName, teamFile)
  logForDebugging(
    `[TeammateTool] Removed teammate from team file: ${identifierStr}`,
  )
  return true
}

/**
 * Adds a pane ID to the hidden panes list in the team file.
 * @param teamName - The name of the team
 * @param paneId - The pane ID to hide
 * @returns true if the pane was added to hidden list, false if team doesn't exist
 */
export function addHiddenPaneId(teamName: string, paneId: string): boolean {
  const teamFile = readTeamFile(teamName)
  if (!teamFile) {
    return false
  }

  const hiddenPaneIds = teamFile.hiddenPaneIds ?? []
  if (!hiddenPaneIds.includes(paneId)) {
    hiddenPaneIds.push(paneId)
    teamFile.hiddenPaneIds = hiddenPaneIds
    writeTeamFile(teamName, teamFile)
    logForDebugging(
      `[TeammateTool] Added ${paneId} to hidden panes for team ${teamName}`,
    )
  }
  return true
}

/**
 * Removes a pane ID from the hidden panes list in the team file.
 * @param teamName - The name of the team
 * @param paneId - The pane ID to show (remove from hidden list)
 * @returns true if the pane was removed from hidden list, false if team doesn't exist
 */
export function removeHiddenPaneId(teamName: string, paneId: string): boolean {
  const teamFile = readTeamFile(teamName)
  if (!teamFile) {
    return false
  }

  const hiddenPaneIds = teamFile.hiddenPaneIds ?? []
  const index = hiddenPaneIds.indexOf(paneId)
  if (index !== -1) {
    hiddenPaneIds.splice(index, 1)
    teamFile.hiddenPaneIds = hiddenPaneIds
    writeTeamFile(teamName, teamFile)
    logForDebugging(
      `[TeammateTool] Removed ${paneId} from hidden panes for team ${teamName}`,
    )
  }
  return true
}

/**
 * Removes a teammate from the team config file by pane ID.
 * Also removes from hiddenPaneIds if present.
 * @param teamName - The name of the team
 * @param tmuxPaneId - The pane ID of the teammate to remove
 * @returns true if the member was removed, false if team or member doesn't exist
 */
export function removeMemberFromTeam(
  teamName: string,
  tmuxPaneId: string,
): boolean {
  const teamFile = readTeamFile(teamName)
  if (!teamFile) {
    return false
  }

  const memberIndex = teamFile.members.findIndex(
    m => m.tmuxPaneId === tmuxPaneId,
  )
  if (memberIndex === -1) {
    return false
  }

  // Remove from members array
  teamFile.members.splice(memberIndex, 1)

  // Also remove from hiddenPaneIds if present
  if (teamFile.hiddenPaneIds) {
    const hiddenIndex = teamFile.hiddenPaneIds.indexOf(tmuxPaneId)
    if (hiddenIndex !== -1) {
      teamFile.hiddenPaneIds.splice(hiddenIndex, 1)
    }
  }

  writeTeamFile(teamName, teamFile)
  logForDebugging(
    `[TeammateTool] Removed member with pane ${tmuxPaneId} from team ${teamName}`,
  )
  return true
}

/**
 * Removes a teammate from a team's member list by agent ID.
 * Use this for in-process teammates which all share the same tmuxPaneId.
 * @param teamName - The name of the team
 * @param agentId - The agent ID of the teammate to remove (e.g., "researcher@my-team")
 * @returns true if the member was removed, false if team or member doesn't exist
 */
export function removeMemberByAgentId(
  teamName: string,
  agentId: string,
): boolean {
  const teamFile = readTeamFile(teamName)
  if (!teamFile) {
    return false
  }

  const memberIndex = teamFile.members.findIndex(m => m.agentId === agentId)
  if (memberIndex === -1) {
    return false
  }

  // Remove from members array
  teamFile.members.splice(memberIndex, 1)

  writeTeamFile(teamName, teamFile)
  logForDebugging(
    `[TeammateTool] Removed member ${agentId} from team ${teamName}`,
  )
  return true
}

/**
 * Sets a team member's permission mode.
 * Called when the team leader changes a teammate's mode via the TeamsDialog.
 * @param teamName - The name of the team
 * @param memberName - The name of the member to update
 * @param mode - The new permission mode
 */
export function setMemberMode(
  teamName: string,
  memberName: string,
  mode: PermissionMode,
): boolean {
  const teamFile = readTeamFile(teamName)
  if (!teamFile) {
    return false
  }

  const member = teamFile.members.find(m => m.name === memberName)
  if (!member) {
    logForDebugging(
      `[TeammateTool] Cannot set member mode: member ${memberName} not found in team ${teamName}`,
    )
    return false
  }

  // Only write if the value is actually changing
  if (member.mode === mode) {
    return true
  }

  // Create updated members array immutably
  const updatedMembers = teamFile.members.map(m =>
    m.name === memberName ? { ...m, mode } : m,
  )
  writeTeamFile(teamName, { ...teamFile, members: updatedMembers })
  logForDebugging(
    `[TeammateTool] Set member ${memberName} in team ${teamName} to mode: ${mode}`,
  )
  return true
}

/**
 * Sync the current teammate's mode to config.json so team lead sees it.
 * No-op if not running as a teammate.
 * @param mode - The permission mode to sync
 * @param teamNameOverride - Optional team name override (uses env var if not provided)
 */
export function syncTeammateMode(
  mode: PermissionMode,
  teamNameOverride?: string,
): void {
  if (!isTeammate()) return
  const teamName = teamNameOverride ?? getTeamName()
  const agentName = getAgentName()
  if (teamName && agentName) {
    setMemberMode(teamName, agentName, mode)
  }
}

/**
 * Sets multiple team members' permission modes in a single atomic operation.
 * Avoids race conditions when updating multiple teammates at once.
 * @param teamName - The name of the team
 * @param modeUpdates - Array of {memberName, mode} to update
 */
export function setMultipleMemberModes(
  teamName: string,
  modeUpdates: Array<{ memberName: string; mode: PermissionMode }>,
): boolean {
  const teamFile = readTeamFile(teamName)
  if (!teamFile) {
    return false
  }

  // Build a map of updates for efficient lookup
  const updateMap = new Map(modeUpdates.map(u => [u.memberName, u.mode]))

  // Create updated members array immutably
  let anyChanged = false
  const updatedMembers = teamFile.members.map(member => {
    const newMode = updateMap.get(member.name)
    if (newMode !== undefined && member.mode !== newMode) {
      anyChanged = true
      return { ...member, mode: newMode }
    }
    return member
  })

  if (anyChanged) {
    writeTeamFile(teamName, { ...teamFile, members: updatedMembers })
    logForDebugging(
      `[TeammateTool] Set ${modeUpdates.length} member modes in team ${teamName}`,
    )
  }
  return true
}

/**
 * Sets a team member's active status.
 * Called when a teammate becomes idle (isActive=false) or starts a new turn (isActive=true).
 * @param teamName - The name of the team
 * @param memberName - The name of the member to update
 * @param isActive - Whether the member is active (true) or idle (false)
 */
export async function setMemberActive(
  teamName: string,
  memberName: string,
  isActive: boolean,
): Promise<void> {
  const teamFile = await readTeamFileAsync(teamName)
  if (!teamFile) {
    logForDebugging(
      `[TeammateTool] Cannot set member active: team ${teamName} not found`,
    )
    return
  }

  const member = teamFile.members.find(m => m.name === memberName)
  if (!member) {
    logForDebugging(
      `[TeammateTool] Cannot set member active: member ${memberName} not found in team ${teamName}`,
    )
    return
  }

  // Only write if the value is actually changing
  if (member.isActive === isActive) {
    return
  }

  member.isActive = isActive
  await writeTeamFileAsync(teamName, teamFile)
  logForDebugging(
    `[TeammateTool] Set member ${memberName} in team ${teamName} to ${isActive ? 'active' : 'idle'}`,
  )
}

/**
 * Destroys a git worktree at the given path.
 * First attempts to use `git worktree remove`, then falls back to rm -rf.
 * Safe to call on non-existent paths.
 */
async function destroyWorktree(worktreePath: string): Promise<void> {
  // Read the .git file in the worktree to find the main repo
  const gitFilePath = join(worktreePath, '.git')
  let mainRepoPath: string | null = null

  try {
    const gitFileContent = (await readFile(gitFilePath, 'utf-8')).trim()
    // The .git file contains something like: gitdir: /path/to/repo/.git/worktrees/worktree-name
    const match = gitFileContent.match(/^gitdir:\s*(.+)$/)
    if (match && match[1]) {
      // Extract the main repo .git directory (go up from .git/worktrees/name to .git)
      const worktreeGitDir = match[1]
      // Go up 2 levels from .git/worktrees/name to get to .git, then get parent for repo root
      const mainGitDir = join(worktreeGitDir, '..', '..')
      mainRepoPath = join(mainGitDir, '..')
    }
  } catch {
    // Ignore errors reading .git file (path doesn't exist, not a file, etc.)
  }

  // Try to remove using git worktree remove command
  if (mainRepoPath) {
    const result = await execFileNoThrowWithCwd(
      gitExe(),
      ['worktree', 'remove', '--force', worktreePath],
      { cwd: mainRepoPath },
    )

    if (result.code === 0) {
      logForDebugging(
        `[TeammateTool] Removed worktree via git: ${worktreePath}`,
      )
      return
    }

    // Check if the error is "not a working tree" (already removed)
    if (result.stderr?.includes('not a working tree')) {
      logForDebugging(
        `[TeammateTool] Worktree already removed: ${worktreePath}`,
      )
      return
    }

    logForDebugging(
      `[TeammateTool] git worktree remove failed, falling back to rm: ${result.stderr}`,
    )
  }

  // Fallback: manually remove the directory
  try {
    await rm(worktreePath, { recursive: true, force: true })
    logForDebugging(
      `[TeammateTool] Removed worktree directory manually: ${worktreePath}`,
    )
  } catch (error) {
    logForDebugging(
      `[TeammateTool] Failed to remove worktree ${worktreePath}: ${errorMessage(error)}`,
    )
  }
}

/**
 * Mark a team as created this session so it gets cleaned up on exit.
 * Call this right after the initial writeTeamFile. TeamDelete should
 * call unregisterTeamForSessionCleanup to prevent double-cleanup.
 * Backing Set lives in bootstrap/state.ts so resetStateForTests()
 * clears it between tests (avoids the PR #17615 cross-shard leak class).
 */
export function registerTeamForSessionCleanup(teamName: string): void {
  getSessionCreatedTeams().add(teamName)
}

/**
 * Remove a team from session cleanup tracking (e.g., after explicit
 * TeamDelete — already cleaned, don't try again on shutdown).
 */
export function unregisterTeamForSessionCleanup(teamName: string): void {
  getSessionCreatedTeams().delete(teamName)
}

/**
 * Clean up all teams created this session that weren't explicitly deleted.
 * Registered with gracefulShutdown from init.ts.
 */
export async function cleanupSessionTeams(): Promise<void> {
  const sessionCreatedTeams = getSessionCreatedTeams()
  if (sessionCreatedTeams.size === 0) return
  const teams = Array.from(sessionCreatedTeams)
  logForDebugging(
    `cleanupSessionTeams: removing ${teams.length} orphan team dir(s): ${teams.join(', ')}`,
  )
  // Kill panes first — on SIGINT the teammate processes are still running;
  // deleting directories alone would orphan them in open tmux/iTerm2 panes.
  // (TeamDeleteTool's path doesn't need this — by then teammates have
  // gracefully exited and useInboxPoller has already closed their panes.)
  await Promise.allSettled(teams.map(name => killOrphanedTeammatePanes(name)))
  await Promise.allSettled(teams.map(name => cleanupTeamDirectories(name)))
  sessionCreatedTeams.clear()
}

/**
 * Best-effort kill of all pane-backed teammate panes for a team.
 * Called from cleanupSessionTeams on ungraceful leader exit (SIGINT/SIGTERM).
 * Dynamic imports avoid adding registry/detection to this module's static
 * dep graph — this only runs at shutdown, so the import cost is irrelevant.
 */
async function killOrphanedTeammatePanes(teamName: string): Promise<void> {
  const teamFile = readTeamFile(teamName)
  if (!teamFile) return

  const paneMembers = teamFile.members.filter(
    m =>
      m.name !== TEAM_LEAD_NAME &&
      m.tmuxPaneId &&
      m.backendType &&
      isPaneBackend(m.backendType),
  )
  if (paneMembers.length === 0) return

  const [{ ensureBackendsRegistered, getBackendByType }, { isInsideTmux }] =
    await Promise.all([
      import('./backends/registry.js'),
      import('./backends/detection.js'),
    ])
  await ensureBackendsRegistered()
  const useExternalSession = !(await isInsideTmux())

  await Promise.allSettled(
    paneMembers.map(async m => {
      // filter above guarantees these; narrow for the type system
      if (!m.tmuxPaneId || !m.backendType || !isPaneBackend(m.backendType)) {
        return
      }
      const ok = await getBackendByType(m.backendType).killPane(
        m.tmuxPaneId,
        useExternalSession,
      )
      logForDebugging(
        `cleanupSessionTeams: killPane ${m.name} (${m.backendType} ${m.tmuxPaneId}) → ${ok}`,
      )
    }),
  )
}

/**
 * Cleans up team and task directories for a given team name.
 * Also cleans up git worktrees created for teammates.
 * Called when a swarm session is terminated.
 */
export async function cleanupTeamDirectories(teamName: string): Promise<void> {
  const sanitizedName = sanitizeName(teamName)

  // Read team file to get worktree paths BEFORE deleting the team directory
  const teamFile = readTeamFile(teamName)
  const worktreePaths: string[] = []
  if (teamFile) {
    for (const member of teamFile.members) {
      if (member.worktreePath) {
        worktreePaths.push(member.worktreePath)
      }
    }
  }

  // Clean up worktrees first
  for (const worktreePath of worktreePaths) {
    await destroyWorktree(worktreePath)
  }

  // Clean up team directory (~/.claude/teams/{team-name}/)
  const teamDir = getTeamDir(teamName)
  try {
    await rm(teamDir, { recursive: true, force: true })
    logForDebugging(`[TeammateTool] Cleaned up team directory: ${teamDir}`)
  } catch (error) {
    logForDebugging(
      `[TeammateTool] Failed to clean up team directory ${teamDir}: ${errorMessage(error)}`,
    )
  }

  // Clean up tasks directory (~/.claude/tasks/{taskListId}/)
  // The leader and teammates all store tasks under the sanitized team name.
  const tasksDir = getTasksDir(sanitizedName)
  try {
    await rm(tasksDir, { recursive: true, force: true })
    logForDebugging(`[TeammateTool] Cleaned up tasks directory: ${tasksDir}`)
    notifyTasksUpdated()
  } catch (error) {
    logForDebugging(
      `[TeammateTool] Failed to clean up tasks directory ${tasksDir}: ${errorMessage(error)}`,
    )
  }
}
