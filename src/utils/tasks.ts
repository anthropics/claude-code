import { mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod/v4'
import { getIsNonInteractiveSession, getSessionId } from '../bootstrap/state.js'
import { uniq } from './array.js'
import { logForDebugging } from './debug.js'
import { getClaudeConfigHomeDir, getTeamsDir, isEnvTruthy } from './envUtils.js'
import { errorMessage, getErrnoCode } from './errors.js'
import { lazySchema } from './lazySchema.js'
import * as lockfile from './lockfile.js'
import { logError } from './log.js'
import { createSignal } from './signal.js'
import { jsonParse, jsonStringify } from './slowOperations.js'
import { getTeamName } from './teammate.js'
import { getTeammateContext } from './teammateContext.js'

// Listeners for task list updates (used for immediate UI refresh in same process)
const tasksUpdated = createSignal()

/**
 * Team name set by the leader when creating a team.
 * Used by getTaskListId() so the leader's tasks are stored under the team name
 * (matching where tmux/iTerm2 teammates look), not under the session ID.
 */
let leaderTeamName: string | undefined

/**
 * Sets the leader's team name for task list resolution.
 * Called by TeamCreateTool when a team is created.
 */
export function setLeaderTeamName(teamName: string): void {
  if (leaderTeamName === teamName) return
  leaderTeamName = teamName
  // Changing the task list ID is a "tasks updated" event for subscribers —
  // they're now looking at a different directory.
  notifyTasksUpdated()
}

/**
 * Clears the leader's team name.
 * Called when a team is deleted.
 */
export function clearLeaderTeamName(): void {
  if (leaderTeamName === undefined) return
  leaderTeamName = undefined
  notifyTasksUpdated()
}

/**
 * Register a listener to be called when tasks are updated in this process.
 * Returns an unsubscribe function.
 */
export const onTasksUpdated = tasksUpdated.subscribe

/**
 * Notify listeners that tasks have been updated.
 * Called internally after createTask, updateTask, etc.
 * Wraps emit in try/catch so listener failures never propagate to callers
 * (task mutations must succeed from the caller's perspective).
 */
export function notifyTasksUpdated(): void {
  try {
    tasksUpdated.emit()
  } catch {
    // Ignore listener errors — task mutations must not fail due to notification issues
  }
}

export const TASK_STATUSES = ['pending', 'in_progress', 'completed'] as const

export const TaskStatusSchema = lazySchema(() =>
  z.enum(['pending', 'in_progress', 'completed']),
)
export type TaskStatus = z.infer<ReturnType<typeof TaskStatusSchema>>

export const TaskSchema = lazySchema(() =>
  z.object({
    id: z.string(),
    subject: z.string(),
    description: z.string(),
    activeForm: z.string().optional(), // present continuous form for spinner (e.g., "Running tests")
    owner: z.string().optional(), // agent ID
    status: TaskStatusSchema(),
    blocks: z.array(z.string()), // task IDs this task blocks
    blockedBy: z.array(z.string()), // task IDs that block this task
    metadata: z.record(z.string(), z.unknown()).optional(), // arbitrary metadata
  }),
)
export type Task = z.infer<ReturnType<typeof TaskSchema>>

// High water mark file name - stores the maximum task ID ever assigned
const HIGH_WATER_MARK_FILE = '.highwatermark'

// Lock options: retry with backoff so concurrent callers (multiple Claudes
// in a swarm) wait for the lock instead of failing immediately. The sync
// lockSync API blocked the event loop; the async API needs explicit retries
// to achieve the same serialization semantics.
//
// Budget sized for ~10+ concurrent swarm agents: each critical section does
// readdir + N×readFile + writeFile (~50-100ms on slow disks), so the last
// caller in a 10-way race needs ~900ms. retries=30 gives ~2.6s total wait.
const LOCK_OPTIONS = {
  retries: {
    retries: 30,
    minTimeout: 5,
    maxTimeout: 100,
  },
}

function getHighWaterMarkPath(taskListId: string): string {
  return join(getTasksDir(taskListId), HIGH_WATER_MARK_FILE)
}

async function readHighWaterMark(taskListId: string): Promise<number> {
  const path = getHighWaterMarkPath(taskListId)
  try {
    const content = (await readFile(path, 'utf-8')).trim()
    const value = parseInt(content, 10)
    return isNaN(value) ? 0 : value
  } catch {
    return 0
  }
}

async function writeHighWaterMark(
  taskListId: string,
  value: number,
): Promise<void> {
  const path = getHighWaterMarkPath(taskListId)
  await writeFile(path, String(value))
}

export function isTodoV2Enabled(): boolean {
  // Force-enable tasks in non-interactive mode (e.g. SDK users who want Task tools over TodoWrite)
  if (isEnvTruthy(process.env.CLAUDE_CODE_ENABLE_TASKS)) {
    return true
  }
  return !getIsNonInteractiveSession()
}

/**
 * Resets the task list for a new swarm - clears any existing tasks.
 * Writes a high water mark file to prevent ID reuse after reset.
 * Should be called when a new swarm is created to ensure task numbering starts at 1.
 * Uses file locking to prevent race conditions when multiple Claudes run in parallel.
 */
export async function resetTaskList(taskListId: string): Promise<void> {
  const dir = getTasksDir(taskListId)
  const lockPath = await ensureTaskListLockFile(taskListId)

  let release: (() => Promise<void>) | undefined
  try {
    // Acquire exclusive lock on the task list
    release = await lockfile.lock(lockPath, LOCK_OPTIONS)

    // Find the current highest ID and save it to the high water mark file
    const currentHighest = await findHighestTaskIdFromFiles(taskListId)
    if (currentHighest > 0) {
      const existingMark = await readHighWaterMark(taskListId)
      if (currentHighest > existingMark) {
        await writeHighWaterMark(taskListId, currentHighest)
      }
    }

    // Delete all task files
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      files = []
    }
    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('.')) {
        const filePath = join(dir, file)
        try {
          await unlink(filePath)
        } catch {
          // Ignore errors, file may already be deleted
        }
      }
    }
    notifyTasksUpdated()
  } finally {
    if (release) {
      await release()
    }
  }
}

