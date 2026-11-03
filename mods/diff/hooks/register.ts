import type {
  Args,
  On,
  PaneOpenArgs,
  ResultOf,
  SessionMessage,
  Timer,
} from 'claude-code'

import Ask from './ask'
import Backend from './backend'
import { COMMAND_SPEC } from './command-spec'
import { drawnFilesOf } from './drawn-files-of'
import { entryKindsOf } from './entry-kinds-of'
import type Git from './git'
import type { Host } from './host'
import { isCheckpointing } from './is-checkpointing'
import { isOnPaneSurface } from './is-on-pane-surface'
import { isRecord } from './is-record'
import Limits from './limits'
import { messageOf } from './message-of'
import { mtimeOf } from './mtime-of'
import Names from './names'
import OpenOutcome from './open-outcome'
import PaneState from './pane-state'
import PaneToggle from './pane-toggle'
import Record from './record'
import { refreshRestOf } from './refresh-rest-of'
import Tools from './tools'
import Turns from './turns'
import Views from './views'

/**
 * Registers the diff pane: `/diff` once the built-in stands down, the
 * pane's drawing and refresh, its opening on Claude's first edit, the ask.
 *
 * Git runs when the built-in's would: none at the start; `/diff` or the main
 * loop's first checkpointed edit with room pins the backend, until `/clear`,
 * which reads afresh under a pane it leaves open. Reads an edit or command
 * causes then wait after a slow one (refreshRestOf).
 *
 * @param on the engine's registrar
 */
