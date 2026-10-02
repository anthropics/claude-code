import type { HrTime } from '@opentelemetry/api'
import { type ExportResult, ExportResultCode } from '@opentelemetry/core'
import type {
  LogRecordExporter,
  ReadableLogRecord,
} from '@opentelemetry/sdk-logs'
import axios from 'axios'
import { randomUUID } from 'crypto'
import { appendFile, mkdir, readdir, unlink, writeFile } from 'fs/promises'
import * as path from 'path'
import type { CoreUserData } from 'src/utils/user.js'
import {
  getIsNonInteractiveSession,
  getSessionId,
} from '../../bootstrap/state.js'
import { ClaudeCodeInternalEvent } from '../../types/generated/events_mono/claude_code/v1/claude_code_internal_event.js'
import { GrowthbookExperimentEvent } from '../../types/generated/events_mono/growthbook/v1/growthbook_experiment_event.js'
import {
  getClaudeAIOAuthTokens,
  hasProfileScope,
  isClaudeAISubscriber,
} from '../../utils/auth.js'
import { checkHasTrustDialogAccepted } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { errorMessage, isFsInaccessible, toError } from '../../utils/errors.js'
import { getAuthHeaders } from '../../utils/http.js'
import { readJSONLFile } from '../../utils/json.js'
import { logError } from '../../utils/log.js'
import { sleep } from '../../utils/sleep.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { getClaudeCodeUserAgent } from '../../utils/userAgent.js'
import { isOAuthTokenExpired } from '../oauth/client.js'
import { stripProtoFields } from './index.js'
import { type EventMetadata, to1PEventFormat } from './metadata.js'

// Unique ID for this process run - used to isolate failed event files between runs
const BATCH_UUID = randomUUID()

// File prefix for failed event storage
const FILE_PREFIX = '1p_failed_events.'

// Storage directory for failed events - evaluated at runtime to respect CLAUDE_CONFIG_DIR in tests
function getStorageDir(): string {
  return path.join(getClaudeConfigHomeDir(), 'telemetry')
}

// API envelope - event_data is the JSON output from proto toJSON()
type FirstPartyEventLoggingEvent = {
  event_type: 'ClaudeCodeInternalEvent' | 'GrowthbookExperimentEvent'
  event_data: unknown
}

type FirstPartyEventLoggingPayload = {
  events: FirstPartyEventLoggingEvent[]
}

/**
 * Exporter for 1st-party event logging to /api/event_logging/batch.
 *
 * Export cycles are controlled by OpenTelemetry's BatchLogRecordProcessor, which
 * triggers export() when either:
 * - Time interval elapses (default: 5 seconds via scheduledDelayMillis)
 * - Batch size is reached (default: 200 events via maxExportBatchSize)
 *
 * This exporter adds resilience on top:
 * - Append-only log for failed events (concurrency-safe)
 * - Quadratic backoff retry for failed events, dropped after maxAttempts
 * - Immediate retry of queued events when any export succeeds (endpoint is healthy)
 * - Chunking large event sets into smaller batches
 * - Auth fallback: retries without auth on 401 errors
 */
export class FirstPartyEventLoggingExporter implements LogRecordExporter {
  private readonly endpoint: string
  private readonly timeout: number
  private readonly maxBatchSize: number
  private readonly skipAuth: boolean
  private readonly batchDelayMs: number
  private readonly baseBackoffDelayMs: number
  private readonly maxBackoffDelayMs: number
  private readonly maxAttempts: number
  private readonly isKilled: () => boolean
  private pendingExports: Promise<void>[] = []
  private isShutdown = false
  private readonly schedule: (
    fn: () => Promise<void>,
    delayMs: number,
  ) => () => void
  private cancelBackoff: (() => void) | null = null
  private attempts = 0
  private isRetrying = false
  private lastExportErrorContext: string | undefined