/**
 * Gets the task list ID based on the current context.
 * Priority:
 * 1. CLAUDE_CODE_TASK_LIST_ID - explicit task list ID
 * 2. In-process teammate: leader's team name (so teammates share the leader's task list)
 * 3. CLAUDE_CODE_TEAM_NAME - set when running as a process-based teammate
 * 4. Leader team name - set when the leader creates a team via TeamCreate
 * 5. Session ID - fallback for standalone sessions
 */
export function getTaskListId(): string {
  if (process.env.CLAUDE_CODE_TASK_LIST_ID) {
    return process.env.CLAUDE_CODE_TASK_LIST_ID
  }
  // In-process teammates use the leader's team name so they share the same
  // task list that tmux/iTerm2 teammates also resolve to.
  const teammateCtx = getTeammateContext()
  if (teammateCtx) {
    return teammateCtx.teamName
  }
  return getTeamName() || leaderTeamName || getSessionId()
}

/**
 * Sanitizes a string for safe use in file paths.
 * Removes path traversal characters and other potentially dangerous characters.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
export function sanitizePathComponent(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '-')
}

export function getTasksDir(taskListId: string): string {
  return join(
    getClaudeConfigHomeDir(),
    'tasks',
    sanitizePathComponent(taskListId),
  )
}

export function getTaskPath(taskListId: string, taskId: string): string {
  return join(getTasksDir(taskListId), `${sanitizePathComponent(taskId)}.json`)
}

export async function ensureTasksDir(taskListId: string): Promise<void> {
  const dir = getTasksDir(taskListId)
  try {
    await mkdir(dir, { recursive: true })
  } catch {
    // Directory already exists or creation failed; callers will surface
    // errors from subsequent operations.
  }
}

/**
 * Finds the highest task ID from existing task files (not including high water mark).
 */
async function findHighestTaskIdFromFiles(taskListId: string): Promise<number> {
  const dir = getTasksDir(taskListId)
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return 0
  }
  let highest = 0
  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue
    }
    const taskId = parseInt(file.replace('.json', ''), 10)
    if (!isNaN(taskId) && taskId > highest) {
      highest = taskId
    }
  }
  return highest
}

/**
 * Finds the highest task ID ever assigned, considering both existing files
 * and the high water mark (for deleted/reset tasks).
 */
async function findHighestTaskId(taskListId: string): Promise<number> {
  const [fromFiles, fromMark] = await Promise.all([
    findHighestTaskIdFromFiles(taskListId),
    readHighWaterMark(taskListId),
  ])
  return Math.max(fromFiles, fromMark)
}

