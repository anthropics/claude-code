import type { On, PluginOptions } from 'claude-code'

import { answeredCalls } from './answered-calls'
import CoreCall from './core/call'
import Easel from './core/easel'
import Usage from './core/usage'
import { meetWatcher } from './meet-watcher'
import { recordUse } from './record-use'
import type Shell from './shell'
import { cacheOutcome } from './shell/cache-outcome'
import { callInput } from './shell/call-input'
import { clockedBlock } from './shell/clocked-block'
import { isOwnChartAtToolUse } from './shell/is-own-chart-at-tool-use'
import { isSeenOn } from './shell/is-seen-on'
import Limits from './shell/limits'
import Patterns from './shell/patterns'
import { queryOf } from './shell/query-of'
import { storedTextOf } from './shell/stored-text-of'
import { withChartNote } from './shell/with-chart-note'
import { withNewestChart } from './with-newest-chart'

/**
 * The hooks: everything that talks to the host. The pure pipeline is apart,
 * and `$` (the host's interface) goes no further than four functions beside
 * this file.
 *
 * Each has a name that nothing else declares. A terminal that starts on earlier
 * turns waits for the tool, or the host tells the model that it was removed.
 * The clock of a chart call is stored with its result, for later redraws.
 *
 * @param on registers a hook with the host
 * @param options what the person set for the plugin
 * @param host what a host that compiles the module in says itself
 * @returns nothing: the hooks are registered
 */
