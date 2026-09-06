import { mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod/v4'
import { getCwd } from '../../utils/cwd.js'
import { logForDebugging } from '../../utils/debug.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js'
import { type AgentMemoryScope, getAgentMemoryDir } from './agentMemory.js'

const SNAPSHOT_BASE = 'agent-memory-snapshots'
const SNAPSHOT_JSON = 'snapshot.json'
const SYNCED_JSON = '.snapshot-synced.json'

const snapshotMetaSchema = lazySchema(() =>
  z.object({
    updatedAt: z.string().min(1),
  }),
)

const syncedMetaSchema = lazySchema(() =>
  z.object({
    syncedFrom: z.string().min(1),
  }),
)
type SyncedMeta = z.infer<ReturnType<typeof syncedMetaSchema>>

/**
 * Returns the path to the snapshot directory for an agent in the current project.
 * e.g., <cwd>/.claude/agent-memory-snapshots/<agentType>/
 */
export function getSnapshotDirForAgent(agentType: string): string {
  return join(getCwd(), '.claude', SNAPSHOT_BASE, agentType)
}

function getSnapshotJsonPath(agentType: string): string {
  return join(getSnapshotDirForAgent(agentType), SNAPSHOT_JSON)
}

function getSyncedJsonPath(agentType: string, scope: AgentMemoryScope): string {
  return join(getAgentMemoryDir(agentType, scope), SYNCED_JSON)
}

async function readJsonFile<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  try {
    const content = await readFile(path, { encoding: 'utf-8' })
    const result = schema.safeParse(jsonParse(content))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

async function copySnapshotToLocal(
  agentType: string,
  scope: AgentMemoryScope,
): Promise<void> {
  const snapshotMemDir = getSnapshotDirForAgent(agentType)
  const localMemDir = getAgentMemoryDir(agentType, scope)

  await mkdir(localMemDir, { recursive: true })

  try {
    const files = await readdir(snapshotMemDir, { withFileTypes: true })
    for (const dirent of files) {
      if (!dirent.isFile() || dirent.name === SNAPSHOT_JSON) continue
      const content = await readFile(join(snapshotMemDir, dirent.name), {
        encoding: 'utf-8',
      })
      await writeFile(join(localMemDir, dirent.name), content)
    }
  } catch (e) {
    logForDebugging(`Failed to copy snapshot to local agent memory: ${e}`)
  }
}

async function saveSyncedMeta(
  agentType: string,
  scope: AgentMemoryScope,
  snapshotTimestamp: string,
): Promise<void> {
  const syncedPath = getSyncedJsonPath(agentType, scope)
  const localMemDir = getAgentMemoryDir(agentType, scope)
  await mkdir(localMemDir, { recursive: true })
  const meta: SyncedMeta = { syncedFrom: snapshotTimestamp }
  try {
    await writeFile(syncedPath, jsonStringify(meta))
  } catch (e) {
    logForDebugging(`Failed to save snapshot sync metadata: ${e}`)
  }
}

/**
 * Check if a snapshot exists and whether it's newer than what we last synced.
 */
export async function checkAgentMemorySnapshot(
  agentType: string,
  scope: AgentMemoryScope,
): Promise<{
  action: 'none' | 'initialize' | 'prompt-update'
  snapshotTimestamp?: string
}> {
  const snapshotMeta = await readJsonFile(
    getSnapshotJsonPath(agentType),
    snapshotMetaSchema(),
  )

  if (!snapshotMeta) {
    return { action: 'none' }
  }

  const localMemDir = getAgentMemoryDir(agentType, scope)

  let hasLocalMemory = false
  try {
    const dirents = await readdir(localMemDir, { withFileTypes: true })
    hasLocalMemory = dirents.some(d => d.isFile() && d.name.endsWith('.md'))
  } catch {
    // Directory doesn't exist
  }

  if (!hasLocalMemory) {
    return { action: 'initialize', snapshotTimestamp: snapshotMeta.updatedAt }
  }

  const syncedMeta = await readJsonFile(
    getSyncedJsonPath(agentType, scope),
    syncedMetaSchema(),
  )

  if (
    !syncedMeta ||
    new Date(snapshotMeta.updatedAt) > new Date(syncedMeta.syncedFrom)
  ) {
    return {
      action: 'prompt-update',
      snapshotTimestamp: snapshotMeta.updatedAt,
    }
  }

  return { action: 'none' }
}

/**
 * Initialize local agent memory from a snapshot (first-time setup).
 */
export async function initializeFromSnapshot(
  agentType: string,
  scope: AgentMemoryScope,
  snapshotTimestamp: string,
): Promise<void> {
  logForDebugging(
    `Initializing agent memory for ${agentType} from project snapshot`,
  )
  await copySnapshotToLocal(agentType, scope)
  await saveSyncedMeta(agentType, scope, snapshotTimestamp)
}

/**
 * Replace local agent memory with the snapshot.
 */
export async function replaceFromSnapshot(
  agentType: string,
  scope: AgentMemoryScope,
  snapshotTimestamp: string,
): Promise<void> {
  logForDebugging(
    `Replacing agent memory for ${agentType} with project snapshot`,
  )
  // Remove existing .md files before copying to avoid orphans
  const localMemDir = getAgentMemoryDir(agentType, scope)
  try {
    const existing = await readdir(localMemDir, { withFileTypes: true })
    for (const dirent of existing) {
      if (dirent.isFile() && dirent.name.endsWith('.md')) {
        await unlink(join(localMemDir, dirent.name))
      }
    }
  } catch {
    // Directory may not exist yet
  }
  await copySnapshotToLocal(agentType, scope)
  await saveSyncedMeta(agentType, scope, snapshotTimestamp)
}

/**
 * Mark the current snapshot as synced without changing local memory.
 */
export async function markSnapshotSynced(
  agentType: string,
  scope: AgentMemoryScope,
  snapshotTimestamp: string,
): Promise<void> {
  await saveSyncedMeta(agentType, scope, snapshotTimestamp)
}