/**
 * Creates a new task with a unique ID.
 * Uses file locking to prevent race conditions when multiple processes
 * create tasks concurrently.
 */
export async function createTask(
  taskListId: string,
  taskData: Omit<Task, 'id'>,
): Promise<string> {
  const lockPath = await ensureTaskListLockFile(taskListId)

  let release: (() => Promise<void>) | undefined
  try {
    // Acquire exclusive lock on the task list
    release = await lockfile.lock(lockPath, LOCK_OPTIONS)

    // Read highest ID from disk while holding the lock
    const highestId = await findHighestTaskId(taskListId)
    const id = String(highestId + 1)
    const task: Task = { id, ...taskData }
    const path = getTaskPath(taskListId, id)
    await writeFile(path, jsonStringify(task, null, 2))
    notifyTasksUpdated()
    return id
  } finally {
    if (release) {
      await release()
    }
  }
}

export async function getTask(
  taskListId: string,
  taskId: string,
): Promise<Task | null> {
  const path = getTaskPath(taskListId, taskId)
  try {
    const content = await readFile(path, 'utf-8')
    const data = jsonParse(content) as { status?: string }

    // TEMPORARY: Migrate old status names for existing sessions (ant-only)
    if (process.env.USER_TYPE === 'ant') {
      if (data.status === 'open') data.status = 'pending'
      else if (data.status === 'resolved') data.status = 'completed'
      // Migrate development task statuses to in_progress
      else if (
        data.status &&
        ['planning', 'implementing', 'reviewing', 'verifying'].includes(
          data.status,
        )
      ) {
        data.status = 'in_progress'
      }
    }
    const parsed = TaskSchema().safeParse(data)
    if (!parsed.success) {
      logForDebugging(
        `[Tasks] Task ${taskId} failed schema validation: ${parsed.error.message}`,
      )
      return null
    }
    return parsed.data
  } catch (e) {
    const code = getErrnoCode(e)
    if (code === 'ENOENT') {
      return null
    }
    logForDebugging(`[Tasks] Failed to read task ${taskId}: ${errorMessage(e)}`)
    logError(e)
    return null
  }
}

// Internal: no lock. Callers already holding a lock on taskPath must use this
// to avoid deadlock (claimTask, deleteTask cascade, etc.).
async function updateTaskUnsafe(
  taskListId: string,
  taskId: string,
  updates: Partial<Omit<Task, 'id'>>,
): Promise<Task | null> {
  const existing = await getTask(taskListId, taskId)
  if (!existing) {
    return null
  }
  const updated: Task = { ...existing, ...updates, id: taskId }
  const path = getTaskPath(taskListId, taskId)
  await writeFile(path, jsonStringify(updated, null, 2))
  notifyTasksUpdated()
  return updated
}

export async function updateTask(
  taskListId: string,
  taskId: string,
  updates: Partial<Omit<Task, 'id'>>,
): Promise<Task | null> {
  const path = getTaskPath(taskListId, taskId)

  // Check existence before locking — proper-lockfile throws if the
  // target file doesn't exist, and we want a clean null result.
  const taskBeforeLock = await getTask(taskListId, taskId)
  if (!taskBeforeLock) {
    return null
  }

  let release: (() => Promise<void>) | undefined
  try {
    release = await lockfile.lock(path, LOCK_OPTIONS)
    return await updateTaskUnsafe(taskListId, taskId, updates)
  } finally {
    await release?.()
  }
}

export async function deleteTask(
  taskListId: string,
  taskId: string,
): Promise<boolean> {
  const path = getTaskPath(taskListId, taskId)

  try {
    // Update high water mark before deleting to prevent ID reuse
    const numericId = parseInt(taskId, 10)
    if (!isNaN(numericId)) {
      const currentMark = await readHighWaterMark(taskListId)
      if (numericId > currentMark) {
        await writeHighWaterMark(taskListId, numericId)
      }
    }

    // Delete the task file
    try {
      await unlink(path)
    } catch (e) {
      const code = getErrnoCode(e)
      if (code === 'ENOENT') {
        return false
      }
      throw e
    }

    // Remove references to this task from other tasks
    const allTasks = await listTasks(taskListId)
    for (const task of allTasks) {
      const newBlocks = task.blocks.filter(id => id !== taskId)
      const newBlockedBy = task.blockedBy.filter(id => id !== taskId)
      if (
        newBlocks.length !== task.blocks.length ||
        newBlockedBy.length !== task.blockedBy.length
      ) {
        await updateTask(taskListId, task.id, {
          blocks: newBlocks,
          blockedBy: newBlockedBy,
        })
      }
    }

    notifyTasksUpdated()
    return true
  } catch {
    return false
  }
}

