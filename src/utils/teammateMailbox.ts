/**
 * Teammate Mailbox - File-based messaging system for agent swarms
 *
 * Each teammate has an inbox file at .claude/teams/{team_name}/inboxes/{agent_name}.json
 * Other teammates can write messages to it, and the recipient sees them as attachments.
 *
 * Note: Inboxes are keyed by agent name within a team.
 */

import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod/v4'
import { TEAMMATE_MESSAGE_TAG } from '../constants/xml.js'
import { PermissionModeSchema } from '../entrypoints/sdk/coreSchemas.js'
import { SEND_MESSAGE_TOOL_NAME } from '../tools/SendMessageTool/constants.js'
import type { Message } from '../types/message.js'
import { generateRequestId } from './agentId.js'
import { count } from './array.js'
import { logForDebugging } from './debug.js'
import { getTeamsDir } from './envUtils.js'
import { getErrnoCode } from './errors.js'
import { lazySchema } from './lazySchema.js'
import * as lockfile from './lockfile.js'
import { logError } from './log.js'
import { jsonParse, jsonStringify } from './slowOperations.js'
import type { BackendType } from './swarm/backends/types.js'
import { TEAM_LEAD_NAME } from './swarm/constants.js'
import { sanitizePathComponent } from './tasks.js'
import { getAgentName, getTeammateColor, getTeamName } from './teammate.js'

// Lock options: retry with backoff so concurrent callers (multiple Claudes
// in a swarm) wait for the lock instead of failing immediately. The sync
// lockSync API blocked the event loop; the async API needs explicit retries
// to achieve the same serialization semantics.
const LOCK_OPTIONS = {
  retries: {
    retries: 10,
    minTimeout: 5,
    maxTimeout: 100,
  },
}

export type TeammateMessage = {
  from: string
  text: string
  timestamp: string
  read: boolean
  color?: string // Sender's assigned color (e.g., 'red', 'blue', 'green')
  summary?: string // 5-10 word summary shown as preview in the UI
}

/**
 * Get the path to a teammate's inbox file
 * Structure: ~/.claude/teams/{team_name}/inboxes/{agent_name}.json
 */
export function getInboxPath(agentName: string, teamName?: string): string {
  const team = teamName || getTeamName() || 'default'
  const safeTeam = sanitizePathComponent(team)
  const safeAgentName = sanitizePathComponent(agentName)
  const inboxDir = join(getTeamsDir(), safeTeam, 'inboxes')
  const fullPath = join(inboxDir, `${safeAgentName}.json`)
  logForDebugging(
    `[TeammateMailbox] getInboxPath: agent=${agentName}, team=${team}, fullPath=${fullPath}`,
  )
  return fullPath
}

/**
 * Ensure the inbox directory exists for a team
 */
async function ensureInboxDir(teamName?: string): Promise<void> {
  const team = teamName || getTeamName() || 'default'
  const safeTeam = sanitizePathComponent(team)
  const inboxDir = join(getTeamsDir(), safeTeam, 'inboxes')
  await mkdir(inboxDir, { recursive: true })
  logForDebugging(`[TeammateMailbox] Ensured inbox directory: ${inboxDir}`)
}

/**
 * Read all messages from a teammate's inbox
 * @param agentName - The agent name (not UUID) to read inbox for
 * @param teamName - Optional team name (defaults to CLAUDE_CODE_TEAM_NAME env var or 'default')
 */
export async function readMailbox(
  agentName: string,
  teamName?: string,
): Promise<TeammateMessage[]> {
  const inboxPath = getInboxPath(agentName, teamName)
  logForDebugging(`[TeammateMailbox] readMailbox: path=${inboxPath}`)

  try {
    const content = await readFile(inboxPath, 'utf-8')
    const messages = jsonParse(content) as TeammateMessage[]
    logForDebugging(
      `[TeammateMailbox] readMailbox: read ${messages.length} message(s)`,
    )
    return messages
  } catch (error) {
    const code = getErrnoCode(error)
    if (code === 'ENOENT') {
      logForDebugging(`[TeammateMailbox] readMailbox: file does not exist`)
      return []
    }
    logForDebugging(`Failed to read inbox for ${agentName}: ${error}`)
    logError(error)
    return []
  }
}