  constructor(
    options: {
      timeout?: number
      maxBatchSize?: number
      skipAuth?: boolean
      batchDelayMs?: number
      baseBackoffDelayMs?: number
      maxBackoffDelayMs?: number
      maxAttempts?: number
      path?: string
      baseUrl?: string
      // Injected killswitch probe. Checked per-POST so that disabling the
      // firstParty sink also stops backoff retries (not just new emits).
      // Passed in rather than imported to avoid a cycle with firstPartyEventLogger.ts.
      isKilled?: () => boolean
      schedule?: (fn: () => Promise<void>, delayMs: number) => () => void
    } = {},
  ) {
    // Default: prod, except when ANTHROPIC_BASE_URL is explicitly staging.
    // Overridable via tengu_1p_event_batch_config.baseUrl.
    const baseUrl =
      options.baseUrl ||
      (process.env.ANTHROPIC_BASE_URL === 'https://api-staging.anthropic.com'
        ? 'https://api-staging.anthropic.com'
        : 'https://api.anthropic.com')

    this.endpoint = `${baseUrl}${options.path || '/api/event_logging/batch'}`

    this.timeout = options.timeout || 10000
    this.maxBatchSize = options.maxBatchSize || 200
    this.skipAuth = options.skipAuth ?? false
    this.batchDelayMs = options.batchDelayMs || 100
    this.baseBackoffDelayMs = options.baseBackoffDelayMs || 500
    this.maxBackoffDelayMs = options.maxBackoffDelayMs || 30000
    this.maxAttempts = options.maxAttempts ?? 8
    this.isKilled = options.isKilled ?? (() => false)
    this.schedule =
      options.schedule ??
      ((fn, ms) => {
        const t = setTimeout(fn, ms)
        return () => clearTimeout(t)
      })

    // Retry any failed events from previous runs of this session (in background)
    void this.retryPreviousBatches()
  }

  // Expose for testing
  async getQueuedEventCount(): Promise<number> {
    return (await this.loadEventsFromCurrentBatch()).length
  }

  // --- Storage helpers ---

  private getCurrentBatchFilePath(): string {
    return path.join(
      getStorageDir(),
      `${FILE_PREFIX}${getSessionId()}.${BATCH_UUID}.json`,
    )
  }

  private async loadEventsFromFile(
    filePath: string,
  ): Promise<FirstPartyEventLoggingEvent[]> {
    try {
      return await readJSONLFile<FirstPartyEventLoggingEvent>(filePath)
    } catch {
      return []
    }
  }

  private async loadEventsFromCurrentBatch(): Promise<
    FirstPartyEventLoggingEvent[]
  > {
    return this.loadEventsFromFile(this.getCurrentBatchFilePath())
  }

  private async saveEventsToFile(
    filePath: string,
    events: FirstPartyEventLoggingEvent[],
  ): Promise<void> {
    try {
      if (events.length === 0) {
        try {
          await unlink(filePath)
        } catch {
          // File doesn't exist, nothing to delete
        }
      } else {
        // Ensure storage directory exists
        await mkdir(getStorageDir(), { recursive: true })
        // Write as JSON lines (one event per line)
        const content = events.map(e => jsonStringify(e)).join('\n') + '\n'
        await writeFile(filePath, content, 'utf8')
      }
    } catch (error) {
      logError(error)
    }
  }

  private async appendEventsToFile(
    filePath: string,
    events: FirstPartyEventLoggingEvent[],
  ): Promise<void> {
    if (events.length === 0) return
    try {
      // Ensure storage directory exists
      await mkdir(getStorageDir(), { recursive: true })
      // Append as JSON lines (one event per line) - atomic on most filesystems
      const content = events.map(e => jsonStringify(e)).join('\n') + '\n'
      await appendFile(filePath, content, 'utf8')
    } catch (error) {
      logError(error)
    }
  }