export function register(on: On) {
  let host: Host | null = null
  let backend: Backend.Backend | null = null
  let probing: Promise<boolean> | null = null
  let sessionStartMs = 0
  let isPaneOpen = false
  let awaited: (typeof Record.SHOWN_TRIGGERS)[number] | null = null
  let dialogRows: number | null = null
  let hasAutoOpened = false
  let isAutoOpenPending = false
  let isOpenAskKept = false
  let personCloses = 0
  let hasRestoredEdits = false
  let columns: number | null = null
  let shownSessionId: string | null = null
  let armed: Ask.ArmedAsk | null = null
  let carrying: Ask.ArmedAsk | null = null
  let isRefreshing = false
  let isRefreshQueued = false
  let isQueuedAsked = false
  let timedOutRefreshes = 0
  let restDueMs: number | null = null
  let reading: Promise<void> = Promise.resolve()
  let generation = 0
  let landed = 0
  let bodyStamp: string | null = null
  let bodyBase: string | null = null

  const bodyLoads = new Set<string>()

  const polled = { toplevel: '', headKey: '' }
  const pin = { cwd: '', isEmpty: false, epoch: 0 }

  let model: PaneState.PaneModel = PaneState.INITIAL_MODEL

  const timers = new Map<'refresh' | 'redraw' | 'poll' | 'rest', Timer>()
  const loggedBaseKinds = new Set<'ok' | 'sad'>()

  const currentOf = (engine: Host): Host => host ?? engine
  const isPaneSeen = (): boolean => isPaneOpen && awaited === null

  const backendHostOf = (engine: Host): Backend.BackendHost => ({
    run: (argv, init) =>
      currentOf(engine).run(
        argv,
        pin.cwd === '' ? init : { cwd: pin.cwd, ...init },
      ),
    readFile: path => currentOf(engine).readFile(path),
    mtimeOf: path => mtimeOf(currentOf(engine))(path),
    entryKindsOf: dir => entryKindsOf(currentOf(engine))(dir),
    nowMs: () => currentOf(engine).now(),
    sessionStartMsOf: () => sessionStartMs,
    onBranchBase: base => {
      const isError = base.kind === 'error'

      const outcome: Record.MarkOutcome = isError
        ? { kind: 'sad', reason: base.reason }
        : {
            kind: 'ok',
            props: {
              outcome: { value: base.kind, of: Record.BASE_OUTCOMES },
            },
          }

      if (!loggedBaseKinds.has(outcome.kind)) {
        loggedBaseKinds.add(outcome.kind)

        Record.recorderOf(currentOf(engine)).mark(
          Record.FEATURES.baseResolve,
          outcome,
        )
      }
    },
  })

  function pinBackend(engine: Host): Promise<boolean> {
    if (backend || pin.isEmpty) {
      return Promise.resolve(true)
    }

    probing ??= probeBackend(engine).finally(() => {
      probing = null
    })

    return probing
  }

  async function probeBackend(engine: Host): Promise<boolean> {
    const asked = { isAnswered: true }
    const probeHost = backendHostOf(engine)
    const { epoch } = pin

    const probed = await Backend.backendOf(
      {
        ...probeHost,
        run: (argv, init) =>
          probeHost.run(argv, init).catch((error: unknown) => {
            asked.isAnswered &&=
              argv[0] !== 'git' || !/\baborted\b/.test(messageOf(error))

            throw error
          }),
      },
      Backend.INSTALLED_BACKEND_PROBES,
    )

    if (epoch !== pin.epoch) {
      return false
    }

    backend ??= probed
    pin.isEmpty = backend === null && asked.isAnswered

    if (!probed || backend !== probed) {
      return asked.isAnswered || backend !== null
    }

    startPoll(engine, probed)

    const stored = PaneState.baseModeOf(
      await engine
        .storeGet(Names.baseStoreKeyOf(probed.repository.toplevel))
        .catch(() => undefined),
    )

    const mode = stored && probed.baseModes.includes(stored) ? stored : null

    model = {
      ...model,
      words: probed.words,
      baseModes: probed.baseModes,
      ...(mode && { requestedMode: mode }),
    }

    return true
  }

  function unpin() {
    backend = null
    pin.isEmpty = false
    pin.epoch += 1
    polled.toplevel = ''
    polled.headKey = ''
    timers.get('poll')?.cancel()
    timers.delete('poll')
    timers.get('rest')?.cancel()
    timers.delete('rest')
    timedOutRefreshes = 0
    isRefreshQueued = false
    isQueuedAsked = false
    timers.get('refresh')?.cancel()
    timers.delete('refresh')
  }

  function dialogPane(): PaneOpenArgs {
    return {
      id: Names.PANE_ID,
      title: Names.PANE_TITLE,
      closeOnEscape: true,
      rows: Views.dialogRowsOf(model),
    }
  }

  function fitDialog(engine: Host) {
    const rows = Views.dialogRowsOf(model)

    const isStale =
      isPaneOpen && model.isFullscreen === false && rows !== dialogRows

    if (isStale) {
      dialogRows = rows
      void engine.openPane(dialogPane()).catch(() => undefined)
    }
  }

  function redraw(engine: Host) {
    fitDialog(engine)

    if (timers.has('redraw')) {
      return
    }

    timers.set(
      'redraw',
      engine.after(Limits.REDRAW_COALESCE_MS, () => {
        timers.delete('redraw')
        engine.invalidate()
      }),
    )
  }

  async function loadBodies(engine: Host): Promise<boolean> {
    const { data } = model
    const pinned = backend

    if (!data || !pinned) {
      bodyStamp = null
      bodyBase = null
      bodyLoads.clear()
      model = { ...model, bodies: PaneState.NO_BODIES }

      return false
    }

    const stamp = bodyStampOf(data)
    const isNewBase = data.baseRef !== bodyBase

    if (stamp !== bodyStamp) {
      bodyStamp = stamp
      bodyLoads.clear()
    }

    if (isNewBase) {
      bodyBase = data.baseRef
      model = { ...model, bodies: PaneState.NO_BODIES }
      redraw(engine)
    }

    return fetchBodies(engine, pinned, data)
  }

  const bodyStampOf = (data: Git.DiffData) => `${generation}|${data.baseRef}`

  async function fetchBodies(
    engine: Host,
    pinned: Backend.Backend,
    data: Git.DiffData,
  ): Promise<boolean> {
    const stamp = bodyStampOf(data)

    const files = drawnFilesOf(model).filter(file => !bodyLoads.has(file.path))

    for (const file of files) {
      bodyLoads.add(file.path)
    }

    const read = await pinned.fetchHunks(data, files)
    const isCurrent = bodyStamp === stamp && read.size > 0

    if (isCurrent) {
      model = { ...model, bodies: new Map([...model.bodies, ...read]) }
      redraw(engine)
    }

    return [...read.values()].includes(null)
  }

  function keepBaseline() {
    const pinned = backend

    if (!pinned || polled.headKey !== '') {
      return
    }

    void pinned
      .headKeyOf()
      .catch(() => '')
      .then(key => {
        const isFirst = backend === pinned && polled.headKey === ''

        if (isFirst) {
          polled.headKey = key
        }
      })
  }

  function startPoll(engine: Host, pinned: Backend.Backend) {
    const readHeadKey = () => pinned.headKeyOf().catch(() => '')

    if (polled.toplevel === pinned.repository.toplevel) {
      return
    }

    timers.get('poll')?.cancel()
    polled.toplevel = pinned.repository.toplevel
    polled.headKey = ''

    timers.set(
      'poll',
      engine.every(Limits.HEAD_POLL_MS, () => {
        if (!isPaneSeen()) {
          return
        }

        if (isRefreshQueued && !isRefreshing) {
          void endOverdueRest(engine)
        }

        void readHeadKey().then(key => {
          const hasMoved = polled.headKey !== '' && key !== polled.headKey

          polled.headKey = key

          if (hasMoved) {
            scheduleRefresh(engine)
          }
        })
      }),
    )
  }

  /**
   * One read of the diff, covering every change seen before it starts. A call
   * made during a read is kept as one later read. So is a call made during
   * the wait after a slow read (refreshRestOf), unless `isAsked`.
   *
   * @param engine the bound host
   * @param isAsked skips that wait: true when someone is waiting on this read,
   *   such as an opening pane
   */
  async function refresh(engine: Host, isAsked = false): Promise<void> {
    const isHeld = isRefreshing || (timers.has('rest') && !isAsked)

    if (isHeld) {
      isRefreshQueued = true
      isQueuedAsked ||= isAsked

      if (!isRefreshing) {
        void endOverdueRest(engine)
      }

      return
    }

    isRefreshing = true

    let settle = (): void => undefined

    reading = new Promise(resolve => {
      settle = resolve
    })

    isRefreshQueued = false
    isQueuedAsked = false
    timers.get('refresh')?.cancel()
    timers.delete('refresh')

    const record = Record.recorderOf(engine)
    const pinned = backend
    const { epoch } = pin
    const startedMs = await engine.now().catch(() => null)

    let readKind: Git.FetchOutcome['kind'] | null = null
    let fetchedMs: number | null = null

    const fetched = async () => {
      const outcome: Git.FetchOutcome = pinned
        ? await pinned.fetchDiff(model.requestedMode)
        : { kind: 'no-repository' }

      return { outcome, endedMs: await engine.now().catch(() => null) }
    }

    try {
      model = { ...model, isLoading: model.data === null }

      const [read, messages] = await Promise.all([
        fetched(),
        engine.messages().catch((): SessionMessage[] => []),
      ])

      const { outcome } = read

      fetchedMs = read.endedMs
      model = PaneState.afterFetch(model, { outcome, messages })
      readKind = outcome.kind

      switch (outcome.kind) {
        case 'no-repository':
          break
        case 'unavailable':
          record.mark(Record.FEATURES.read, {
            kind: 'sad',
            reason: 'git_diff_failed',
          })

          break
        case 'data':
          generation += 1

          break
      }

      const hasHunksFailed = await loadBodies(engine)

      if (outcome.kind === 'data') {
        record.mark(
          Record.FEATURES.read,
          hasHunksFailed
            ? { kind: 'sad', reason: 'git_hunks_failed' }
            : { kind: 'ok' },
        )
      }
    } catch (error) {
      record.mark(Record.FEATURES.read, {
        kind: 'sad',
        reason: 'git_diff_threw',
      })

      throw error
    } finally {
      const endedMs = await engine.now().catch(() => null)
      const gitEndedMs = fetchedMs ?? endedMs

      const tookMs =
        startedMs === null || gitEndedMs === null ? 0 : gitEndedMs - startedMs

      isRefreshing = false
      settle()

      if (epoch === pin.epoch) {
        rest(engine, tookMs, readKind, endedMs ?? fetchedMs)
      }

      redraw(engine)
      runQueued(engine)
    }
  }

  /**
   * Starts the wait after a read (refreshRestOf). A failed git run does not say
   * why, so a read that got nothing counts as timed out once it ran for
   * GIT_TIMEOUT_MS.
   *
   * @param engine the bound host
   * @param tookMs how long the file listing ran (Backend.fetchDiff, not the
   *   hunk loads)
   * @param kind what it read, or null when it threw
   * @param endedMs when the refresh ended, or null if the clock failed
   */
  function rest(
    engine: Host,
    tookMs: number,
    kind: Git.FetchOutcome['kind'] | null,
    endedMs: number | null,
  ) {
    const isTimedOut = kind !== 'data' && tookMs >= Limits.GIT_TIMEOUT_MS

    timedOutRefreshes = isTimedOut ? timedOutRefreshes + 1 : 0
    timers.get('rest')?.cancel()
    timers.delete('rest')

    const restMs = refreshRestOf(tookMs, timedOutRefreshes)

    if (restMs === 0) {
      askKeptOpen(engine)

      return
    }

    const timer = engine.after(restMs, () => {
      if (timers.get('rest') === timer) {
        endRest(engine)
      }
    })

    timers.set('rest', timer)
    restDueMs = endedMs === null ? null : endedMs + restMs
  }

  function endRest(engine: Host) {
    timers.delete('rest')
    runQueued(engine)
    askKeptOpen(engine)
  }

  function askKeptOpen(engine: Host) {
    if (isOpenAskKept) {
      isOpenAskKept = false
      void openOnFirstEdit(engine).catch(() => undefined)
    }
  }

  /**
   * Ends a wait whose time has passed but whose timer never fired because the
   * host refused it, so a refused timer cannot hold reads for the whole
   * session.
   *
   * @param engine the bound host
   */
  async function endOverdueRest(engine: Host) {
    const timer = timers.get('rest')
    const dueMs = restDueMs
    const nowMs = await engine.now().catch(() => null)

    const isOverdue =
      timer !== undefined &&
      timers.get('rest') === timer &&
      dueMs !== null &&
      nowMs !== null &&
      nowMs >= dueMs

    if (isOverdue) {
      endRest(engine)
    }
  }

  /**
   * Starts the read kept while a read ran or a wait held it: at once if it
   * skips the wait, otherwise after the debounce once the wait ends. A read
   * that does not skip the wait is dropped if the pane has closed.
   *
   * @param engine the bound host
   */
  function runQueued(engine: Host) {
    if (!isRefreshQueued || isRefreshing) {
      return
    }

    const isAsked = isQueuedAsked
    const isResting = timers.has('rest')

    if (isResting && !isAsked && isPaneOpen) {
      return
    }

    isRefreshQueued = false
    isQueuedAsked = false

    if (isAsked) {
      void refresh(engine, true)
    } else if (isPaneOpen) {
      scheduleRefresh(engine)
    }
  }

  function scheduleRefresh(engine: Host): void {
    timers.get('refresh')?.cancel()

    const timer = engine.after(Limits.REFRESH_DEBOUNCE_MS, () => {
      if (timers.get('refresh') !== timer) {
        return
      }

      timers.delete('refresh')
      void refresh(engine)
    })

    timers.set('refresh', timer)
  }

  async function markShown(
    engine: Host,
    trigger: (typeof Record.SHOWN_TRIGGERS)[number],
  ): Promise<void> {
    const sessionId = await engine.sessionId().catch(() => null)

    if (sessionId !== null && sessionId !== shownSessionId) {
      shownSessionId = sessionId
      Record.recorderOf(engine).shown(trigger, Record.widthBucketOf(columns))
    }
  }

  async function showKept(
    engine: Host,
    trigger: (typeof Record.SHOWN_TRIGGERS)[number],
  ): Promise<void> {
    await markShown(engine, trigger)
    await pinBackend(engine)
    keepBaseline()
    void refresh(engine, true)
  }

  async function openPane(
    engine: Host,
    trigger: (typeof Record.SHOWN_TRIGGERS)[number],
    closesBefore = personCloses,
  ): Promise<OpenOutcome.OpenOutcome> {
    const isUnasked = trigger === 'auto_open'
    const epochBefore = pin.epoch

    /**
     * An open nobody asked for decides on a read it starts itself. A read
     * already running (a refresh started now would only queue behind it) may
     * predate the latest edit or a /resume, so it is waited out first.
     */
    while (isUnasked && isRefreshing) {
      await reading
    }

    const isOvertaken =
      isPaneOpen || pin.epoch !== epochBefore || personCloses !== closesBefore

    if (isUnasked && isOvertaken) {
      return 'withdrawn'
    }

    const isDialog = model.isFullscreen === false

    model = {
      ...model,
      selectedPath: null,
      dialogView: 'list',
      place: { ...model.place, top: 0, listStart: 0 },
    }

    dialogRows = isDialog ? Views.dialogRowsOf(model) : null

    const landedBefore = landed
    const generationBefore = generation

    if (!isDialog) {
      await refresh(engine, true).catch(() => undefined)
    }

    /**
     * generation moves only when a read returns data (a failed read keeps the
     * old list), so an unasked open shows a fresh list with a file in it.
     */
    const { data } = model

    const isShowable =
      generation !== generationBefore &&
      pin.epoch === epochBefore &&
      !isPaneOpen &&
      personCloses === closesBefore &&
      data !== null &&
      PaneState.headerTotalsOf(
        data,
        PaneState.partitionOf(
          data.files,
          model.isNoiseShown ? 'shown' : 'hidden',
        ),
      ).filesCount > 0

    if (isUnasked && !isShowable) {
      return 'withdrawn'
    }

    const opened = await engine.openPane(
      isDialog
        ? { ...dialogPane(), focus: true }
        : { id: Names.PANE_ID, title: Names.PANE_TITLE },
    )

    const outcome = OpenOutcome.openOutcomeOf(opened)

    if (outcome === 'withdrawn') {
      await engine.closePane({ id: Names.PANE_ID }).catch(() => undefined)

      return outcome
    }

    isPaneOpen = true
    keepBaseline()

    if (outcome === 'awaited') {
      awaited = trigger
    } else {
      await markShown(engine, trigger)
    }

    const isStale = isDialog || landed !== landedBefore

    if (isStale) {
      void refresh(engine, true)
    }

    return outcome
  }

  async function closePane(engine: Host): Promise<void> {
    await engine.closePane({ id: Names.PANE_ID })
    isPaneOpen = false
    awaited = null
  }

  function markTabSwitch(engine: Host, tab: (typeof Record.TABS)[number]) {
    Record.recorderOf(engine).mark(Record.FEATURES.tabSwitch, {
      kind: 'ok',
      props: { tab: { value: tab, of: Record.TABS } },
    })
  }

  async function openOnFirstEdit(engine: Host): Promise<void> {
    const isTaken = () => isPaneOpen || hasAutoOpened

    if (isTaken()) {
      return
    }

    /**
     * An ask after one that did not open the pane reads the repository again,
     * so it waits like a read an edit or command causes. Asks made during the
     * wait become one ask when it ends.
     */
    if (isAutoOpenPending && timers.has('rest')) {
      isOpenAskKept = true
      void endOverdueRest(engine)

      return
    }

    isOpenAskKept = false

    const closesBefore = personCloses
    const preference = await engine.storeGet(Names.STORE_OPEN_KEY)
    const isKeptOpen = preference === true

    const floor = isKeptOpen
      ? Limits.OPEN_MIN_COLUMNS
      : Limits.AUTO_OPEN_MIN_COLUMNS

    const hasRoom =
      preference !== false &&
      model.isFullscreen === true &&
      columns !== null &&
      columns >= floor

    if (!hasRoom || isTaken()) {
      return
    }

    const isCheckpointed = await engine.isCheckpointing().catch(() => true)

    if (!isCheckpointed || isTaken()) {
      return
    }

    await pinBackend(engine)

    if (!backend || isTaken()) {
      return
    }

    const landedBefore = landed
    const { epoch } = pin

    hasAutoOpened = true

    const outcome = await openPane(engine, 'auto_open', closesBefore).catch(
      (): OpenOutcome.OpenOutcome => 'withdrawn',
    )

    /**
     * After a /clear or /resume, hasAutoOpened and any retry belong to the new
     * conversation, which reset hasAutoOpened and may have started an attempt
     * of its own.
     */
    if (pin.epoch !== epoch) {
      return
    }

    hasAutoOpened = outcome !== 'withdrawn'
    isAutoOpenPending = !hasAutoOpened

    /**
     * An edit or shell command that landed during the attempt may have given
     * the diff something to list, and a main-loop edit that arrived then
     * returned early at the isTaken check above, so try again.
     */
    if (!hasAutoOpened && landed !== landedBefore) {
      await openOnFirstEdit(engine)
    }
  }

  async function openOnRestore(engine: Host): Promise<void> {
    hasRestoredEdits =
      Turns.turnDiffsOf(
        await engine.messages().catch((): SessionMessage[] => []),
      ).length > 0

    if (hasRestoredEdits) {
      await openOnFirstEdit(engine)
    }
  }

  function disarm(engine: Host) {
    armed = null
    model = { ...model, armedPath: null }
    engine.status(undefined)
  }

  const actionsOf = (engine: Host): Views.PaneActions => ({
    selectFile: path => {
      const isDocked = model.placement === 'dock'

      model = {
        ...model,
        selectedPath: path,
        dialogView: isDocked ? model.dialogView : 'detail',
        place: isDocked ? Views.placeAtFile(model, path) : model.place,
      }

      void loadBodies(engine).catch(() => undefined)
      redraw(engine)
    },
    scrollList: delta => {
      model = { ...model, place: Views.listScrolledBy(model, delta) }
      redraw(engine)
    },
    toggleNoise: () => {
      model = { ...model, isNoiseShown: !model.isNoiseShown }
      void loadBodies(engine)
      redraw(engine)
    },
    togglePreSession: () => {
      model = { ...model, isPreSessionShown: !model.isPreSessionShown }
      void loadBodies(engine)
      redraw(engine)
    },
    cycleBase: () => {
      const { baseModes, requestedMode } = model

      const mode =
        baseModes[(baseModes.indexOf(requestedMode) + 1) % baseModes.length] ??
        requestedMode

      if (mode === requestedMode) {
        return
      }

      model = { ...model, requestedMode: mode }

      Record.recorderOf(engine).mark(Record.FEATURES.baseSwitch, {
        kind: 'ok',
        props: { mode: { value: mode, of: model.baseModes } },
      })

      const toplevel = model.data?.repository.toplevel

      if (toplevel !== undefined) {
        void engine
          .storeSet(Names.baseStoreKeyOf(toplevel), mode)
          .catch(() => undefined)
      }

      void refresh(engine, true)
      redraw(engine)
    },
    chooseSource: value => {
      const index = Number(value)
      const isTurn = value !== 'current' && Number.isInteger(index)

      const source: PaneState.Source = isTurn
        ? { kind: 'turn', index }
        : { kind: 'current' }

      model = { ...model, source, selectedPath: null, dialogView: 'list' }
      redraw(engine)
    },
    toggleAsk: path => {
      if (armed?.path === path) {
        disarm(engine)
        redraw(engine)

        return
      }

      arm(engine, path)
    },
  })

  function arm(engine: Host, path: string) {
    armed = Ask.armedAskOf(
      path,
      PaneState.pickedTurnOf(model)?.files.find(file => file.path === path)
        ?.hunks ??
        model.bodies.get(path)?.hunks ??
        [],
    )

    model = { ...model, armedPath: path }

    engine.status(
      `${Views.sanitizeName(path)} rides your next prompt (press ` +
        `asked ✓ to drop it)`,
    )

    redraw(engine)
  }

  async function startedAtOf(engine: Host): Promise<number | null> {
    const startedAt: unknown = await engine.startedAt().catch(() => undefined)

    return typeof startedAt === 'number' ? startedAt : null
  }

  async function bind(engine: Host, cwd: string): Promise<void> {
    sessionStartMs = (await startedAtOf(engine)) ?? (await engine.now())
    pin.cwd = cwd

    try {
      await engine.registerCommand(COMMAND_SPEC)
      host = engine
    } catch (error) {
      const reason = messageOf(error)

      if (!Names.BUILTIN_HOLDS_PATTERN.test(reason)) {
        engine.uiLog(Names.registerFailedTextOf(Views.sanitizeName(reason)))
      }
    }
  }

  on('session.start', async ($, e, next) => {
    await bind(
      {
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
        every: (ms, fn) => $.clock.every(ms, fn),
        run: (argv, init) => $.process.run(argv, init),
        stat: path => $.fs.stat(path),
        listDir: path => $.fs.list(path),
        readFile: path => $.fs.read(path),
        storeGet: key => $.store.get(key),
        storeSet: (key, value) => $.store.set(key, value),
        isCheckpointing: async () =>
          isCheckpointing(
            await $.settings.read(),
            await $.env.get('CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING'),
          ),
        messages: () => $.session.messages(),
        invalidate: () => $.ui.invalidate('ui.render'),
        status: text => $.ui.status(text),
        uiLog: text => $.ui.log(text),
        openPane: pane => $.ui.open(pane),
        closePane: pane => $.ui.close(pane),
        registerCommand: spec => $.command.register(spec),
        sessionId: () => $.session.id(),
        startedAt: () =>
          $.session
            .usage()
            .then((usage: unknown) =>
              isRecord(usage) ? usage.startedAt : undefined,
            ),
        mark: entry => $.telemetry.mark(entry),
        log: entry => $.telemetry.log(entry),
      },
      e.cwd,
    )

    if (host) {
      void openOnRestore(host).catch(() => undefined)
    }

    return next(e)
  })

  on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
    if (isOnPaneSurface(e)) {
      const { viewport } = e

      const isFirstMeasure = columns === null && viewport?.columns !== undefined

      columns = viewport?.columns ?? columns

      model = {
        ...model,
        isFullscreen: viewport?.isFullscreen ?? model.isFullscreen,
      }

      if (isFirstMeasure && hasRestoredEdits && host) {
        void openOnFirstEdit(host).catch(() => undefined)
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== Names.PANE_ID || !host || !isOnPaneSurface(e)) {
      return next(e)
    }

    const { Box, Text, Button, Select, Code } = await $.ui.resolve(e)

    columns = e.viewport?.columns ?? columns

    if (awaited !== null) {
      const trigger = awaited

      awaited = null
      void showKept(host, trigger).catch(() => undefined)
    }

    /**
     * A seat that changed since the last drawing lists other rows, whose
     * bodies are read once.
     *
     * The model takes the new seat in this same pass, so the drawing that
     * read asks for finds the seat unchanged.
     */
    const isReseated = e.props.placement !== model.placement

    model = {
      ...model,
      placement: e.props.placement,
      place: {
        ...model.place,
        columns: Math.max(
          1,
          e.props.bodyColumns - Limits.PANE_RIGHT_PAD_COLUMNS,
        ),
        rows: e.props.scroll.bodyRows,
      },
    }

    if (isReseated) {
      void loadBodies(host).catch(() => undefined)
    }

    return Views.paneView(
      {
        ui: { Box, Text, Button, Select, Code },
        actions: actionsOf(host),
        columns: e.props.bodyColumns,
        rows: e.props.scroll.bodyRows,
      },
      model,
      { placement: e.props.placement, terminalColumns: columns },
    )
  })

  on('command.run', { command: 'diff' }, async ($, e, next) => {
    if (!host) {
      return next(e)
    }

    const isAnswered = (await pinBackend(host)) || (await pinBackend(host))

    if (!backend) {
      return {
        text: isAnswered
          ? Names.NOT_IN_REPOSITORY_TEXT
          : Names.GIT_UNANSWERED_TEXT,
      }
    }

    const { isFullscreen } = e.presentation

    columns = e.presentation.columns
    model = { ...model, isFullscreen }

    const toggle = PaneToggle.paneToggleOf({
      isOpen: isPaneOpen,
      columns: isFullscreen ? columns : null,
    })

    if (toggle === 'too-narrow') {
      return { text: Names.RESIZE_TERMINAL_TEXT }
    }

    const isOpening = toggle === 'open'

    if (!isOpening) {
      personCloses += 1
    }

    const outcome = isOpening
      ? await openPane(host, 'manual')
      : await closePane(host).then(() => 'placed' as const)

    if (outcome === 'withdrawn') {
      return { text: Names.RESIZE_TERMINAL_TEXT }
    }

    if (outcome === 'awaited') {
      return { text: Names.AWAITS_SURFACE_TEXT }
    }

    if (!isFullscreen) {
      return isOpening ? {} : { text: Names.DIALOG_DISMISSED_TEXT }
    }

    markTabSwitch(host, isOpening ? 'diff' : 'convo')
    await host.storeSet(Names.STORE_OPEN_KEY, isOpening).catch(() => undefined)

    return {
      text: isOpening ? Names.PANEL_SHOWN_TEXT : Names.PANEL_HIDDEN_TEXT,
    }
  })

  on('ui.close', { id: Names.PANE_ID }, async ($, e, next) => {
    const isBack =
      e.origin.kind === 'person' &&
      model.placement === 'inline' &&
      model.dialogView === 'detail'

    if (isBack && host) {
      model = { ...model, dialogView: 'list' }
      redraw(host)

      dialogRows = Views.dialogRowsOf(model)

      void host
        .openPane({ ...dialogPane(), focus: true })
        .catch(() => undefined)

      return { deny: 'back to the file list' }
    }

    const result = await next(e)
    const isClosed = result.deny === undefined
    const isPersons = isClosed && e.origin.kind === 'person'

    if (isClosed) {
      isPaneOpen = false
      awaited = null
    }

    if (isPersons) {
      personCloses += 1
    }

    const isDocking = model.isFullscreen !== false

    if (isPersons && host && isDocking) {
      markTabSwitch(host, 'convo')
      await host.storeSet(Names.STORE_OPEN_KEY, false).catch(() => undefined)
    }

    return result
  })

  on('ui.focus', { plugin: Names.PLUGIN_NAMES }, ($, e, next) => {
    const isListed =
      model.placement === 'inline' && model.dialogView === 'list' && host

    const focus = isListed ? Views.dialogFocusOf(model, e.element) : null

    if (focus === 'stay') {
      return {}
    }

    if (!focus || !host) {
      return next(e)
    }

    model = { ...model, selectedPath: focus.selectedPath }
    void loadBodies(host).catch(() => undefined)
    fitDialog(host)
    host.invalidate()

    return next({ ...e, element: focus.landing })
  })

  on('ui.scroll', { requestId: Names.PANE_ID }, ($, e, next) => {
    const isOwnBody = e.origin.kind === 'person' && model.placement === 'dock'

    if (!isOwnBody || !host) {
      return next(e)
    }

    const isOverList = Views.isWheelOverList(model, e)

    model = {
      ...model,
      place: isOverList
        ? Views.listScrolledBy(model, e.by)
        : Views.bodyScrolledBy(model, e),
    }

    host.invalidate()

    return {}
  })

  on('command.run', { command: ['clear', 'resume'] }, async ($, e, next) => {
    const result = await next(e)

    if (!host) {
      return result
    }

    const isResume = e.command === 'resume'
    const isKeptOpen = isPaneSeen() && !isResume

    if (isPaneOpen && isResume) {
      await closePane(host).catch(() => undefined)
    }

    unpin()
    hasAutoOpened = false
    isAutoOpenPending = false
    isOpenAskKept = false
    hasRestoredEdits = false
    bodyStamp = null
    bodyBase = null
    bodyLoads.clear()
    disarm(host)
    model = PaneState.afterNewSession(model)

    sessionStartMs =
      (await startedAtOf(host)) ??
      (isResume ? sessionStartMs : await host.now())

    if (isKeptOpen) {
      await showKept(host, 'manual')
    }

    if (isResume) {
      void openOnRestore(host).catch(() => undefined)
    }

    return result
  })

  function afterTool(
    engine: Host,
    e: Args<'tool.call'>,
    result: ResultOf['tool.call'] | undefined,
  ) {
    const isEdit = Tools.EDITING_TOOLS.some(name => name === e.tool)

    const hasEdited =
      isEdit &&
      result !== undefined &&
      result.deny === undefined &&
      result.isError !== true

    const hasLanded = isEdit ? hasEdited : Tools.mayHaveWritten(result)

    if (hasLanded) {
      landed += 1
    }

    if (hasLanded && isPaneSeen()) {
      scheduleRefresh(engine)
    }

    const isMainLoopEdit = hasEdited && e.agentId === undefined

    /**
     * Only a main-loop edit, or a restored session, makes the first ask. After
     * an ask that did not open the pane, any edit or shell command that lands
     * asks again, since it may have given the diff something to list.
     */
    if (isMainLoopEdit || (hasLanded && isAutoOpenPending)) {
      void openOnFirstEdit(engine).catch(() => undefined)
    }
  }

  on(
    'tool.call',
    { tool: [...Tools.EDITING_TOOLS, ...Tools.SHELL_TOOLS] },
    async ($, e, next) => {
      let result: ResultOf['tool.call'] | undefined

      try {
        result = await next(e)

        return result
      } finally {
        if (host) {
          afterTool(host, e, result)
        }
      }
    },
  )

  on('prompt.submit', async ($, e, next) => {
    const asked = armed

    if (!host || !asked || carrying === asked) {
      return next(e)
    }

    const context = e.context ?? []

    const text = Ask.fittedAskTextOf(
      asked.text,
      Limits.PROMPT_CONTEXT_MAX_CHARS -
        context.reduce((sum, entry) => sum + entry.length, 0),
    )

    if (text === undefined) {
      disarm(host)

      host.status(
        `${Views.sanitizeName(asked.path)}'s diff did not fit in the prompt ` +
          `and was dropped`,
      )

      redraw(host)

      return next(e)
    }

    carrying = asked

    try {
      const result = await next({ ...e, context: [...context, text] })

      if (result.drop === undefined) {
        Record.recorderOf(host).asked()

        if (armed === asked) {
          disarm(host)
          redraw(host)
        }
      }

      return result
    } finally {
      carrying = null
    }
  })
}
