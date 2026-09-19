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
import { mapLimited } from './map-limited'
import { messageOf } from './message-of'
import { mtimeOf } from './mtime-of'
import Names from './names'
import PaneState from './pane-state'
import PaneToggle from './pane-toggle'
import Record from './record'
import Tools from './tools'
import Turns from './turns'
import Views from './views'

/**
 * Registers the diff pane: `/diff` once the built-in stands down, the
 * pane's drawing and refresh, its opening on Claude's first edit, the ask.
 *
 * Git runs when the built-in's would: `session.start` binds the host and
 * registers `/diff`, and off its dispatch reads the transcript, so a resumed
 * session whose turns already edited opens as its first edit would; `/diff`
 * or the main loop's first checkpointed edit with room pins the backend,
 * until `/clear`, which reads afresh under a pane it leaves open; a docked
 * pane fetches, then opens.
 *
 * @param on the engine's registrar
 */
export function register(on: On) {
  let host: Host | null = null
  let backend: Backend.Backend | null = null
  let probing: Promise<boolean> | null = null
  let sessionStartMs = 0
  let isPaneOpen = false
  let dialogRows: number | null = null
  let hasAutoOpened = false
  let hasRestoredEdits = false
  let columns: number | null = null
  let shownSessionId: string | null = null
  let armed: Ask.ArmedAsk | null = null
  let carrying: Ask.ArmedAsk | null = null
  let isRefreshing = false
  let isRefreshQueued = false
  let generation = 0
  let landed = 0
  let bodyStamp: string | null = null
  let bodyBase: string | null = null

  const bodyLoads = new Map<string, Promise<Git.FileHunks | null>>()

  const polled = { toplevel: '', headKey: '' }
  const pin = { cwd: '', isEmpty: false, epoch: 0 }

  let model: PaneState.PaneModel = PaneState.INITIAL_MODEL

  const timers = new Map<'refresh' | 'redraw' | 'poll', Timer>()
  const loggedBaseKinds = new Set<'ok' | 'sad'>()

  const currentOf = (engine: Host): Host => host ?? engine

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
  }

  function dialogPane(): PaneOpenArgs {
    return {
      id: Names.PANE_ID,
      title: Names.PANE_TITLE,
      holdToasts: true,
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

    function loadOf(file: Git.FileStat): Promise<Git.FileHunks | null> {
      const load = pinned.fetchFileHunks(data, file)
      bodyLoads.set(file.path, load)

      return load.then(body => {
        if (bodyStamp === stamp) {
          model = {
            ...model,
            bodies: new Map(model.bodies).set(file.path, body),
          }

          redraw(engine)
        }

        return body
      })
    }

    return (
      await mapLimited(
        drawnFilesOf(model).filter(file => !bodyLoads.has(file.path)),
        Limits.BODY_FETCH_CONCURRENCY,
        loadOf,
      )
    ).includes(null)
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
        if (!isPaneOpen) {
          return
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

  async function refresh(engine: Host): Promise<void> {
    if (isRefreshing) {
      isRefreshQueued = true

      return
    }

    isRefreshing = true

    const record = Record.recorderOf(engine)
    const pinned = backend

    const fetched = (): Promise<Git.FetchOutcome> =>
      pinned
        ? pinned.fetchDiff(model.requestedMode)
        : Promise.resolve({ kind: 'no-repository' })

    try {
      model = { ...model, isLoading: model.data === null }

      const [outcome, messages] = await Promise.all([
        fetched(),
        engine.messages().catch((): SessionMessage[] => []),
      ])

      model = PaneState.afterFetch(model, { outcome, messages })

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

          if (pinned) {
            startPoll(engine, pinned)
          }

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
      isRefreshing = false
      redraw(engine)

      if (isRefreshQueued) {
        isRefreshQueued = false
        scheduleRefresh(engine)
      }
    }
  }

  function scheduleRefresh(engine: Host): void {
    timers.get('refresh')?.cancel()

    timers.set(
      'refresh',
      engine.after(Limits.REFRESH_DEBOUNCE_MS, () => {
        timers.delete('refresh')
        void refresh(engine)
      }),
    )
  }

  async function openPane(
    engine: Host,
    trigger: (typeof Record.SHOWN_TRIGGERS)[number],
  ): Promise<boolean> {
    const isDialog = model.isFullscreen === false

    model = {
      ...model,
      selectedPath: null,
      dialogView: 'list',
      place: { ...model.place, top: 0, listStart: 0 },
    }

    dialogRows = isDialog ? Views.dialogRowsOf(model) : null

    const landedBefore = landed

    if (!isDialog) {
      await refresh(engine).catch(() => undefined)
    }

    const opened = await engine.openPane(
      isDialog
        ? { ...dialogPane(), focus: true }
        : { id: Names.PANE_ID, title: Names.PANE_TITLE, holdToasts: true },
    )

    const isWaiting = isRecord(opened) && opened.isPlaced === false

    if (isWaiting) {
      await engine.closePane({ id: Names.PANE_ID }).catch(() => undefined)

      return false
    }

    isPaneOpen = true

    const sessionId = await engine.sessionId().catch(() => null)

    if (sessionId !== null && sessionId !== shownSessionId) {
      shownSessionId = sessionId
      Record.recorderOf(engine).shown(trigger, Record.widthBucketOf(columns))
    }

    const isStale = isDialog || landed !== landedBefore

    if (isStale) {
      void refresh(engine)
    }

    return true
  }

  async function closePane(engine: Host): Promise<void> {
    await engine.closePane({ id: Names.PANE_ID })
    isPaneOpen = false
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

    hasAutoOpened = true
    hasAutoOpened = await openPane(engine, 'auto_open')
  }

  async function openOnRestore(engine: Host): Promise<void> {
    const messages = await engine.messages().catch((): SessionMessage[] => [])

    hasRestoredEdits = Turns.turnDiffsOf(messages).length > 0

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

      void refresh(engine)
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
      const viewport: { columns?: number; isFullscreen?: boolean } | undefined =
        e.viewport

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

  on('command.run', { command: Names.COMMAND_NAME }, async ($, e, next) => {
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

    const isDone = isOpening
      ? await openPane(host, 'manual')
      : await closePane(host).then(() => true)

    if (!isDone) {
      return { text: Names.RESIZE_TERMINAL_TEXT }
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
    }

    const isDialog = model.isFullscreen === false

    if (isPersons && host && isDialog) {
      host.uiLog(Names.DIALOG_DISMISSED_TEXT)
    }

    if (isPersons && host && !isDialog) {
      markTabSwitch(host, 'convo')
      await host.storeSet(Names.STORE_OPEN_KEY, false).catch(() => undefined)
    }

    return result
  })

  on('ui.focus', { plugin: Names.PLUGIN_NAME }, ($, e, next) => {
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
    const isKeptOpen = isPaneOpen && !isResume

    if (isPaneOpen && isResume) {
      await closePane(host).catch(() => undefined)
    }

    unpin()
    hasAutoOpened = false
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
      await pinBackend(host)
      void refresh(host)
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

    const hasLanded = isEdit
      ? hasEdited
      : result === undefined || result.deny === undefined

    if (hasLanded) {
      landed += 1
    }

    if (hasLanded && isPaneOpen) {
      scheduleRefresh(engine)
    }

    const isMainLoopEdit = hasEdited && e.agentId === undefined

    if (isMainLoopEdit) {
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
