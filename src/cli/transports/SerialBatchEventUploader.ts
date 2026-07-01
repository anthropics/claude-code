import { jsonStringify } from '../../utils/slowOperations.js'

/**
 * Serial ordered event uploader with batching, retry, and backpressure.
 *
 * - enqueue() adds events to a pending buffer
 * - At most 1 POST in-flight at a time
 * - Drains up to maxBatchSize items per POST
 * - New events accumulate while in-flight
 * - On failure: exponential backoff (clamped), retries indefinitely
 *   until success or close() — unless maxConsecutiveFailures is set,
 *   in which case the failing batch is dropped and drain advances
 * - flush() blocks until pending is empty and kicks drain if needed
 * - Backpressure: enqueue() blocks when maxQueueSize is reached
 */

/**
 * Throw from config.send() to make the uploader wait a server-supplied
 * duration before retrying (e.g. 429 with Retry-After). When retryAfterMs
 * is set, it overrides exponential backoff for that attempt — clamped to
 * [baseDelayMs, maxDelayMs] and jittered so a misbehaving server can
 * neither hot-loop nor stall the client, and many sessions sharing a rate
 * limit don't all pounce at the same instant. Without retryAfterMs, behaves
 * like any other thrown error (exponential backoff).
 */
export class RetryableError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message)
  }
}

type SerialBatchEventUploaderConfig<T> = {
  /** Max items per POST (1 = no batching) */
  maxBatchSize: number
  /**
   * Max serialized bytes per POST. First item always goes in regardless of
   * size; subsequent items only if cumulative JSON bytes stay under this.
   * Undefined = no byte limit (count-only batching).
   */
  maxBatchBytes?: number
  /** Max pending items before enqueue() blocks */
  maxQueueSize: number
  /** The actual HTTP call — caller controls payload format */
  send: (batch: T[]) => Promise<void>
  /** Base delay for exponential backoff (ms) */
  baseDelayMs: number
  /** Max delay cap (ms) */
  maxDelayMs: number
  /** Random jitter range added to retry delay (ms) */
  jitterMs: number
  /**
   * After this many consecutive send() failures, drop the failing batch
   * and move on to the next pending item with a fresh failure budget.
   * Undefined = retry indefinitely (default).
   */
  maxConsecutiveFailures?: number
  /** Called when a batch is dropped for hitting maxConsecutiveFailures. */
  onBatchDropped?: (batchSize: number, failures: number) => void
}

export class SerialBatchEventUploader<T> {
  private pending: T[] = []
  private pendingAtClose = 0
  private draining = false
  private closed = false
  private backpressureResolvers: Array<() => void> = []
  private sleepResolve: (() => void) | null = null
  private flushResolvers: Array<() => void> = []
  private droppedBatches = 0
  private readonly config: SerialBatchEventUploaderConfig<T>

  constructor(config: SerialBatchEventUploaderConfig<T>) {
    this.config = config
  }

  /**
   * Monotonic count of batches dropped via maxConsecutiveFailures. Callers
   * can snapshot before flush() and compare after to detect silent drops
   * (flush() resolves normally even when batches were dropped).
   */
  get droppedBatchCount(): number {
    return this.droppedBatches
  }

  /**
   * Pending queue depth. After close(), returns the count at close time —
   * close() clears the queue but shutdown diagnostics may read this after.
   */
  get pendingCount(): number {
    return this.closed ? this.pendingAtClose : this.pending.length
  }

  /**
   * Add events to the pending buffer. Returns immediately if space is
   * available. Blocks (awaits) if the buffer is full — caller pauses
   * until drain frees space.
   */
  async enqueue(events: T | T[]): Promise<void> {
    if (this.closed) return
    const items = Array.isArray(events) ? events : [events]
    if (items.length === 0) return

    // Backpressure: wait until there's space
    while (
      this.pending.length + items.length > this.config.maxQueueSize &&
      !this.closed
    ) {
      await new Promise<void>(resolve => {
        this.backpressureResolvers.push(resolve)
      })
    }

    if (this.closed) return
    this.pending.push(...items)
    void this.drain()
  }

  /**
   * Block until all pending events have been sent.
   * Used at turn boundaries and graceful shutdown.
   */
  flush(): Promise<void> {
    if (this.pending.length === 0 && !this.draining) {
      return Promise.resolve()
    }
    void this.drain()
    return new Promise<void>(resolve => {
      this.flushResolvers.push(resolve)
    })
  }