export async function listTasks(taskListId: string): Promise<Task[]> {
  const dir = getTasksDir(taskListId)
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }
  const taskIds = files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
  const results = await Promise.all(taskIds.map(id => getTask(taskListId, id)))
  return results.filter((t): t is Task => t !== null)
}

export async function blockTask(
  taskListId: string,
  fromTaskId: string,
  toTaskId: string,
): Promise<boolean> {
  const [fromTask, toTask] = await Promise.all([
    getTask(taskListId, fromTaskId),
    getTask(taskListId, toTaskId),
  ])
  if (!fromTask || !toTask) {
    return false
  }

  // Update source task: A blocks B
  if (!fromTask.blocks.includes(toTaskId)) {
    await updateTask(taskListId, fromTaskId, {
      blocks: [...fromTask.blocks, toTaskId],
    })
  }

  // Update target task: B is blockedBy A
  if (!toTask.blockedBy.includes(fromTaskId)) {
    await updateTask(taskListId, toTaskId, {
      blockedBy: [...toTask.blockedBy, fromTaskId],
    })
  }

  return true
}

export type ClaimTaskResult = {
  success: boolean
  reason?:
    | 'task_not_found'
    | 'already_claimed'
    | 'already_resolved'
    | 'blocked'
    | 'agent_busy'
  task?: Task
  busyWithTasks?: string[] // task IDs the agent is busy with (when reason is 'agent_busy')
  blockedByTasks?: string[] // task IDs blocking this task (when reason is 'blocked')
}

/**
 * Gets the lock file path for a task list (used for list-level locking)
 */
function getTaskListLockPath(taskListId: string): string {
  return join(getTasksDir(taskListId), '.lock')
}

/**
 * Ensures the lock file exists for a task list
 */
async function ensureTaskListLockFile(taskListId: string): Promise<string> {
  await ensureTasksDir(taskListId)
  const lockPath = getTaskListLockPath(taskListId)
  // proper-lockfile requires the target file to exist. Create it with the
  // 'wx' flag (write-exclusive) so concurrent callers don't both create it,
  // and the first one to create wins silently.
  try {
    await writeFile(lockPath, '', { flag: 'wx' })
  } catch {
    // EEXIST or other — file already exists, which is fine.
  }
  return lockPath
}

export type ClaimTaskOptions = {
  /**
   * If true, checks whether the agent is already busy (owns other open tasks)
   * before allowing the claim. This check is performed atomically with the claim
   * using a task-list-level lock to prevent TOCTOU race conditions.
   */
  checkAgentBusy?: boolean
}

/**
 * Attempts to claim a task for an agent with file locking to prevent race conditions.
 * Returns success if the task was claimed, or a reason if it wasn't.
 *
 * When checkAgentBusy is true, uses a task-list-level lock to atomically check
 * if the agent owns any other open tasks before claiming.
 */
