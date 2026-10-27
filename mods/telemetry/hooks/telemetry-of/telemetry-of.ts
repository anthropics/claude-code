import type { HttpResponse, Timer } from 'claude-code'

import type { Telemetry } from '../../types'
import Batching from '../batching'
import Context from '../context'
import Entries from '../entries'
import type { Environment } from '../environment'
import { isAnalyticsOff } from '../is-analytics-off'
import type { Sender } from '../sender'
import type { TelemetryDeps } from '../telemetry-deps'

/**
 * Builds `$.telemetry` and its flush: `log` and `mark` check the entry and
 * queue a row; a batch goes out on a timer, when full, or when flushed.
 *
 * Each batch reads the switches afresh: analytics off, or unreadable, sends
 * nothing; no credential, or an ingest that refuses after one retry, drops
 * the batch. Each outcome is one debug line; the context is gathered once.
 *
 * @param deps the calls on the nouns beneath
 * @returns the noun and its flush
 */
export function telemetryOf(deps: TelemetryDeps): Sender {
  let pending: Batching.PendingRow[] = []
  let timer: Timer | undefined
  let context: Promise<Context.Context> | undefined
  let priming: Promise<void> | undefined
  let sending: Promise<void> = Promise.resolve()

  function gathered(): Promise<Context.Context> {
    const gathering =
      context ??
      deps
        .isInteractive()
        .then(isInteractive => Context.contextOf(deps, isInteractive))
        .catch((error: unknown) => {
          context = undefined
          throw error
        })

    context = gathering

    return gathering
  }

  async function sendingEnvironment(): Promise<Environment | undefined> {
    try {
      const [environment, policy] = await Promise.all([
        deps.environment(),
        deps.policy(),
      ])

      return isAnalyticsOff(environment, policy) ? undefined : environment
    } catch (error) {
      deps.debug(
        'telemetry: the analytics switches could not be read, so nothing ' +
          `is sent (${Batching.messageOf(error)})`,
      )

      return undefined
    }
  }

  async function primed(): Promise<void> {
    const environment = await sendingEnvironment()

    if (environment) {
      await gathered()
    }
  }

  const post = (body: string, auth: string): Promise<HttpResponse> =>
    deps.fetch(Entries.INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-name': 'claude-code',
      },
      auth,
      body,
    })

  async function postedWithRetry(
    body: string,
    auth: string,
  ): Promise<HttpResponse> {
    let first: HttpResponse | undefined

    try {
      first = await post(body, auth)
    } catch {
      first = undefined
    }

    const isSettled =
      first !== undefined && (first.ok || !Batching.isRetriable(first.status))

    if (first !== undefined && isSettled) {
      return first
    }

    await deps.sleep(Batching.RETRY_DELAY_MS)

    return post(body, auth)
  }

  async function send(rows: readonly Batching.PendingRow[]): Promise<void> {
    const environment = await sendingEnvironment()

    if (!environment) {
      return
    }

    const authorization = await deps.authorize()

    if (!authorization) {
      throw new Error('this session has no first-party credential to authorize')
    }

    const settled = await gathered()

    const response = await postedWithRetry(
      Entries.batchOf(rows, {
        sessionId: await deps.id(),
        model: await deps.model(),
        userType: environment.userType === 'ant' ? 'ant' : 'external',
        isInteractive: await deps.isInteractive(),
        isClaudeAiAuth:
          authorization.kind === 'bearer' &&
          settled.identity.accountUuid !== undefined,
        context: settled,
      }),
      authorization.handle,
    )

    if (!response.ok) {
      throw new Error(`the ingest answered ${response.status}`)
    }

    deps.debug(`telemetry: sent ${rows.length} row(s)`)
  }

  function flush(): Promise<void> {
    timer?.cancel()
    timer = undefined

    const rows = pending

    pending = []

    if (rows.length === 0) {
      return sending
    }

    sending = sending.then(() =>
      send(rows).catch((error: unknown) => {
        deps.debug(
          `telemetry: ${rows.length} row(s) not sent: ` +
            Batching.messageOf(error),
        )
      }),
    )

    return sending
  }

  function queued(fields: Entries.Fields) {
    priming ??= primed().catch(() => undefined)

    pending.push({
      fields,
      eventId: crypto.randomUUID(),
      loggedAt: new Date().toISOString(),
    })

    if (pending.length >= Batching.BATCH_ROWS) {
      void flush()

      return
    }

    timer ??= deps.after(Batching.BATCH_WINDOW_MS, () => void flush())
  }

  const telemetry: Telemetry = {
    log: async entry => queued(Entries.checkedFields(entry)),
    mark: async entry => queued(Entries.checkedMark(entry)),
  }

  return { telemetry, flush }
}