/**
 * Read only unread messages from a teammate's inbox
 * @param agentName - The agent name (not UUID) to read inbox for
 * @param teamName - Optional team name
 */
export async function readUnreadMessages(
  agentName: string,
  teamName?: string,
): Promise<TeammateMessage[]> {
  const messages = await readMailbox(agentName, teamName)
  const unread = messages.filter(m => !m.read)
  logForDebugging(
    `[TeammateMailbox] readUnreadMessages: ${unread.length} unread of ${messages.length} total`,
  )
  return unread
}

/**
 * Write a message to a teammate's inbox
 * Uses file locking to prevent race conditions when multiple agents write concurrently
 * @param recipientName - The recipient's agent name (not UUID)
 * @param message - The message to write
 * @param teamName - Optional team name
 */
export async function writeToMailbox(
  recipientName: string,
  message: Omit<TeammateMessage, 'read'>,
  teamName?: string,
): Promise<void> {
  await ensureInboxDir(teamName)

  const inboxPath = getInboxPath(recipientName, teamName)
  const lockFilePath = `${inboxPath}.lock`

  logForDebugging(
    `[TeammateMailbox] writeToMailbox: recipient=${recipientName}, from=${message.from}, path=${inboxPath}`,
  )

  // Ensure the inbox file exists before locking (proper-lockfile requires the file to exist)
  try {
    await writeFile(inboxPath, '[]', { encoding: 'utf-8', flag: 'wx' })
    logForDebugging(`[TeammateMailbox] writeToMailbox: created new inbox file`)
  } catch (error) {
    const code = getErrnoCode(error)
    if (code !== 'EEXIST') {
      logForDebugging(
        `[TeammateMailbox] writeToMailbox: failed to create inbox file: ${error}`,
      )
      logError(error)
      return
    }
  }

  let release: (() => Promise<void>) | undefined
  try {
    release = await lockfile.lock(inboxPath, {
      lockfilePath: lockFilePath,
      ...LOCK_OPTIONS,
    })

    // Re-read messages after acquiring lock to get the latest state
    const messages = await readMailbox(recipientName, teamName)

    const newMessage: TeammateMessage = {
      ...message,
      read: false,
    }

    messages.push(newMessage)

    await writeFile(inboxPath, jsonStringify(messages, null, 2), 'utf-8')
    logForDebugging(
      `[TeammateMailbox] Wrote message to ${recipientName}'s inbox from ${message.from}`,
    )
  } catch (error) {
    logForDebugging(`Failed to write to inbox for ${recipientName}: ${error}`)
    logError(error)
  } finally {
    if (release) {
      await release()
    }
  }
}

/**
 * Mark a specific message in a teammate's inbox as read by index
 * Uses file locking to prevent race conditions
 * @param agentName - The agent name to mark message as read for
 * @param teamName - Optional team name
 * @param messageIndex - Index of the message to mark as read
 */
export async function markMessageAsReadByIndex(
  agentName: string,
  teamName: string | undefined,
  messageIndex: number,
): Promise<void> {
  const inboxPath = getInboxPath(agentName, teamName)
  logForDebugging(
    `[TeammateMailbox] markMessageAsReadByIndex called: agentName=${agentName}, teamName=${teamName}, index=${messageIndex}, path=${inboxPath}`,
  )

  const lockFilePath = `${inboxPath}.lock`

  let release: (() => Promise<void>) | undefined
  try {
    logForDebugging(
      `[TeammateMailbox] markMessageAsReadByIndex: acquiring lock...`,
    )
    release = await lockfile.lock(inboxPath, {
      lockfilePath: lockFilePath,
      ...LOCK_OPTIONS,
    })
    logForDebugging(`[TeammateMailbox] markMessageAsReadByIndex: lock acquired`)

    // Re-read messages after acquiring lock to get the latest state
    const messages = await readMailbox(agentName, teamName)
    logForDebugging(
      `[TeammateMailbox] markMessageAsReadByIndex: read ${messages.length} messages after lock`,
    )

    if (messageIndex < 0 || messageIndex >= messages.length) {
      logForDebugging(
        `[TeammateMailbox] markMessageAsReadByIndex: index ${messageIndex} out of bounds (${messages.length} messages)`,
      )
      return
    }

    const message = messages[messageIndex]
    if (!message || message.read) {
      logForDebugging(
        `[TeammateMailbox] markMessageAsReadByIndex: message already read or missing`,
      )
      return
    }

    messages[messageIndex] = { ...message, read: true }

    await writeFile(inboxPath, jsonStringify(messages, null, 2), 'utf-8')
    logForDebugging(
      `[TeammateMailbox] markMessageAsReadByIndex: marked message at index ${messageIndex} as read`,
    )
  } catch (error) {
    const code = getErrnoCode(error)
    if (code === 'ENOENT') {
      logForDebugging(
        `[TeammateMailbox] markMessageAsReadByIndex: file does not exist at ${inboxPath}`,
      )
      return
    }
    logForDebugging(
      `[TeammateMailbox] markMessageAsReadByIndex FAILED for ${agentName}: ${error}`,
    )
    logError(error)
  } finally {
    if (release) {
      await release()
      logForDebugging(
        `[TeammateMailbox] markMessageAsReadByIndex: lock released`,
      )
    }
  }
}