export async function claimTask(
  taskListId: string,
  taskId: string,
  claimantAgentId: string,
  options: ClaimTaskOptions = {},
): Promise<ClaimTaskResult> {
  const taskPath = getTaskPath(taskListId, taskId)

  // Check existence before locking — proper-lockfile.lock throws if the
  // target file doesn't exist, and we want a clean task_not_found result.
  const taskBeforeLock = await getTask(taskListId, taskId)
  if (!taskBeforeLock) {
    return { success: false, reason: 'task_not_found' }
  }

  // If we need to check agent busy status, use task-list-level lock
  // to prevent TOCTOU race conditions
  if (options.checkAgentBusy) {
    return claimTaskWithBusyCheck(taskListId, taskId, claimantAgentId)
  }

  // Otherwise, use task-level lock (original behavior)
  let release: (() => Promise<void>) | undefined
  try {
    // Acquire exclusive lock on the task file
    release = await lockfile.lock(taskPath, LOCK_OPTIONS)

    // Read current task state
    const task = await getTask(taskListId, taskId)
    if (!task) {
      return { success: false, reason: 'task_not_found' }
    }

    // Check if already claimed by another agent
    if (task.owner && task.owner !== claimantAgentId) {
      return { success: false, reason: 'already_claimed', task }
    }

    // Check if already resolved
    if (task.status === 'completed') {
      return { success: false, reason: 'already_resolved', task }
    }

    // Check for unresolved blockers (open or in_progress tasks block)
    const allTasks = await listTasks(taskListId)
    const unresolvedTaskIds = new Set(
      allTasks.filter(t => t.status !== 'completed').map(t => t.id),
    )
    const blockedByTasks = task.blockedBy.filter(id =>
      unresolvedTaskIds.has(id),
    )
    if (blockedByTasks.length > 0) {
      return { success: false, reason: 'blocked', task, blockedByTasks }
    }

    // Claim the task (already holding taskPath lock — use unsafe variant)
    const updated = await updateTaskUnsafe(taskListId, taskId, {
      owner: claimantAgentId,
    })
    return { success: true, task: updated! }
  } catch (error) {
    logForDebugging(
      `[Tasks] Failed to claim task ${taskId}: ${errorMessage(error)}`,
    )
    logError(error)
    return { success: false, reason: 'task_not_found' }
  } finally {
    if (release) {
      await release()
    }
  }
}

/**
 * Claims a task with an atomic check for agent busy status.
 * Uses a task-list-level lock to ensure the busy check and claim are atomic.
 */
async function claimTaskWithBusyCheck(
  taskListId: string,
  taskId: string,
  claimantAgentId: string,
): Promise<ClaimTaskResult> {
  const lockPath = await ensureTaskListLockFile(taskListId)

  let release: (() => Promise<void>) | undefined
  try {
    // Acquire exclusive lock on the task list
    release = await lockfile.lock(lockPath, LOCK_OPTIONS)

    // Read all tasks to check agent status and task state atomically
    const allTasks = await listTasks(taskListId)

    // Find the task we want to claim
    const task = allTasks.find(t => t.id === taskId)
    if (!task) {
      return { success: false, reason: 'task_not_found' }
    }

    // Check if already claimed by another agent
    if (task.owner && task.owner !== claimantAgentId) {
      return { success: false, reason: 'already_claimed', task }
    }

    // Check if already resolved
    if (task.status === 'completed') {
      return { success: false, reason: 'already_resolved', task }
    }

    // Check for unresolved blockers (open or in_progress tasks block)
    const unresolvedTaskIds = new Set(
      allTasks.filter(t => t.status !== 'completed').map(t => t.id),
    )
    const blockedByTasks = task.blockedBy.filter(id =>
      unresolvedTaskIds.has(id),
    )
    if (blockedByTasks.length > 0) {
      return { success: false, reason: 'blocked', task, blockedByTasks }
    }

    // Check if agent is busy with other unresolved tasks
    const agentOpenTasks = allTasks.filter(
      t =>
        t.status !== 'completed' &&
        t.owner === claimantAgentId &&
        t.id !== taskId,
    )
    if (agentOpenTasks.length > 0) {
      return {
        success: false,
        reason: 'agent_busy',
        task,
        busyWithTasks: agentOpenTasks.map(t => t.id),
      }
    }

    // Claim the task
    const updated = await updateTask(taskListId, taskId, {
      owner: claimantAgentId,
    })
    return { success: true, task: updated! }
  } catch (error) {
    logForDebugging(
      `[Tasks] Failed to claim task ${taskId} with busy check: ${errorMessage(error)}`,
    )
    logError(error)
    return { success: false, reason: 'task_not_found' }
  } finally {
    if (release) {
      await release()
    }
  }
}

/**
 * Team member info (subset of TeamFile member structure)
 */
export type TeamMember = {
  agentId: string
  name: string
  agentType?: string
}

/**
 * Agent status based on task ownership
 */
export type AgentStatus = {
  agentId: string
  name: string
  agentType?: string
  status: 'idle' | 'busy'
  currentTasks: string[] // task IDs the agent owns
}

/**
 * Sanitizes a name for use in file paths
 */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
}

/**
 * Reads team members from the team file
 */