  /**
   * Drop pending events and stop processing.
   * Resolves any blocked enqueue() and flush() callers.
   */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.pendingAtClose = this.pending.length
    this.pending = []
    this.sleepResolve?.()
    this.sleepResolve = null
    for (const resolve of this.backpressureResolvers) resolve()
    this.backpressureResolvers = []
    for (const resolve of this.flushResolvers) resolve()
    this.flushResolvers = []
  }

  /**
   * Drain loop. At most one instance runs at a time (guarded by this.draining).
   * Sends batches serially. On failure, backs off and retries indefinitely.
   */
  private async drain(): Promise<void> {
    if (this.draining || this.closed) return
    this.draining = true
    let failures = 0

    try {
      while (this.pending.length > 0 && !this.closed) {
        const batch = this.takeBatch()
        if (batch.length === 0) continue

        try {
          await this.config.send(batch)
          failures = 0
        } catch (err) {
          failures++
          if (
            this.config.maxConsecutiveFailures !== undefined &&
            failures >= this.config.maxConsecutiveFailures
          ) {
            this.droppedBatches++
            this.config.onBatchDropped?.(batch.length, failures)
            failures = 0
            this.releaseBackpressure()
            continue
          }
          // Re-queue the failed batch at the front. Use concat (single
          // allocation) instead of unshift(...batch) which shifts every
          // pending item batch.length times. Only hit on failure path.
          this.pending = batch.concat(this.pending)
          const retryAfterMs =
            err instanceof RetryableError ? err.retryAfterMs : undefined
          await this.sleep(this.retryDelay(failures, retryAfterMs))
          continue
        }

        // Release backpressure waiters if space opened up
        this.releaseBackpressure()
      }
    } finally {
      this.draining = false
      // Notify flush waiters if queue is empty
      if (this.pending.length === 0) {
        for (const resolve of this.flushResolvers) resolve()
        this.flushResolvers = []
      }
    }
  }

  /**
   * Pull the next batch from pending. Respects both maxBatchSize and
   * maxBatchBytes. The first item is always taken; subsequent items only
   * if adding them keeps the cumulative JSON size under maxBatchBytes.
   *
   * Un-serializable items (BigInt, circular refs, throwing toJSON) are
   * dropped in place — they can never be sent and leaving them at
   * pending[0] would poison the queue and hang flush() forever.
   */
  private takeBatch(): T[] {
    const { maxBatchSize, maxBatchBytes } = this.config
    if (maxBatchBytes === undefined) {
      return this.pending.splice(0, maxBatchSize)
    }
    let bytes = 0
    let count = 0
    while (count < this.pending.length && count < maxBatchSize) {
      let itemBytes: number
      try {
        itemBytes = Buffer.byteLength(jsonStringify(this.pending[count]))
      } catch {
        this.pending.splice(count, 1)
        continue
      }
      if (count > 0 && bytes + itemBytes > maxBatchBytes) break
      bytes += itemBytes
      count++
    }
    return this.pending.splice(0, count)
  }

  private retryDelay(failures: number, retryAfterMs?: number): number {
    const jitter = Math.random() * this.config.jitterMs
    if (retryAfterMs !== undefined) {
      // Jitter on top of the server's hint prevents thundering herd when
      // many sessions share a rate limit and all receive the same
      // Retry-After. Clamp first, then spread — same shape as the
      // exponential path (effective ceiling is maxDelayMs + jitterMs).
      const clamped = Math.max(
        this.config.baseDelayMs,
        Math.min(retryAfterMs, this.config.maxDelayMs),
      )
      return clamped + jitter
    }
    const exponential = Math.min(
      this.config.baseDelayMs * 2 ** (failures - 1),
      this.config.maxDelayMs,
    )
    return exponential + jitter
  }

  private releaseBackpressure(): void {
    const resolvers = this.backpressureResolvers
    this.backpressureResolvers = []
    for (const resolve of resolvers) resolve()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.sleepResolve = resolve
      setTimeout(
        (self, resolve) => {
          self.sleepResolve = null
          resolve()
        },
        ms,
        this,
        resolve,
      )
    })
  }
}