  private async deleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath)
    } catch {
      // File doesn't exist or can't be deleted, ignore
    }
  }

  // --- Previous batch retry (startup) ---

  private async retryPreviousBatches(): Promise<void> {
    try {
      const prefix = `${FILE_PREFIX}${getSessionId()}.`
      let files: string[]
      try {
        files = (await readdir(getStorageDir()))
          .filter((f: string) => f.startsWith(prefix) && f.endsWith('.json'))
          .filter((f: string) => !f.includes(BATCH_UUID)) // Exclude current batch
      } catch (e) {
        if (isFsInaccessible(e)) return
        throw e
      }

      for (const file of files) {
        const filePath = path.join(getStorageDir(), file)
        void this.retryFileInBackground(filePath)
      }
    } catch (error) {
      logError(error)
    }
  }

  private async retryFileInBackground(filePath: string): Promise<void> {
    if (this.attempts >= this.maxAttempts) {
      await this.deleteFile(filePath)
      return
    }

    const events = await this.loadEventsFromFile(filePath)
    if (events.length === 0) {
      await this.deleteFile(filePath)
      return
    }

    if (process.env.USER_TYPE === 'ant') {
      logForDebugging(
        `1P event logging: retrying ${events.length} events from previous batch`,
      )
    }

    const failedEvents = await this.sendEventsInBatches(events)
    if (failedEvents.length === 0) {
      await this.deleteFile(filePath)
      if (process.env.USER_TYPE === 'ant') {
        logForDebugging('1P event logging: previous batch retry succeeded')
      }
    } else {
      // Save only the failed events back (not all original events)
      await this.saveEventsToFile(filePath, failedEvents)
      if (process.env.USER_TYPE === 'ant') {
        logForDebugging(
          `1P event logging: previous batch retry failed, ${failedEvents.length} events remain`,
        )
      }
    }
  }

  async export(
    logs: ReadableLogRecord[],
    resultCallback: (result: ExportResult) => void,
  ): Promise<void> {
    if (this.isShutdown) {
      if (process.env.USER_TYPE === 'ant') {
        logForDebugging(
          '1P event logging export failed: Exporter has been shutdown',
        )
      }
      resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error('Exporter has been shutdown'),
      })
      return
    }

    const exportPromise = this.doExport(logs, resultCallback)
    this.pendingExports.push(exportPromise)

    // Clean up completed exports
    void exportPromise.finally(() => {
      const index = this.pendingExports.indexOf(exportPromise)
      if (index > -1) {
        void this.pendingExports.splice(index, 1)
      }
    })
  }

  private async doExport(
    logs: ReadableLogRecord[],
    resultCallback: (result: ExportResult) => void,
  ): Promise<void> {
    try {
      // Filter for event logs only (by scope name)
      const eventLogs = logs.filter(
        log =>
          log.instrumentationScope?.name === 'com.anthropic.claude_code.events',
      )

      if (eventLogs.length === 0) {
        resultCallback({ code: ExportResultCode.SUCCESS })
        return
      }

      // Transform new logs (failed events are retried independently via backoff)
      const events = this.transformLogsToEvents(eventLogs).events

      if (events.length === 0) {
        resultCallback({ code: ExportResultCode.SUCCESS })
        return
      }

      if (this.attempts >= this.maxAttempts) {
        resultCallback({
          code: ExportResultCode.FAILED,
          error: new Error(
            `Dropped ${events.length} events: max attempts (${this.maxAttempts}) reached`,
          ),
        })
        return
      }

      // Send events
      const failedEvents = await this.sendEventsInBatches(events)
      this.attempts++

      if (failedEvents.length > 0) {
        await this.queueFailedEvents(failedEvents)
        this.scheduleBackoffRetry()
        const context = this.lastExportErrorContext
          ? ` (${this.lastExportErrorContext})`
          : ''
        resultCallback({
          code: ExportResultCode.FAILED,
          error: new Error(
            `Failed to export ${failedEvents.length} events${context}`,
          ),
        })
        return
      }

      // Success - reset backoff and immediately retry any queued events
      this.resetBackoff()
      if ((await this.getQueuedEventCount()) > 0 && !this.isRetrying) {
        void this.retryFailedEvents()
      }
      resultCallback({ code: ExportResultCode.SUCCESS })
    } catch (error) {
      if (process.env.USER_TYPE === 'ant') {
        logForDebugging(
          `1P event logging export failed: ${errorMessage(error)}`,
        )
      }
      logError(error)
      resultCallback({
        code: ExportResultCode.FAILED,
        error: toError(error),
      })
    }
  }

  private async sendEventsInBatches(
    events: FirstPartyEventLoggingEvent[],
  ): Promise<FirstPartyEventLoggingEvent[]> {
    // Chunk events into batches
    const batches: FirstPartyEventLoggingEvent[][] = []
    for (let i = 0; i < events.length; i += this.maxBatchSize) {
      batches.push(events.slice(i, i + this.maxBatchSize))
    }

    if (process.env.USER_TYPE === 'ant') {
      logForDebugging(
        `1P event logging: exporting ${events.length} events in ${batches.length} batch(es)`,
      )
    }

    // Send each batch with delay between them. On first failure, assume the
    // endpoint is down and short-circuit: queue the failed batch plus all
    // remaining unsent batches without POSTing them. The backoff retry will
    // probe again with a single batch next tick.
    const failedBatchEvents: FirstPartyEventLoggingEvent[] = []
    let lastErrorContext: string | undefined
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!
      try {
        await this.sendBatchWithRetry({ events: batch })
      } catch (error) {
        lastErrorContext = getAxiosErrorContext(error)
        for (let j = i; j < batches.length; j++) {
          failedBatchEvents.push(...batches[j]!)
        }
        if (process.env.USER_TYPE === 'ant') {
          const skipped = batches.length - 1 - i
          logForDebugging(
            `1P event logging: batch ${i + 1}/${batches.length} failed (${lastErrorContext}); short-circuiting ${skipped} remaining batch(es)`,
          )
        }
        break
      }

      if (i < batches.length - 1 && this.batchDelayMs > 0) {
        await sleep(this.batchDelayMs)
      }
    }

    if (failedBatchEvents.length > 0 && lastErrorContext) {
      this.lastExportErrorContext = lastErrorContext
    }

    return failedBatchEvents
  }

  private async queueFailedEvents(
    events: FirstPartyEventLoggingEvent[],
  ): Promise<void> {
    const filePath = this.getCurrentBatchFilePath()

    // Append-only: just add new events to file (atomic on most filesystems)
    await this.appendEventsToFile(filePath, events)

    const context = this.lastExportErrorContext
      ? ` (${this.lastExportErrorContext})`
      : ''
    const message = `1P event logging: ${events.length} events failed to export${context}`
    logError(new Error(message))
  }

  private scheduleBackoffRetry(): void {
    // Don't schedule if already retrying or shutdown
    if (this.cancelBackoff || this.isRetrying || this.isShutdown) {
      return
    }

    // Quadratic backoff (matching Statsig SDK): base * attempts²
    const delay = Math.min(
      this.baseBackoffDelayMs * this.attempts * this.attempts,
      this.maxBackoffDelayMs,
    )

    if (process.env.USER_TYPE === 'ant') {
      logForDebugging(
        `1P event logging: scheduling backoff retry in ${delay}ms (attempt ${this.attempts})`,
      )
    }

    this.cancelBackoff = this.schedule(async () => {
      this.cancelBackoff = null
      await this.retryFailedEvents()
    }, delay)
  }

  private async retryFailedEvents(): Promise<void> {
    const filePath = this.getCurrentBatchFilePath()

    // Keep retrying while there are events and endpoint is healthy
    while (!this.isShutdown) {
      const events = await this.loadEventsFromFile(filePath)
      if (events.length === 0) break

      if (this.attempts >= this.maxAttempts) {
        if (process.env.USER_TYPE === 'ant') {
          logForDebugging(
            `1P event logging: max attempts (${this.maxAttempts}) reached, dropping ${events.length} events`,
          )
        }
        await this.deleteFile(filePath)
        this.resetBackoff()
        return
      }

      this.isRetrying = true

      // Clear file before retry (we have events in memory now)
      await this.deleteFile(filePath)

      if (process.env.USER_TYPE === 'ant') {
        logForDebugging(
          `1P event logging: retrying ${events.length} failed events (attempt ${this.attempts + 1})`,
        )
      }

      const failedEvents = await this.sendEventsInBatches(events)
      this.attempts++

      this.isRetrying = false

      if (failedEvents.length > 0) {
        // Write failures back to disk
        await this.saveEventsToFile(filePath, failedEvents)
        this.scheduleBackoffRetry()
        return // Failed - wait for backoff
      }

      // Success - reset backoff and continue loop to drain any newly queued events
      this.resetBackoff()
      if (process.env.USER_TYPE === 'ant') {
        logForDebugging('1P event logging: backoff retry succeeded')
      }
    }
  }

  private resetBackoff(): void {
    this.attempts = 0
    if (this.cancelBackoff) {
      this.cancelBackoff()
      this.cancelBackoff = null
    }
  }

  private async sendBatchWithRetry(
    payload: FirstPartyEventLoggingPayload,
  ): Promise<void> {
    if (this.isKilled()) {
      // Throw so the caller short-circuits remaining batches and queues
      // everything to disk. Zero network traffic while killed; the backoff
      // timer keeps ticking and will resume POSTs as soon as the GrowthBook
      // cache picks up the cleared flag.
      throw new Error('firstParty sink killswitch active')
    }

    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': getClaudeCodeUserAgent(),
      'x-service-name': 'claude-code',
    }

    // Skip auth if trust hasn't been established yet
    // This prevents executing apiKeyHelper commands before the trust dialog
    // Non-interactive sessions implicitly have workspace trust
    const hasTrust =
      checkHasTrustDialogAccepted() || getIsNonInteractiveSession()
    if (process.env.USER_TYPE === 'ant' && !hasTrust) {
      logForDebugging('1P event logging: Trust not accepted')
    }

    // Skip auth when the OAuth token is expired or lacks user:profile
    // scope (service key sessions). Falls through to unauthenticated send.
    let shouldSkipAuth = this.skipAuth || !hasTrust
    if (!shouldSkipAuth && isClaudeAISubscriber()) {
      const tokens = getClaudeAIOAuthTokens()
      if (!hasProfileScope()) {
        shouldSkipAuth = true
      } else if (tokens && isOAuthTokenExpired(tokens.expiresAt)) {
        shouldSkipAuth = true
        if (process.env.USER_TYPE === 'ant') {
          logForDebugging(
            '1P event logging: OAuth token expired, skipping auth to avoid 401',
          )
        }
      }
    }

    // Try with auth headers first (unless trust not established or token is known to be expired)
    const authResult = shouldSkipAuth
      ? { headers: {}, error: 'trust not established or Oauth token expired' }
      : getAuthHeaders()
    const useAuth = !authResult.error

    if (!useAuth && process.env.USER_TYPE === 'ant') {
      logForDebugging(
        `1P event logging: auth not available, sending without auth`,
      )
    }

    const headers = useAuth
      ? { ...baseHeaders, ...authResult.headers }
      : baseHeaders

    try {
      const response = await axios.post(this.endpoint, payload, {
        timeout: this.timeout,
        headers,
      })
      this.logSuccess(payload.events.length, useAuth, response.data)
      return
    } catch (error) {
      // Handle 401 by retrying without auth
      if (
        useAuth &&
        axios.isAxiosError(error) &&
        error.response?.status === 401
      ) {
        if (process.env.USER_TYPE === 'ant') {
          logForDebugging(
            '1P event logging: 401 auth error, retrying without auth',
          )
        }
        const response = await axios.post(this.endpoint, payload, {
          timeout: this.timeout,
          headers: baseHeaders,
        })
        this.logSuccess(payload.events.length, false, response.data)
        return
      }

      throw error
    }
  }

  private logSuccess(
    eventCount: number,
    withAuth: boolean,
    responseData: unknown,
  ): void {
    if (process.env.USER_TYPE === 'ant') {
      logForDebugging(
        `1P event logging: ${eventCount} events exported successfully${withAuth ? ' (with auth)' : ' (without auth)'}`,
      )
      logForDebugging(`API Response: ${jsonStringify(responseData, null, 2)}`)
    }
  }

  private hrTimeToDate(hrTime: HrTime): Date {
    const [seconds, nanoseconds] = hrTime
    return new Date(seconds * 1000 + nanoseconds / 1000000)
  }

  private transformLogsToEvents(
    logs: ReadableLogRecord[],
  ): FirstPartyEventLoggingPayload {
    const events: FirstPartyEventLoggingEvent[] = []

    for (const log of logs) {
      const attributes = log.attributes || {}

      // Check if this is a GrowthBook experiment event
      if (attributes.event_type === 'GrowthbookExperimentEvent') {
        const timestamp = this.hrTimeToDate(log.hrTime)
        const account_uuid = attributes.account_uuid as string | undefined
        const organization_uuid = attributes.organization_uuid as
          | string
          | undefined
        events.push({
          event_type: 'GrowthbookExperimentEvent',
          event_data: GrowthbookExperimentEvent.toJSON({
            event_id: attributes.event_id as string,
            timestamp,
            experiment_id: attributes.experiment_id as string,
            variation_id: attributes.variation_id as number,
            environment: attributes.environment as string,
            user_attributes: attributes.user_attributes as string,
            experiment_metadata: attributes.experiment_metadata as string,
            device_id: attributes.device_id as string,
            session_id: attributes.session_id as string,
            auth:
              account_uuid || organization_uuid
                ? { account_uuid, organization_uuid }
                : undefined,
          }),
        })
        continue
      }

      // Extract event name
      const eventName =
        (attributes.event_name as string) || (log.body as string) || 'unknown'

      // Extract metadata objects directly (no JSON parsing needed)
      const coreMetadata = attributes.core_metadata as EventMetadata | undefined
      const userMetadata = attributes.user_metadata as CoreUserData
      const eventMetadata = (attributes.event_metadata || {}) as Record<
        string,
        unknown
      >

      if (!coreMetadata) {
        // Emit partial event if core metadata is missing
        if (process.env.USER_TYPE === 'ant') {
          logForDebugging(
            `1P event logging: core_metadata missing for event ${eventName}`,
          )
        }
        events.push({
          event_type: 'ClaudeCodeInternalEvent',
          event_data: ClaudeCodeInternalEvent.toJSON({
            event_id: attributes.event_id as string | undefined,
            event_name: eventName,
            client_timestamp: this.hrTimeToDate(log.hrTime),
            session_id: getSessionId(),
            additional_metadata: Buffer.from(
              jsonStringify({
                transform_error: 'core_metadata attribute is missing',
              }),
            ).toString('base64'),
          }),
        })
        continue
      }

      // Transform to 1P format
      const formatted = to1PEventFormat(
        coreMetadata,
        userMetadata,
        eventMetadata,
      )

      // _PROTO_* keys are PII-tagged values meant only for privileged BQ
      // columns. Hoist known keys to proto fields, then defensively strip any
      // remaining _PROTO_* so an unrecognized future key can't silently land
      // in the general-access additional_metadata blob. sink.ts applies the
      // same strip before Datadog; this closes the 1P side.
      const {
        _PROTO_skill_name,
        _PROTO_plugin_name,
        _PROTO_marketplace_name,
        ...rest
      } = formatted.additional
      const additionalMetadata = stripProtoFields(rest)

      events.push({
        event_type: 'ClaudeCodeInternalEvent',
        event_data: ClaudeCodeInternalEvent.toJSON({
          event_id: attributes.event_id as string | undefined,
          event_name: eventName,
          client_timestamp: this.hrTimeToDate(log.hrTime),
          device_id: attributes.user_id as string | undefined,
          email: userMetadata?.email,
          auth: formatted.auth,
          ...formatted.core,
          env: formatted.env,
          process: formatted.process,
          skill_name:
            typeof _PROTO_skill_name === 'string'
              ? _PROTO_skill_name
              : undefined,
          plugin_name:
            typeof _PROTO_plugin_name === 'string'
              ? _PROTO_plugin_name
              : undefined,
          marketplace_name:
            typeof _PROTO_marketplace_name === 'string'
              ? _PROTO_marketplace_name
              : undefined,
          additional_metadata:
            Object.keys(additionalMetadata).length > 0
              ? Buffer.from(jsonStringify(additionalMetadata)).toString(
                  'base64',
                )
              : undefined,
        }),
      })
    }

    return { events }
  }

  async shutdown(): Promise<void> {
    this.isShutdown = true
    this.resetBackoff()
    await this.forceFlush()
    if (process.env.USER_TYPE === 'ant') {
      logForDebugging('1P event logging exporter shutdown complete')
    }
  }

  async forceFlush(): Promise<void> {
    await Promise.all(this.pendingExports)
    if (process.env.USER_TYPE === 'ant') {
      logForDebugging('1P event logging exporter flush complete')
    }
  }
}

function getAxiosErrorContext(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return errorMessage(error)
  }

  const parts: string[] = []

  const requestId = error.response?.headers?.['request-id']
  if (requestId) {
    parts.push(`request-id=${requestId}`)
  }

  if (error.response?.status) {
    parts.push(`status=${error.response.status}`)
  }

  if (error.code) {
    parts.push(`code=${error.code}`)
  }

  if (error.message) {
    parts.push(error.message)
  }

  return parts.join(', ')
}