/**
 * Mark all messages in a teammate's inbox as read
 * Uses file locking to prevent race conditions
 * @param agentName - The agent name to mark messages as read for
 * @param teamName - Optional team name
 */
export async function markMessagesAsRead(
  agentName: string,
  teamName?: string,
): Promise<void> {
  const inboxPath = getInboxPath(agentName, teamName)
  logForDebugging(
    `[TeammateMailbox] markMessagesAsRead called: agentName=${agentName}, teamName=${teamName}, path=${inboxPath}`,
  )

  const lockFilePath = `${inboxPath}.lock`

  let release: (() => Promise<void>) | undefined
  try {
    logForDebugging(`[TeammateMailbox] markMessagesAsRead: acquiring lock...`)
    release = await lockfile.lock(inboxPath, {
      lockfilePath: lockFilePath,
      ...LOCK_OPTIONS,
    })
    logForDebugging(`[TeammateMailbox] markMessagesAsRead: lock acquired`)

    // Re-read messages after acquiring lock to get the latest state
    const messages = await readMailbox(agentName, teamName)
    logForDebugging(
      `[TeammateMailbox] markMessagesAsRead: read ${messages.length} messages after lock`,
    )

    if (messages.length === 0) {
      logForDebugging(
        `[TeammateMailbox] markMessagesAsRead: no messages to mark`,
      )
      return
    }

    const unreadCount = count(messages, m => !m.read)
    logForDebugging(
      `[TeammateMailbox] markMessagesAsRead: ${unreadCount} unread of ${messages.length} total`,
    )

    // messages comes from jsonParse — fresh, unshared objects safe to mutate
    for (const m of messages) m.read = true

    await writeFile(inboxPath, jsonStringify(messages, null, 2), 'utf-8')
    logForDebugging(
      `[TeammateMailbox] markMessagesAsRead: WROTE ${unreadCount} message(s) as read to ${inboxPath}`,
    )
  } catch (error) {
    const code = getErrnoCode(error)
    if (code === 'ENOENT') {
      logForDebugging(
        `[TeammateMailbox] markMessagesAsRead: file does not exist at ${inboxPath}`,
      )
      return
    }
    logForDebugging(
      `[TeammateMailbox] markMessagesAsRead FAILED for ${agentName}: ${error}`,
    )
    logError(error)
  } finally {
    if (release) {
      await release()
      logForDebugging(`[TeammateMailbox] markMessagesAsRead: lock released`)
    }
  }
}

/**
 * Clear a teammate's inbox (delete all messages)
 * @param agentName - The agent name to clear inbox for
 * @param teamName - Optional team name
 */
export async function clearMailbox(
  agentName: string,
  teamName?: string,
): Promise<void> {
  const inboxPath = getInboxPath(agentName, teamName)

  try {
    // flag 'r+' throws ENOENT if the file doesn't exist, so we don't
    // accidentally create an inbox file that wasn't there.
    await writeFile(inboxPath, '[]', { encoding: 'utf-8', flag: 'r+' })
    logForDebugging(`[TeammateMailbox] Cleared inbox for ${agentName}`)
  } catch (error) {
    const code = getErrnoCode(error)
    if (code === 'ENOENT') {
      return
    }
    logForDebugging(`Failed to clear inbox for ${agentName}: ${error}`)
    logError(error)
  }
}