export function register(
  on: On,
  options: PluginOptions,
  host: Shell.Host = {},
): void {
  const saidByHost = host.isReaderOn?.()
  const cache: Shell.ChartCache = {
    charts: new Map(),
    chartlessIds: new Set(),
    autoChartCalls: new Map(),
    calledTools: new Map(),
    screenReader:
      saidByHost === undefined ? 'unread' : saidByHost ? 'on' : 'off',
  }
  const skippedServers = String(options.autoChartSkip ?? '').split(/[\s,]+/)

  const isAuto = (tool: string): boolean =>
    Patterns.OTHER_MCP_TOOL.test(tool) &&
    options.autoCharts !== false &&
    host.isRegulated?.() !== true &&
    !skippedServers.some(server => tool.startsWith(`mcp__${server}__`))
  const isSkipping = skippedServers.some(server => server !== '')
  const changedSetting =
    options.autoCharts === false ? 'off' : isSkipping && 'skips_servers'

  on('session.start', async ($, e, next) => {
    if (!isSeenOn(await $.session.surfaces())) {
      return next(e)
    }

    const offered = meetWatcher($, changedSetting)
    const started = await next(e)
    const hasTurns =
      e.isInteractive && (await $.session.turns().catch(() => 0)) > 0

    if (hasTurns) {
      await Promise.race([
        offered,
        $.clock.sleep(Limits.OFFER_WAIT_MS, { signal: next.signal }),
      ]).catch(() => undefined)
    }

    return started
  })

  on('session.attach', ($, e, next) => {
    void meetWatcher($, changedSetting)

    return next(e)
  })

  on('prompt.section', { name: 'env_info_simple' }, async (_$, e, next) => {
    const section = await next(e)

    return section.text === null
      ? section
      : { ...section, text: `${section.text}\n${CoreCall.SYSTEM_PROMPT_HINT}` }
  })

  on('tool.call', { tool: CoreCall.TOOL_NAME }, async ($, e, next) => {
    if (host.isRegulated?.() === true) {
      return { deny: CoreCall.WITHHELD_TEXT }
    }

    const {
      tool: _tool,
      tool_use_id,
      agentId,
      consent: _consent,
      $shadowed,
      ...fields
    } = e
    const input = callInput(fields, $shadowed)
    cache.transcript = undefined
    cache.calledTools.set(tool_use_id, CoreCall.TOOL_NAME)
    const isAwaited =
      fields.data === undefined &&
      agentId === undefined &&
      host.isBatchAwaited?.() === true
    const results = await answeredCalls(
      $,
      { tool_use_id, agentId, signal: next.signal },
      isAwaited ? Limits.WAITS_MS : [],
    )

    if (results === undefined) {
      return { deny: CoreCall.NO_CONVERSATION_TEXT }
    }

    const clock = {
      nowMs: await $.clock.now(),
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
    const startedMs = performance.now()
    const outcome = Easel.chartFromCall({ input, results, ...clock })
    cacheOutcome(cache, tool_use_id, outcome)
    recordUse($, outcome.usage, {
      isAsked: true,
      agentId,
      elapsedMs: performance.now() - startedMs,
    })
    const text = outcome.modelText

    const isDrawn = outcome.kind === 'chart'

    return isDrawn ? { result: [clockedBlock(text, clock)] } : { deny: text }
  }).catch(($, e) => {
    recordUse($, Usage.NOTHING_DRAWN, {
      isAsked: true,
      agentId: e.agentId,
      elapsedMs: 0,
    })

    return { deny: CoreCall.FAILURE_TEXT }
  })

  on('tool.call', { tool: Patterns.OTHER_MCP_TOOL }, async ($, e, next) => {
    if (e.agentId === undefined) {
      cache.calledTools.set(e.tool_use_id, e.tool)
    }

    const answer = await next(e)
    cache.transcript = undefined
    cache.newestAutoChart = undefined

    const isUnseen =
      'deny' in answer ||
      answer.isError ||
      !isAuto(e.tool) ||
      e.agentId !== undefined ||
      !isSeenOn(await $.session.surfaces())

    if (isUnseen) {
      return answer
    }

    const call = { nowMs: await $.clock.now(), query: queryOf(e) }
    const startedMs = performance.now()
    const text = storedTextOf(answer.result)
    const outcome = Easel.chartFromResult(text, call)

    if (outcome.kind !== 'chart') {
      cacheOutcome(cache, e.tool_use_id, outcome)

      return answer
    }

    cache.autoChartCalls.set(e.tool_use_id, call)
    cache.newestAutoChart = { id: e.tool_use_id, text, chart: outcome }
    recordUse($, outcome.usage, {
      isAsked: false,
      agentId: e.agentId,
      elapsedMs: performance.now() - startedMs,
    })

    return { ...answer, context: withChartNote(answer.context) }
  }).catch(async ($, e, next) => {
    const answer = await next(e)
    recordUse($, Usage.NOTHING_DRAWN, {
      isAsked: false,
      agentId: e.agentId,
      elapsedMs: 0,
    })

    return answer
  })

  on(
    'ui.render',
    {
      component: 'ToolResult',
      surface: 'terminal',
      props: { tool: CoreCall.TOOL_NAME },
    },
    async ($, e, next) =>
      (await withNewestChart($, {
        cache,
        event: e,
        hostRow: null,
        rows: [{ ...e.props, input: undefined }],
        isCharted: () => true,
      })) ?? next(e),
  )

  on(
    'ui.render',
    { component: 'ToolUse', props: { tool: [/^mcp__/, Patterns.ROW_LABEL] } },
    async ($, e, next) =>
      withNewestChart($, {
        cache,
        event: e,
        hostRow: await next(e),
        rows: [e.props],
        isCharted: tool =>
          tool === CoreCall.TOOL_NAME
            ? isOwnChartAtToolUse(e.surface)
            : isAuto(tool),
      }),
  )

  on(
    'ui.render',
    {
      component: 'ToolGroup',
      props: {
        isExpanded: false,
        calls: { tool: [/^mcp__/, Patterns.ROW_LABEL] },
      },
    },
    async ($, e, next) =>
      withNewestChart($, {
        cache,
        event: e,
        hostRow: await next(e),
        rows: e.props.calls,
        isCharted: isAuto,
      }),
  )
}