async function readTeamMembers(
  teamName: string,
): Promise<{ leadAgentId: string; members: TeamMember[] } | null> {
  const teamsDir = getTeamsDir()
  const teamFilePath = join(teamsDir, sanitizeName(teamName), 'config.json')
  try {
    const content = await readFile(teamFilePath, 'utf-8')
    const teamFile = jsonParse(content) as {
      leadAgentId: string
      members: TeamMember[]
    }
    return {
      leadAgentId: teamFile.leadAgentId,
      members: teamFile.members.map(m => ({
        agentId: m.agentId,
        name: m.name,
        agentType: m.agentType,
      })),
    }
  } catch (e) {
    const code = getErrnoCode(e)
    if (code === 'ENOENT') {
      return null
    }
    logForDebugging(
      `[Tasks] Failed to read team file for ${teamName}: ${errorMessage(e)}`,
    )
    return null
  }
}

/**
 * Gets the status of all agents in a team based on task ownership.
 * An agent is considered "idle" if they don't own any open tasks.
 * An agent is considered "busy" if they own at least one open task.
 *
 * @param teamName - The name of the team (also used as taskListId)
 * @returns Array of agent statuses, or null if team not found
 */
export async function getAgentStatuses(
  teamName: string,
): Promise<AgentStatus[] | null> {
  const teamData = await readTeamMembers(teamName)
  if (!teamData) {
    return null
  }

  const taskListId = sanitizeName(teamName)
  const allTasks = await listTasks(taskListId)

  // Get unresolved tasks grouped by owner (open or in_progress)
  const unresolvedTasksByOwner = new Map<string, string[]>()
  for (const task of allTasks) {
    if (task.status !== 'completed' && task.owner) {
      const existing = unresolvedTasksByOwner.get(task.owner) || []
      existing.push(task.id)
      unresolvedTasksByOwner.set(task.owner, existing)
    }
  }

  // Build status for each agent (leader is already in members)
  return teamData.members.map(member => {
    // Check both name (new) and agentId (legacy) for backwards compatibility
    const tasksByName = unresolvedTasksByOwner.get(member.name) || []
    const tasksById = unresolvedTasksByOwner.get(member.agentId) || []
    const currentTasks = uniq([...tasksByName, ...tasksById])
    return {
      agentId: member.agentId,
      name: member.name,
      agentType: member.agentType,
      status: currentTasks.length === 0 ? 'idle' : 'busy',
      currentTasks,
    }
  })
}

/**
 * Result of unassigning tasks from a teammate
 */
export type UnassignTasksResult = {
  unassignedTasks: Array<{ id: string; subject: string }>
  notificationMessage: string
}

/**
 * Unassigns all open tasks from a teammate and builds a notification message.
 * Used when a teammate is killed or gracefully shuts down.
 *
 * @param teamName - The team/task list name
 * @param teammateId - The teammate's agent ID
 * @param teammateName - The teammate's display name
 * @param reason - How the teammate exited ('terminated' | 'shutdown')
 * @returns The unassigned tasks and a formatted notification message
 */
export async function unassignTeammateTasks(
  teamName: string,
  teammateId: string,
  teammateName: string,
  reason: 'terminated' | 'shutdown',
): Promise<UnassignTasksResult> {
  const tasks = await listTasks(teamName)
  const unresolvedAssignedTasks = tasks.filter(
    t =>
      t.status !== 'completed' &&
      (t.owner === teammateId || t.owner === teammateName),
  )

  // Unassign each task and reset status to open
  for (const task of unresolvedAssignedTasks) {
    await updateTask(teamName, task.id, { owner: undefined, status: 'pending' })
  }

  if (unresolvedAssignedTasks.length > 0) {
    logForDebugging(
      `[Tasks] Unassigned ${unresolvedAssignedTasks.length} task(s) from ${teammateName}`,
    )
  }

  // Build notification message
  const actionVerb =
    reason === 'terminated' ? 'was terminated' : 'has shut down'
  let notificationMessage = `${teammateName} ${actionVerb}.`
  if (unresolvedAssignedTasks.length > 0) {
    const taskList = unresolvedAssignedTasks
      .map(t => `#${t.id} "${t.subject}"`)
      .join(', ')
    notificationMessage += ` ${unresolvedAssignedTasks.length} task(s) were unassigned: ${taskList}. Use TaskList to check availability and TaskUpdate with owner to reassign them to idle teammates.`
  }

  return {
    unassignedTasks: unresolvedAssignedTasks.map(t => ({
      id: t.id,
      subject: t.subject,
    })),
    notificationMessage,
  }
}

export const DEFAULT_TASKS_MODE_TASK_LIST_ID = 'tasklist'