/**
 * Format teammate messages as XML for attachment display
 */
export function formatTeammateMessages(
  messages: Array<{
    from: string
    text: string
    timestamp: string
    color?: string
    summary?: string
  }>,
): string {
  return messages
    .map(m => {
      const colorAttr = m.color ? ` color="${m.color}"` : ''
      const summaryAttr = m.summary ? ` summary="${m.summary}"` : ''
      return `<${TEAMMATE_MESSAGE_TAG} teammate_id="${m.from}"${colorAttr}${summaryAttr}>\n${m.text}\n</${TEAMMATE_MESSAGE_TAG}>`
    })
    .join('\n\n')
}

/**
 * Structured message sent when a teammate becomes idle (via Stop hook)
 */
export type IdleNotificationMessage = {
  type: 'idle_notification'
  from: string
  timestamp: string
  /** Why the agent went idle */
  idleReason?: 'available' | 'interrupted' | 'failed'
  /** Brief summary of the last DM sent this turn (if any) */
  summary?: string
  completedTaskId?: string
  completedStatus?: 'resolved' | 'blocked' | 'failed'
  failureReason?: string
}

/**
 * Creates an idle notification message to send to the team leader
 */
export function createIdleNotification(
  agentId: string,
  options?: {
    idleReason?: IdleNotificationMessage['idleReason']
    summary?: string
    completedTaskId?: string
    completedStatus?: 'resolved' | 'blocked' | 'failed'
    failureReason?: string
  },
): IdleNotificationMessage {
  return {
    type: 'idle_notification',
    from: agentId,
    timestamp: new Date().toISOString(),
    idleReason: options?.idleReason,
    summary: options?.summary,
    completedTaskId: options?.completedTaskId,
    completedStatus: options?.completedStatus,
    failureReason: options?.failureReason,
  }
}

/**
 * Checks if a message text contains an idle notification
 */
export function isIdleNotification(
  messageText: string,
): IdleNotificationMessage | null {
  try {
    const parsed = jsonParse(messageText)
    if (parsed && parsed.type === 'idle_notification') {
      return parsed as IdleNotificationMessage
    }
  } catch {
    // Not JSON or not a valid idle notification
  }
  return null
}

/**
 * Permission request message sent from worker to leader via mailbox.
 * Field names align with SDK `can_use_tool` (snake_case).
 */
export type PermissionRequestMessage = {
  type: 'permission_request'
  request_id: string
  agent_id: string
  tool_name: string
  tool_use_id: string
  description: string
  input: Record<string, unknown>
  permission_suggestions: unknown[]
}

/**
 * Permission response message sent from leader to worker via mailbox.
 * Shape mirrors SDK ControlResponseSchema / ControlErrorResponseSchema.
 */
export type PermissionResponseMessage =
  | {
      type: 'permission_response'
      request_id: string
      subtype: 'success'
      response?: {
        updated_input?: Record<string, unknown>
        permission_updates?: unknown[]
      }
    }
  | {
      type: 'permission_response'
      request_id: string
      subtype: 'error'
      error: string
    }

/**
 * Creates a permission request message to send to the team leader
 */
export function createPermissionRequestMessage(params: {
  request_id: string
  agent_id: string
  tool_name: string
  tool_use_id: string
  description: string
  input: Record<string, unknown>
  permission_suggestions?: unknown[]
}): PermissionRequestMessage {
  return {
    type: 'permission_request',
    request_id: params.request_id,
    agent_id: params.agent_id,
    tool_name: params.tool_name,
    tool_use_id: params.tool_use_id,
    description: params.description,
    input: params.input,
    permission_suggestions: params.permission_suggestions || [],
  }
}

/**
 * Creates a permission response message to send back to a worker
 */
