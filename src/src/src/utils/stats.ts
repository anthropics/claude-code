import { feature } from 'bun:bundle'
import { open } from 'fs/promises'
import { basename, dirname, join, sep } from 'path'
import type { ModelUsage } from 'src/entrypoints/agentSdkTypes.js'
import type { Entry, TranscriptMessage } from '../types/logs.js'
import { logForDebugging } from './debug.js'
import { errorMessage, isENOENT } from './errors.js'
import { getFsImplementation } from './fsOperations.js'
import { readJSONLFile } from './json.js'
import { SYNTHETIC_MODEL } from './messages.js'
import { getProjectsDir, isTranscriptMessage } from './sessionStorage.js'
import { SHELL_TOOL_NAMES } from './shell/shellToolUtils.js'
import { jsonParse } from './slowOperations.js'
import {
  getTodayDateString,
  getYesterdayDateString,
  isDateBefore,
  loadStatsCache,
  mergeCacheWithNewStats,
  type PersistedStatsCache,
  saveStatsCache,
  toDateString,
  withStatsCacheLock,
} from './statsCache.js'

export type DailyActivity = {
  date: string // YYYY-MM-DD format
  messageCount: number
  sessionCount: number
  toolCallCount: number
}

export type DailyModelTokens = {
  date: string // YYYY-MM-DD format
  tokensByModel: { [modelName: string]: number } // total tokens (input + output) per model
}

export type StreakInfo = {
  currentStreak: number
  longestStreak: number
  currentStreakStart: string | null
  longestStreakStart: string | null
  longestStreakEnd: string | null
}

export type SessionStats = {
  sessionId: string
  duration: number // in milliseconds
  messageCount: number
  timestamp: string
}

export type ClaudeCodeStats = {
  // Activity overview
  totalSessions: number
  totalMessages: number
  totalDays: number
  activeDays: number

  // Streaks
  streaks: StreakInfo

  // Daily activity for heatmap
  dailyActivity: DailyActivity[]

  // Daily token usage per model for charts
  dailyModelTokens: DailyModelTokens[]

  // Session info
  longestSession: SessionStats | null

  // Model usage aggregated
  modelUsage: { [modelName: string]: ModelUsage }

  // Time stats
  firstSessionDate: string | null
  lastSessionDate: string | null
  peakActivityDay: string | null
  peakActivityHour: number | null

  // Speculation time saved
  totalSpeculationTimeSavedMs: number

  // Shot stats (ant-only, gated by SHOT_STATS feature flag)
  shotDistribution?: { [shotCount: number]: number }
  oneShotRate?: number
}

/**
 * Result of processing session files - intermediate stats that can be merged.
 */
type ProcessedStats = {
  dailyActivity: DailyActivity[]
  dailyModelTokens: DailyModelTokens[]
  modelUsage: { [modelName: string]: ModelUsage }
  sessionStats: SessionStats[]
  hourCounts: { [hour: number]: number }
  totalMessages: number
  totalSpeculationTimeSavedMs: number
  shotDistribution?: { [shotCount: number]: number }
}

/**
 * Options for processing session files.
 */
type ProcessOptions = {
  // Only include data from dates >= this date (YYYY-MM-DD format)
  fromDate?: string
  // Only include data from dates <= this date (YYYY-MM-DD format)
  toDate?: string
}

/**
 * Process session files and extract stats.
 * Can filter by date range.
 */