export function createPermissionResponseMessage(params: {
  request_id: string
  subtype: 'success' | 'error'
  error?: string
  updated_input?: Record<string, unknown>
  permission_updates?: unknown[]
}): PermissionResponseMessage {
  if (params.subtype === 'error') {
    return {
      type: 'permission_response',
      request_id: params.request_id,
      subtype: 'error',
      error: params.error || 'Permission denied',
    }
  }
  return {
    type: 'permission_response',
    request_id: params.request_id,
    subtype: 'success',
    response: {
      updated_input: params.updated_input,
      permission_updates: params.permission_updates,
    },
  }
}

/**
 * Checks if a message text contains a permission request
 */
export function isPermissionRequest(
  messageText: string,
): PermissionRequestMessage | null {
  try {
    const parsed = jsonParse(messageText)
    if (parsed && parsed.type === 'permission_request') {
      return parsed as PermissionRequestMessage
    }
  } catch {
    // Not JSON or not a valid permission request
  }
  return null
}

/**
 * Checks if a message text contains a permission response
 */
export function isPermissionResponse(
  messageText: string,
): PermissionResponseMessage | null {
  try {
    const parsed = jsonParse(messageText)
    if (parsed && parsed.type === 'permission_response') {
      return parsed as PermissionResponseMessage
    }
  } catch {
    // Not JSON or not a valid permission response
  }
  return null
}

/**
 * Sandbox permission request message sent from worker to leader via mailbox
 * This is triggered when sandbox runtime detects a network access to a non-allowed host
 */
export type SandboxPermissionRequestMessage = {
  type: 'sandbox_permission_request'
  /** Unique identifier for this request */
  requestId: string
  /** Worker's CLAUDE_CODE_AGENT_ID */
  workerId: string
  /** Worker's CLAUDE_CODE_AGENT_NAME */
  workerName: string
  /** Worker's CLAUDE_CODE_AGENT_COLOR */
  workerColor?: string
  /** The host pattern requesting network access */
  hostPattern: {
    host: string
  }
  /** Timestamp when request was created */
  createdAt: number
}

/**
 * Sandbox permission response message sent from leader to worker via mailbox
 */
export type SandboxPermissionResponseMessage = {
  type: 'sandbox_permission_response'
  /** ID of the request this responds to */
  requestId: string
  /** The host that was approved/denied */
  host: string
  /** Whether the connection is allowed */
  allow: boolean
  /** Timestamp when response was created */
  timestamp: string
}

/**
 * Creates a sandbox permission request message to send to the team leader
 */
export function createSandboxPermissionRequestMessage(params: {
  requestId: string
  workerId: string
  workerName: string
  workerColor?: string
  host: string
}): SandboxPermissionRequestMessage {
  return {
    type: 'sandbox_permission_request',
    requestId: params.requestId,
    workerId: params.workerId,
    workerName: params.workerName,
    workerColor: params.workerColor,
    hostPattern: { host: params.host },
    createdAt: Date.now(),
  }
}

/**
 * Creates a sandbox permission response message to send back to a worker
 */
export function createSandboxPermissionResponseMessage(params: {
  requestId: string
  host: string
  allow: boolean
}): SandboxPermissionResponseMessage {
  return {
    type: 'sandbox_permission_response',
    requestId: params.requestId,
    host: params.host,
    allow: params.allow,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Checks if a message text contains a sandbox permission request
 */
export function isSandboxPermissionRequest(
  messageText: string,
): SandboxPermissionRequestMessage | null {
  try {
    const parsed = jsonParse(messageText)
    if (parsed && parsed.type === 'sandbox_permission_request') {
      return parsed as SandboxPermissionRequestMessage
    }
  } catch {
    // Not JSON or not a valid sandbox permission request
  }
  return null
}

/**
 * Checks if a message text contains a sandbox permission response
 */
export function isSandboxPermissionResponse(
  messageText: string,
): SandboxPermissionResponseMessage | null {
  try {
    const parsed = jsonParse(messageText)
    if (parsed && parsed.type === 'sandbox_permission_response') {
      return parsed as SandboxPermissionResponseMessage
    }
  } catch {
    // Not JSON or not a valid sandbox permission response
  }
  return null
}

/**
 * Message sent when a teammate requests plan approval from the team leader
 */
export const PlanApprovalRequestMessageSchema = lazySchema(() =>
  z.object({
    type: z.literal('plan_approval_request'),
    from: z.string(),
    timestamp: z.string(),
    planFilePath: z.string(),
    planContent: z.string(),
    requestId: z.string(),
  }),
)

export type PlanApprovalRequestMessage = z.infer<
  ReturnType<typeof PlanApprovalRequestMessageSchema>
>

/**
 * Message sent by the team leader in response to a plan approval request
 */
export const PlanApprovalResponseMessageSchema = lazySchema(() =>
  z.object({
    type: z.literal('plan_approval_response'),
    requestId: z.string(),
    approved: z.boolean(),
    feedback: z.string().optional(),
    timestamp: z.string(),
    permissionMode: PermissionModeSchema().optional(),
  }),
)

export type PlanApprovalResponseMessage = z.infer<
  ReturnType<typeof PlanApprovalResponseMessageSchema>
>

/**
 * Shutdown request message sent from leader to teammate via mailbox
 */
export const ShutdownRequestMessageSchema = lazySchema(() =>
  z.object({
    type: z.literal('shutdown_request'),
    requestId: z.string(),
    from: z.string(),
    reason: z.string().optional(),
    timestamp: z.string(),
  }),
)

export type ShutdownRequestMessage = z.infer<
  ReturnType<typeof ShutdownRequestMessageSchema>
>

/**
 * Shutdown approved message sent from teammate to leader via mailbox
 */
export const ShutdownApprovedMessageSchema = lazySchema(() =>
  z.object({
    type: z.literal('shutdown_approved'),
    requestId: z.string(),
    from: z.string(),
    timestamp: z.string(),
    paneId: z.string().optional(),
    backendType: z.string().optional(),
  }),
)

export type ShutdownApprovedMessage = z.infer<
  ReturnType<typeof ShutdownApprovedMessageSchema>
>

/**
 * Shutdown rejected message sent from teammate to leader via mailbox
 */
export const ShutdownRejectedMessageSchema = lazySchema(() =>
  z.object({
    type: z.literal('shutdown_rejected'),
    requestId: z.string(),
    from: z.string(),
    reason: z.string(),
    timestamp: z.string(),
  }),
)

export type ShutdownRejectedMessage = z.infer<
  ReturnType<typeof ShutdownRejectedMessageSchema>
>

/**
 * Creates a shutdown request message to send to a teammate
 */
export function createShutdownRequestMessage(params: {
  requestId: string
  from: string
  reason?: string
}): ShutdownRequestMessage {
  return {
    type: 'shutdown_request',
    requestId: params.requestId,
    from: params.from,
    reason: params.reason,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Creates a shutdown approved message to send to the team leader
 */
export function createShutdownApprovedMessage(params: {
  requestId: string
  from: string
  paneId?: string
  backendType?: BackendType
}): ShutdownApprovedMessage {
  return {
    type: 'shutdown_approved',
    requestId: params.requestId,
    from: params.from,
    timestamp: new Date().toISOString(),
    paneId: params.paneId,
    backendType: params.backendType,
  }
}

/**
 * Creates a shutdown rejected message to send to the team leader
 */
export function createShutdownRejectedMessage(params: {
  requestId: string
  from: string
  reason: string
}): ShutdownRejectedMessage {
  return {
    type: 'shutdown_rejected',
    requestId: params.requestId,
    from: params.from,
    reason: params.reason,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Sends a shutdown request to a teammate's mailbox.
 * This is the core logic extracted for reuse by both the tool and UI components.
 *
 * @param targetName - Name of the teammate to send shutdown request to
 * @param teamName - Optional team name (defaults to CLAUDE_CODE_TEAM_NAME env var)
 * @param reason - Optional reason for the shutdown request
 * @returns The request ID and target name
 */
export async function sendShutdownRequestToMailbox(
  targetName: string,
  teamName?: string,
  reason?: string,
): Promise<{ requestId: string; target: string }> {
  const resolvedTeamName = teamName || getTeamName()

  // Get sender name (supports in-process teammates via AsyncLocalStorage)
  const senderName = getAgentName() || TEAM_LEAD_NAME

  // Generate a deterministic request ID for this shutdown request
  const requestId = generateRequestId('shutdown', targetName)

  // Create and send the shutdown request message
  const shutdownMessage = createShutdownRequestMessage({
    requestId,
    from: senderName,
    reason,
  })

  await writeToMailbox(
    targetName,
    {
      from: senderName,
      text: jsonStringify(shutdownMessage),
      timestamp: new Date().toISOString(),
      color: getTeammateColor(),
    },
    resolvedTeamName,
  )

  return { requestId, target: targetName }
}

/**
 * Checks if a message text contains a shutdown request
 */
export function isShutdownRequest(
  messageText: string,
): ShutdownRequestMessage | null {
  try {
    const result = ShutdownRequestMessageSchema().safeParse(
      jsonParse(messageText),
    )
    if (result.success) return result.data
  } catch {
    // Not JSON
  }
  return null
}

/**
 * Checks if a message text contains a plan approval request
 */
export function isPlanApprovalRequest(
  messageText: string,
): PlanApprovalRequestMessage | null {
  try {
    const result = PlanApprovalRequestMessageSchema().safeParse(
      jsonParse(messageText),
    )
    if (result.success) return result.data
  } catch {
    // Not JSON
  }
  return null
}

/**
 * Checks if a message text contains a shutdown approved message
 */
export function isShutdownApproved(
  messageText: string,
): ShutdownApprovedMessage | null {
  try {
    const result = ShutdownApprovedMessageSchema().safeParse(
      jsonParse(messageText),
    )
    if (result.success) return result.data
  } catch {
    // Not JSON
  }
  return null
}

/**
 * Checks if a message text contains a shutdown rejected message
 */
export function isShutdownRejected(
  messageText: string,
): ShutdownRejectedMessage | null {
  try {
    const result = ShutdownRejectedMessageSchema().safeParse(
      jsonParse(messageText),
    )
    if (result.success) return result.data
  } catch {
    // Not JSON
  }
  return null
}

/**
 * Checks if a message text contains a plan approval response
 */
export function isPlanApprovalResponse(
  messageText: string,
): PlanApprovalResponseMessage | null {
  try {
    const result = PlanApprovalResponseMessageSchema().safeParse(
      jsonParse(messageText),
    )
    if (result.success) return result.data
  } catch {
    // Not JSON
  }
  return null
}

/**
 * Task assignment message sent when a task is assigned to a teammate
 */
export type TaskAssignmentMessage = {
  type: 'task_assignment'
  taskId: string
  subject: string
  description: string
  assignedBy: string
  timestamp: string
}

/**
 * Checks if a message text contains a task assignment
 */
export function isTaskAssignment(
  messageText: string,
): TaskAssignmentMessage | null {
  try {
    const parsed = jsonParse(messageText)
    if (parsed && parsed.type === 'task_assignment') {
      return parsed as TaskAssignmentMessage
    }
  } catch {
    // Not JSON or not a valid task assignment
  }
  return null
}

/**
 * Team permission update message sent from leader to teammates via mailbox
 * Broadcasts a permission update that applies to all teammates
 */
export type TeamPermissionUpdateMessage = {
  type: 'team_permission_update'
  /** The permission update to apply */
  permissionUpdate: {
    type: 'addRules'
    rules: Array<{ toolName: string; ruleContent?: string }>
    behavior: 'allow' | 'deny' | 'ask'
    destination: 'session'
  }
  /** The directory path that was allowed */
  directoryPath: string
  /** The tool name this applies to */
  toolName: string
}

/**
 * Checks if a message text contains a team permission update
 */
export function isTeamPermissionUpdate(
  messageText: string,
): TeamPermissionUpdateMessage | null {
  try {
    const parsed = jsonParse(messageText)
    if (parsed && parsed.type === 'team_permission_update') {
      return parsed as TeamPermissionUpdateMessage
    }
  } catch {
    // Not JSON or not a valid team permission update
  }
  return null
}

/**
 * Mode set request message sent from leader to teammate via mailbox
 * Uses SDK PermissionModeSchema for validated mode values
 */
export const ModeSetRequestMessageSchema = lazySchema(() =>
  z.object({
    type: z.literal('mode_set_request'),
    mode: PermissionModeSchema(),
    from: z.string(),
  }),
)

export type ModeSetRequestMessage = z.infer<
  ReturnType<typeof ModeSetRequestMessageSchema>
>

/**
 * Creates a mode set request message to send to a teammate
 */
export function createModeSetRequestMessage(params: {
  mode: string
  from: string
}): ModeSetRequestMessage {
  return {
    type: 'mode_set_request',
    mode: params.mode as ModeSetRequestMessage['mode'],
    from: params.from,
  }
}

/**
 * Checks if a message text contains a mode set request
 */
export function isModeSetRequest(
  messageText: string,
): ModeSetRequestMessage | null {
  try {
    const parsed = ModeSetRequestMessageSchema().safeParse(
      jsonParse(messageText),
    )
    if (parsed.success) {
      return parsed.data
    }
  } catch {
    // Not JSON or not a valid mode set request
  }
  return null
}

/**
 * Checks if a message text is a structured protocol message that should be
 * routed by useInboxPoller rather than consumed as raw LLM context.
 *
 * These message types have specific handlers in useInboxPoller that route them
 * to the correct queues (workerPermissions, workerSandboxPermissions, etc.).
 * If getTeammateMailboxAttachments consumes them first, they get bundled as
 * raw text in attachments and never reach their intended handlers.
 */
export function isStructuredProtocolMessage(messageText: string): boolean {
  try {
    const parsed = jsonParse(messageText)
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      return false
    }
    const type = (parsed as { type: unknown }).type
    return (
      type === 'permission_request' ||
      type === 'permission_response' ||
      type === 'sandbox_permission_request' ||
      type === 'sandbox_permission_response' ||
      type === 'shutdown_request' ||
      type === 'shutdown_approved' ||
      type === 'team_permission_update' ||
      type === 'mode_set_request' ||
      type === 'plan_approval_request' ||
      type === 'plan_approval_response'
    )
  } catch {
    return false
  }
}

/**
 * Marks only messages matching a predicate as read, leaving others unread.
 * Uses the same file-locking mechanism as markMessagesAsRead.
 */
export async function markMessagesAsReadByPredicate(
  agentName: string,
  predicate: (msg: TeammateMessage) => boolean,
  teamName?: string,
): Promise<void> {
  const inboxPath = getInboxPath(agentName, teamName)

  const lockFilePath = `${inboxPath}.lock`
  let release: (() => Promise<void>) | undefined

  try {
    release = await lockfile.lock(inboxPath, {
      lockfilePath: lockFilePath,
      ...LOCK_OPTIONS,
    })

    const messages = await readMailbox(agentName, teamName)
    if (messages.length === 0) {
      return
    }

    const updatedMessages = messages.map(m =>
      !m.read && predicate(m) ? { ...m, read: true } : m,
    )

    await writeFile(inboxPath, jsonStringify(updatedMessages, null, 2), 'utf-8')
  } catch (error) {
    const code = getErrnoCode(error)
    if (code === 'ENOENT') {
      return
    }
    logError(error)
  } finally {
    if (release) {
      try {
        await release()
      } catch {
        // Lock may have already been released
      }
    }
  }
}

/**
 * Extracts a "[to {name}] {summary}" string from the last assistant message
 * if it ended with a SendMessage tool_use targeting a peer (not the team lead).
 * Returns undefined when the turn didn't end with a peer DM.
 */
export function getLastPeerDmSummary(messages: Message[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!msg) continue

    // Stop at wake-up boundary: a user prompt (string content), not tool results (array content)
    if (msg.type === 'user' && typeof msg.message.content === 'string') {
      break
    }

    if (msg.type !== 'assistant') continue
    for (const block of msg.message.content) {
      if (
        block.type === 'tool_use' &&
        block.name === SEND_MESSAGE_TOOL_NAME &&
        typeof block.input === 'object' &&
        block.input !== null &&
        'to' in block.input &&
        typeof block.input.to === 'string' &&
        block.input.to !== '*' &&
        block.input.to.toLowerCase() !== TEAM_LEAD_NAME.toLowerCase() &&
        'message' in block.input &&
        typeof block.input.message === 'string'
      ) {
        const to = block.input.to
        const summary =
          'summary' in block.input && typeof block.input.summary === 'string'
            ? block.input.summary
            : block.input.message.slice(0, 80)
        return `[to ${to}] ${summary}`
      }
    }
  }
  return undefined
}