async function processSessionFiles(
  sessionFiles: string[],
  options: ProcessOptions = {},
): Promise<ProcessedStats> {
  const { fromDate, toDate } = options
  const fs = getFsImplementation()

  const dailyActivityMap = new Map<string, DailyActivity>()
  const dailyModelTokensMap = new Map<string, { [modelName: string]: number }>()
  const sessions: SessionStats[] = []
  const hourCounts = new Map<number, number>()
  let totalMessages = 0
  let totalSpeculationTimeSavedMs = 0
  const modelUsageAgg: { [modelName: string]: ModelUsage } = {}
  const shotDistributionMap = feature('SHOT_STATS')
    ? new Map<number, number>()
    : undefined
  // Track parent sessions that already recorded a shot count (dedup across subagents)
  const sessionsWithShotCount = new Set<string>()

  // Process session files in parallel batches for better performance
  const BATCH_SIZE = 20
  for (let i = 0; i < sessionFiles.length; i += BATCH_SIZE) {
    const batch = sessionFiles.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async sessionFile => {
        try {
          // If we have a fromDate filter, skip files that haven't been modified since then
          if (fromDate) {
            let fileSize = 0
            try {
              const fileStat = await fs.stat(sessionFile)
              const fileModifiedDate = toDateString(fileStat.mtime)
              if (isDateBefore(fileModifiedDate, fromDate)) {
                return {
                  sessionFile,
                  entries: null,
                  error: null,
                  skipped: true,
                }
              }
              fileSize = fileStat.size
            } catch {
              // If we can't stat the file, try to read it anyway
            }
            // For large files, peek at the session start date before reading everything.
            // Sessions that pass the mtime filter but started before fromDate are skipped
            // (e.g. a month-old session resumed today gets a new mtime write but old start date).
            if (fileSize > 65536) {
              const startDate = await readSessionStartDate(sessionFile)
              if (startDate && isDateBefore(startDate, fromDate)) {
                return {
                  sessionFile,
                  entries: null,
                  error: null,
                  skipped: true,
                }
              }
            }
          }
          const entries = await readJSONLFile<Entry>(sessionFile)
          return { sessionFile, entries, error: null, skipped: false }
        } catch (error) {
          return { sessionFile, entries: null, error, skipped: false }
        }
      }),
    )

    for (const { sessionFile, entries, error, skipped } of results) {
      if (skipped) continue
      if (error || !entries) {
        logForDebugging(
          `Failed to read session file ${sessionFile}: ${errorMessage(error)}`,
        )
        continue
      }

      const sessionId = basename(sessionFile, '.jsonl')
      const messages: TranscriptMessage[] = []

      for (const entry of entries) {
        if (isTranscriptMessage(entry)) {
          messages.push(entry)
        } else if (entry.type === 'speculation-accept') {
          totalSpeculationTimeSavedMs += entry.timeSavedMs
        }
      }

      if (messages.length === 0) continue

      // Subagent transcripts mark all messages as sidechain. We still want
      // their token usage counted, but not as separate sessions.
      const isSubagentFile = sessionFile.includes(`${sep}subagents${sep}`)

      // Extract shot count from PR attribution in gh pr create calls (ant-only)
      // This must run before the sidechain filter since subagent transcripts
      // mark all messages as sidechain
      if (feature('SHOT_STATS') && shotDistributionMap) {
        const parentSessionId = isSubagentFile
          ? basename(dirname(dirname(sessionFile)))
          : sessionId

        if (!sessionsWithShotCount.has(parentSessionId)) {
          const shotCount = extractShotCountFromMessages(messages)
          if (shotCount !== null) {
            sessionsWithShotCount.add(parentSessionId)
            shotDistributionMap.set(
              shotCount,
              (shotDistributionMap.get(shotCount) || 0) + 1,
            )
          }
        }
      }

      // Filter out sidechain messages for session metadata (duration, counts).
      // For subagent files, use all messages since they're all sidechain.
      const mainMessages = isSubagentFile
        ? messages
        : messages.filter(m => !m.isSidechain)
      if (mainMessages.length === 0) continue

      const firstMessage = mainMessages[0]!
      const lastMessage = mainMessages.at(-1)!

      const firstTimestamp = new Date(firstMessage.timestamp)
      const lastTimestamp = new Date(lastMessage.timestamp)

      // Skip sessions with malformed timestamps — some transcripts on disk
      // have entries missing the timestamp field (e.g. partial/remote writes).
      // new Date(undefined) produces an Invalid Date, and toDateString() would
      // throw RangeError: Invalid Date on .toISOString().
      if (isNaN(firstTimestamp.getTime()) || isNaN(lastTimestamp.getTime())) {
        logForDebugging(
          `Skipping session with invalid timestamp: ${sessionFile}`,
        )
        continue
      }

      const dateKey = toDateString(firstTimestamp)

      // Apply date filters
      if (fromDate && isDateBefore(dateKey, fromDate)) continue
      if (toDate && isDateBefore(toDate, dateKey)) continue

      // Track daily activity (use first message date as session date)
      const existing = dailyActivityMap.get(dateKey) || {
        date: dateKey,
        messageCount: 0,
        sessionCount: 0,
        toolCallCount: 0,
      }

      // Subagent files contribute tokens and tool calls, but aren't sessions.
      if (!isSubagentFile) {
        const duration = lastTimestamp.getTime() - firstTimestamp.getTime()

        sessions.push({
          sessionId,
          duration,
          messageCount: mainMessages.length,
          timestamp: firstMessage.timestamp,
        })

        totalMessages += mainMessages.length

        existing.sessionCount++
        existing.messageCount += mainMessages.length

        const hour = firstTimestamp.getHours()
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
      }

      if (!isSubagentFile || dailyActivityMap.has(dateKey)) {
        dailyActivityMap.set(dateKey, existing)
      }

      // Process messages for tool usage and model stats
      for (const message of mainMessages) {
        if (message.type === 'assistant') {
          const content = message.message?.content
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'tool_use') {
                const activity = dailyActivityMap.get(dateKey)
                if (activity) {
                  activity.toolCallCount++
                }
              }
            }
          }

          // Track model usage if available (skip synthetic messages)
          if (message.message?.usage) {
            const usage = message.message.usage
            const model = message.message.model || 'unknown'

            // Skip synthetic messages - they are internal and shouldn't appear in stats
            if (model === SYNTHETIC_MODEL) {
              continue
            }

            if (!modelUsageAgg[model]) {
              modelUsageAgg[model] = {
                inputTokens: 0,
                outputTokens: 0,
                cacheReadInputTokens: 0,
                cacheCreationInputTokens: 0,
                webSearchRequests: 0,
                costUSD: 0,
                contextWindow: 0,
                maxOutputTokens: 0,
              }
            }

            modelUsageAgg[model]!.inputTokens += usage.input_tokens || 0
            modelUsageAgg[model]!.outputTokens += usage.output_tokens || 0
            modelUsageAgg[model]!.cacheReadInputTokens +=
              usage.cache_read_input_tokens || 0
            modelUsageAgg[model]!.cacheCreationInputTokens +=
              usage.cache_creation_input_tokens || 0

            // Track daily tokens per model
            const totalTokens =
              (usage.input_tokens || 0) + (usage.output_tokens || 0)
            if (totalTokens > 0) {
              const dayTokens = dailyModelTokensMap.get(dateKey) || {}
              dayTokens[model] = (dayTokens[model] || 0) + totalTokens
              dailyModelTokensMap.set(dateKey, dayTokens)
            }
          }
        }
      }
    }
  }

  return {
    dailyActivity: Array.from(dailyActivityMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    dailyModelTokens: Array.from(dailyModelTokensMap.entries())
      .map(([date, tokensByModel]) => ({ date, tokensByModel }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    modelUsage: modelUsageAgg,
    sessionStats: sessions,
    hourCounts: Object.fromEntries(hourCounts),
    totalMessages,
    totalSpeculationTimeSavedMs,
    ...(feature('SHOT_STATS') && shotDistributionMap
      ? { shotDistribution: Object.fromEntries(shotDistributionMap) }
      : {}),
  }
}

/**
 * Get all session files from all project directories.
 * Includes both main session files and subagent transcript files.
 */
async function getAllSessionFiles(): Promise<string[]> {
  const projectsDir = getProjectsDir()
  const fs = getFsImplementation()

  // Get all project directories
  let allEntries
  try {
    allEntries = await fs.readdir(projectsDir)
  } catch (e) {
    if (isENOENT(e)) return []
    throw e
  }
  const projectDirs = allEntries
    .filter(dirent => dirent.isDirectory())
    .map(dirent => join(projectsDir, dirent.name))

  // Collect all session files from all projects in parallel
  const projectResults = await Promise.all(
    projectDirs.map(async projectDir => {
      try {
        const entries = await fs.readdir(projectDir)

        // Collect main session files (*.jsonl directly in project dir)
        const mainFiles = entries
          .filter(dirent => dirent.isFile() && dirent.name.endsWith('.jsonl'))
          .map(dirent => join(projectDir, dirent.name))

        // Collect subagent files from session subdirectories in parallel
        // Structure: {projectDir}/{sessionId}/subagents/agent-{agentId}.jsonl
        const sessionDirs = entries.filter(dirent => dirent.isDirectory())
        const subagentResults = await Promise.all(
          sessionDirs.map(async sessionDir => {
            const subagentsDir = join(projectDir, sessionDir.name, 'subagents')
            try {
              const subagentEntries = await fs.readdir(subagentsDir)
              return subagentEntries
                .filter(
                  dirent =>
                    dirent.isFile() &&
                    dirent.name.endsWith('.jsonl') &&
                    dirent.name.startsWith('agent-'),
                )
                .map(dirent => join(subagentsDir, dirent.name))
            } catch {
              // subagents directory doesn't exist for this session, skip
              return []
            }
          }),
        )

        return [...mainFiles, ...subagentResults.flat()]
      } catch (error) {
        logForDebugging(
          `Failed to read project directory ${projectDir}: ${errorMessage(error)}`,
        )
        return []
      }
    }),
  )

  return projectResults.flat()
}

/**
 * Convert a PersistedStatsCache to ClaudeCodeStats by computing derived fields.
 */
function cacheToStats(
  cache: PersistedStatsCache,
  todayStats: ProcessedStats | null,
): ClaudeCodeStats {
  // Merge cache with today's stats
  const dailyActivityMap = new Map<string, DailyActivity>()
  for (const day of cache.dailyActivity) {
    dailyActivityMap.set(day.date, { ...day })
  }
  if (todayStats) {
    for (const day of todayStats.dailyActivity) {
      const existing = dailyActivityMap.get(day.date)
      if (existing) {
        existing.messageCount += day.messageCount
        existing.sessionCount += day.sessionCount
        existing.toolCallCount += day.toolCallCount
      } else {
        dailyActivityMap.set(day.date, { ...day })
      }
    }
  }

  const dailyModelTokensMap = new Map<string, { [model: string]: number }>()
  for (const day of cache.dailyModelTokens) {
    dailyModelTokensMap.set(day.date, { ...day.tokensByModel })
  }
  if (todayStats) {
    for (const day of todayStats.dailyModelTokens) {
      const existing = dailyModelTokensMap.get(day.date)
      if (existing) {
        for (const [model, tokens] of Object.entries(day.tokensByModel)) {
          existing[model] = (existing[model] || 0) + tokens
        }
      } else {
        dailyModelTokensMap.set(day.date, { ...day.tokensByModel })
      }
    }
  }

  // Merge model usage
  const modelUsage = { ...cache.modelUsage }
  if (todayStats) {
    for (const [model, usage] of Object.entries(todayStats.modelUsage)) {
      if (modelUsage[model]) {
        modelUsage[model] = {
          inputTokens: modelUsage[model]!.inputTokens + usage.inputTokens,
          outputTokens: modelUsage[model]!.outputTokens + usage.outputTokens,
          cacheReadInputTokens:
            modelUsage[model]!.cacheReadInputTokens +
            usage.cacheReadInputTokens,
          cacheCreationInputTokens:
            modelUsage[model]!.cacheCreationInputTokens +
            usage.cacheCreationInputTokens,
          webSearchRequests:
            modelUsage[model]!.webSearchRequests + usage.webSearchRequests,
          costUSD: modelUsage[model]!.costUSD + usage.costUSD,
          contextWindow: Math.max(
            modelUsage[model]!.contextWindow,
            usage.contextWindow,
          ),
          maxOutputTokens: Math.max(
            modelUsage[model]!.maxOutputTokens,
            usage.maxOutputTokens,
          ),
        }
      } else {
        modelUsage[model] = { ...usage }
      }
    }
  }

  // Merge hour counts
  const hourCountsMap = new Map<number, number>()
  for (const [hour, count] of Object.entries(cache.hourCounts)) {
    hourCountsMap.set(parseInt(hour, 10), count)
  }
  if (todayStats) {
    for (const [hour, count] of Object.entries(todayStats.hourCounts)) {
      const hourNum = parseInt(hour, 10)
      hourCountsMap.set(hourNum, (hourCountsMap.get(hourNum) || 0) + count)
    }
  }

  // Calculate derived stats
  const dailyActivityArray = Array.from(dailyActivityMap.values()).sort(
    (a, b) => a.date.localeCompare(b.date),
  )
  const streaks = calculateStreaks(dailyActivityArray)

  const dailyModelTokens = Array.from(dailyModelTokensMap.entries())
    .map(([date, tokensByModel]) => ({ date, tokensByModel }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Compute session aggregates: combine cache aggregates with today's stats
  const totalSessions =
    cache.totalSessions + (todayStats?.sessionStats.length || 0)
  const totalMessages = cache.totalMessages + (todayStats?.totalMessages || 0)

  // Find longest session (compare cache's longest with today's sessions)
  let longestSession = cache.longestSession
  if (todayStats) {
    for (const session of todayStats.sessionStats) {
      if (!longestSession || session.duration > longestSession.duration) {
        longestSession = session
      }
    }
  }

  // Find first/last session dates
  let firstSessionDate = cache.firstSessionDate
  let lastSessionDate: string | null = null
  if (todayStats) {
    for (const session of todayStats.sessionStats) {
      if (!firstSessionDate || session.timestamp < firstSessionDate) {
        firstSessionDate = session.timestamp
      }
      if (!lastSessionDate || session.timestamp > lastSessionDate) {
        lastSessionDate = session.timestamp
      }
    }
  }
  // If no today sessions, derive lastSessionDate from dailyActivity
  if (!lastSessionDate && dailyActivityArray.length > 0) {
    lastSessionDate = dailyActivityArray.at(-1)!.date
  }

  const peakActivityDay =
    dailyActivityArray.length > 0
      ? dailyActivityArray.reduce((max, d) =>
          d.messageCount > max.messageCount ? d : max,
        ).date
      : null

  const peakActivityHour =
    hourCountsMap.size > 0
      ? Array.from(hourCountsMap.entries()).reduce((max, [hour, count]) =>
          count > max[1] ? [hour, count] : max,
        )[0]
      : null

  const totalDays =
    firstSessionDate && lastSessionDate
      ? Math.ceil(
          (new Date(lastSessionDate).getTime() -
            new Date(firstSessionDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : 0

  const totalSpeculationTimeSavedMs =
    cache.totalSpeculationTimeSavedMs +
    (todayStats?.totalSpeculationTimeSavedMs || 0)

  const result: ClaudeCodeStats = {
    totalSessions,
    totalMessages,
    totalDays,
    activeDays: dailyActivityMap.size,
    streaks,
    dailyActivity: dailyActivityArray,
    dailyModelTokens,
    longestSession,
    modelUsage,
    firstSessionDate,
    lastSessionDate,
    peakActivityDay,
    peakActivityHour,
    totalSpeculationTimeSavedMs,
  }

  if (feature('SHOT_STATS')) {
    const shotDistribution: { [shotCount: number]: number } = {
      ...(cache.shotDistribution || {}),
    }
    if (todayStats?.shotDistribution) {
      for (const [count, sessions] of Object.entries(
        todayStats.shotDistribution,
      )) {
        const key = parseInt(count, 10)
        shotDistribution[key] = (shotDistribution[key] || 0) + sessions
      }
    }
    result.shotDistribution = shotDistribution
    const totalWithShots = Object.values(shotDistribution).reduce(
      (sum, n) => sum + n,
      0,
    )
    result.oneShotRate =
      totalWithShots > 0
        ? Math.round(((shotDistribution[1] || 0) / totalWithShots) * 100)
        : 0
  }

  return result
}

/**
 * Aggregates stats from all Claude Code sessions across all projects.
 * Uses a disk cache to avoid reprocessing historical data.
 */
export async function aggregateClaudeCodeStats(): Promise<ClaudeCodeStats> {
  const allSessionFiles = await getAllSessionFiles()

  if (allSessionFiles.length === 0) {
    return getEmptyStats()
  }

  // Use lock to prevent race conditions with background cache updates
  const updatedCache = await withStatsCacheLock(async () => {
    // Load the cache
    const cache = await loadStatsCache()
    const yesterday = getYesterdayDateString()

    // Determine what needs to be processed
    // - If no cache: process everything up to yesterday, then today separately
    // - If cache exists: process from day after lastComputedDate to yesterday, then today
    let result = cache

    if (!cache.lastComputedDate) {
      // No cache - process all historical data (everything before today)
      logForDebugging('Stats cache empty, processing all historical data')
      const historicalStats = await processSessionFiles(allSessionFiles, {
        toDate: yesterday,
      })

      if (
        historicalStats.sessionStats.length > 0 ||
        historicalStats.dailyActivity.length > 0
      ) {
        result = mergeCacheWithNewStats(cache, historicalStats, yesterday)
        await saveStatsCache(result)
      }
    } else if (isDateBefore(cache.lastComputedDate, yesterday)) {
      // Cache is stale - process new days
      // Process from day after lastComputedDate to yesterday
      const nextDay = getNextDay(cache.lastComputedDate)
      logForDebugging(
        `Stats cache stale (${cache.lastComputedDate}), processing ${nextDay} to ${yesterday}`,
      )
      const newStats = await processSessionFiles(allSessionFiles, {
        fromDate: nextDay,
        toDate: yesterday,
      })

      if (
        newStats.sessionStats.length > 0 ||
        newStats.dailyActivity.length > 0
      ) {
        result = mergeCacheWithNewStats(cache, newStats, yesterday)
        await saveStatsCache(result)
      } else {
        // No new data, but update lastComputedDate
        result = { ...cache, lastComputedDate: yesterday }
        await saveStatsCache(result)
      }
    }

    return result
  })

  // Always process today's data live (it's incomplete)
  // This doesn't need to be in the lock since it doesn't modify the cache
  const today = getTodayDateString()
  const todayStats = await processSessionFiles(allSessionFiles, {
    fromDate: today,
    toDate: today,
  })

  // Combine cache with today's stats
  return cacheToStats(updatedCache, todayStats)
}

export type StatsDateRange = '7d' | '30d' | 'all'

/**
 * Aggregates stats for a specific date range.
 * For 'all', uses the cached aggregation. For other ranges, processes files directly.
 */
export async function aggregateClaudeCodeStatsForRange(
  range: StatsDateRange,
): Promise<ClaudeCodeStats> {
  if (range === 'all') {
    return aggregateClaudeCodeStats()
  }

  const allSessionFiles = await getAllSessionFiles()
  if (allSessionFiles.length === 0) {
    return getEmptyStats()
  }

  // Calculate fromDate based on range
  const today = new Date()
  const daysBack = range === '7d' ? 7 : 30
  const fromDate = new Date(today)
  fromDate.setDate(today.getDate() - daysBack + 1) // +1 to include today
  const fromDateStr = toDateString(fromDate)

  // Process session files for the date range
  const stats = await processSessionFiles(allSessionFiles, {
    fromDate: fromDateStr,
  })

  return processedStatsToClaudeCodeStats(stats)
}

/**
 * Convert ProcessedStats to ClaudeCodeStats.
 * Used for filtered date ranges that bypass the cache.
 */
function processedStatsToClaudeCodeStats(
  stats: ProcessedStats,
): ClaudeCodeStats {
  const dailyActivitySorted = stats.dailyActivity
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  const dailyModelTokensSorted = stats.dailyModelTokens
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))

  // Calculate streaks from daily activity
  const streaks = calculateStreaks(dailyActivitySorted)

  // Find longest session
  let longestSession: SessionStats | null = null
  for (const session of stats.sessionStats) {
    if (!longestSession || session.duration > longestSession.duration) {
      longestSession = session
    }
  }

  // Find first/last session dates
  let firstSessionDate: string | null = null
  let lastSessionDate: string | null = null
  for (const session of stats.sessionStats) {
    if (!firstSessionDate || session.timestamp < firstSessionDate) {
      firstSessionDate = session.timestamp
    }
    if (!lastSessionDate || session.timestamp > lastSessionDate) {
      lastSessionDate = session.timestamp
    }
  }

  // Peak activity day
  const peakActivityDay =
    dailyActivitySorted.length > 0
      ? dailyActivitySorted.reduce((max, d) =>
          d.messageCount > max.messageCount ? d : max,
        ).date
      : null

  // Peak activity hour
  const hourEntries = Object.entries(stats.hourCounts)
  const peakActivityHour =
    hourEntries.length > 0
      ? parseInt(
          hourEntries.reduce((max, [hour, count]) =>
            count > parseInt(max[1].toString()) ? [hour, count] : max,
          )[0],
          10,
        )
      : null

  // Total days in range
  const totalDays =
    firstSessionDate && lastSessionDate
      ? Math.ceil(
          (new Date(lastSessionDate).getTime() -
            new Date(firstSessionDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : 0

  const result: ClaudeCodeStats = {
    totalSessions: stats.sessionStats.length,
    totalMessages: stats.totalMessages,
    totalDays,
    activeDays: stats.dailyActivity.length,
    streaks,
    dailyActivity: dailyActivitySorted,
    dailyModelTokens: dailyModelTokensSorted,
    longestSession,
    modelUsage: stats.modelUsage,
    firstSessionDate,
    lastSessionDate,
    peakActivityDay,
    peakActivityHour,
    totalSpeculationTimeSavedMs: stats.totalSpeculationTimeSavedMs,
  }

  if (feature('SHOT_STATS') && stats.shotDistribution) {
    result.shotDistribution = stats.shotDistribution
    const totalWithShots = Object.values(stats.shotDistribution).reduce(
      (sum, n) => sum + n,
      0,
    )
    result.oneShotRate =
      totalWithShots > 0
        ? Math.round(((stats.shotDistribution[1] || 0) / totalWithShots) * 100)
        : 0
  }

  return result
}

/**
 * Get the next day after a given date string (YYYY-MM-DD format).
 */
function getNextDay(dateStr: string): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + 1)
  return toDateString(date)
}

function calculateStreaks(dailyActivity: DailyActivity[]): StreakInfo {
  if (dailyActivity.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      currentStreakStart: null,
      longestStreakStart: null,
      longestStreakEnd: null,
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Calculate current streak (working backwards from today)
  let currentStreak = 0
  let currentStreakStart: string | null = null
  const checkDate = new Date(today)

  // Build a set of active dates for quick lookup
  const activeDates = new Set(dailyActivity.map(d => d.date))

  while (true) {
    const dateStr = toDateString(checkDate)
    if (!activeDates.has(dateStr)) {
      break
    }
    currentStreak++
    currentStreakStart = dateStr
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Calculate longest streak
  let longestStreak = 0
  let longestStreakStart: string | null = null
  let longestStreakEnd: string | null = null

  if (dailyActivity.length > 0) {
    const sortedDates = Array.from(activeDates).sort()
    let tempStreak = 1
    let tempStart = sortedDates[0]!

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]!)
      const currDate = new Date(sortedDates[i]!)

      const dayDiff = Math.round(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
      )

      if (dayDiff === 1) {
        tempStreak++
      } else {
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak
          longestStreakStart = tempStart
          longestStreakEnd = sortedDates[i - 1]!
        }
        tempStreak = 1
        tempStart = sortedDates[i]!
      }
    }

    // Check final streak
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak
      longestStreakStart = tempStart
      longestStreakEnd = sortedDates.at(-1)!
    }
  }

  return {
    currentStreak,
    longestStreak,
    currentStreakStart,
    longestStreakStart,
    longestStreakEnd,
  }
}

const SHOT_COUNT_REGEX = /(\d+)-shotted by/

/**
 * Extract the shot count from PR attribution text in a `gh pr create` Bash call.
 * The attribution format is: "N-shotted by model-name"
 * Returns the shot count, or null if not found.
 */
function extractShotCountFromMessages(
  messages: TranscriptMessage[],
): number | null {
  for (const m of messages) {
    if (m.type !== 'assistant') continue
    const content = m.message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (
        block.type !== 'tool_use' ||
        !SHELL_TOOL_NAMES.includes(block.name) ||
        typeof block.input !== 'object' ||
        block.input === null ||
        !('command' in block.input) ||
        typeof block.input.command !== 'string'
      ) {
        continue
      }
      const match = SHOT_COUNT_REGEX.exec(block.input.command)
      if (match) {
        return parseInt(match[1]!, 10)
      }
    }
  }
  return null
}

// Transcript message types — must match isTranscriptMessage() in sessionStorage.ts.
// The canonical dateKey (see processSessionFiles) reads mainMessages[0].timestamp,
// where mainMessages = entries.filter(isTranscriptMessage).filter(!isSidechain).
// This peek must extract the same value to be a safe skip optimization.
const TRANSCRIPT_MESSAGE_TYPES = new Set([
  'user',
  'assistant',
  'attachment',
  'system',
  'progress',
])

/**
 * Peeks at the head of a session file to get the session start date.
 * Uses a small 4 KB read to avoid loading the full file.
 *
 * Session files typically begin with non-transcript entries (`mode`,
 * `file-history-snapshot`, `attribution-snapshot`) before the first transcript
 * message, so we scan lines until we hit one. Each complete line is JSON-parsed
 * — naive string search is unsafe here because `file-history-snapshot` entries
 * embed a nested `snapshot.timestamp` carrying the *previous* session's date
 * (written by copyFileHistoryForResume), which would cause resumed sessions to
 * be miscategorised as old and silently dropped from stats.
 *
 * Returns a YYYY-MM-DD string, or null if no transcript message fits in the
 * head (caller falls through to the full read — safe default).
 */
export async function readSessionStartDate(
  filePath: string,
): Promise<string | null> {
  try {
    const fd = await open(filePath, 'r')
    try {
      const buf = Buffer.allocUnsafe(4096)
      const { bytesRead } = await fd.read(buf, 0, buf.length, 0)
      if (bytesRead === 0) return null
      const head = buf.toString('utf8', 0, bytesRead)

      // Only trust complete lines — the 4KB boundary may bisect a JSON entry.
      const lastNewline = head.lastIndexOf('\n')
      if (lastNewline < 0) return null

      for (const line of head.slice(0, lastNewline).split('\n')) {
        if (!line) continue
        let entry: {
          type?: unknown
          timestamp?: unknown
          isSidechain?: unknown
        }
        try {
          entry = jsonParse(line)
        } catch {
          continue
        }
        if (typeof entry.type !== 'string') continue
        if (!TRANSCRIPT_MESSAGE_TYPES.has(entry.type)) continue
        if (entry.isSidechain === true) continue
        if (typeof entry.timestamp !== 'string') return null
        const date = new Date(entry.timestamp)
        if (Number.isNaN(date.getTime())) return null
        return toDateString(date)
      }
      return null
    } finally {
      await fd.close()
    }
  } catch {
    return null
  }
}

function getEmptyStats(): ClaudeCodeStats {
  return {
    totalSessions: 0,
    totalMessages: 0,
    totalDays: 0,
    activeDays: 0,
    streaks: {
      currentStreak: 0,
      longestStreak: 0,
      currentStreakStart: null,
      longestStreakStart: null,
      longestStreakEnd: null,
    },
    dailyActivity: [],
    dailyModelTokens: [],
    longestSession: null,
    modelUsage: {},
    firstSessionDate: null,
    lastSessionDate: null,
    peakActivityDay: null,
    peakActivityHour: null,
    totalSpeculationTimeSavedMs: 0,
  }
}
