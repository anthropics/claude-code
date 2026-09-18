import type {
  CommandSpec,
  EngineInterface,
  FsEntry,
  FsStat,
  PaneCloseArgs,
  PaneOpenArgs,
  ProcessRunInit,
  ProcessRunResult,
  SessionMessage,
  TimerCall,
} from 'claude-code'

/**
 * The engine as `session.start` bound it from its `$`, each member spelled
 * `$.noun.event(...)` there; used by every later hook, timer and press.
 */
export type Host = {
  /**
   * `$.clock.now`.
   */
  now: () => Promise<number>

  /**
   * `$.clock.after`.
   */
  after: TimerCall

  /**
   * `$.clock.every`.
   */
  every: TimerCall

  /**
   * `$.process.run`.
   */
  run: (
    argv: readonly string[],
    init: ProcessRunInit,
  ) => Promise<ProcessRunResult>

  /**
   * `$.fs.stat`.
   */
  stat: (path: string) => Promise<FsStat>

  /**
   * `$.fs.list`: a directory's entries by kind, links never followed.
   */
  listDir: (path: string) => Promise<FsEntry[]>

  /**
   * `$.fs.read`.
   */
  readFile: (path: string) => Promise<string>

  /**
   * Reads the plugin's store (`$.store.get`).
   */
  storeGet: (key: string) => Promise<unknown>

  /**
   * Writes the plugin's store (`$.store.set`).
   */
  storeSet: (key: string, value: unknown) => Promise<void>

  /**
   * Whether the session checkpoints edits (`$.settings.read`, `$.env.get`):
   * the built-in panel opens on an edit only while it does.
   */
  isCheckpointing: () => Promise<boolean>

  /**
   * `$.session.messages`.
   */
  messages: () => Promise<SessionMessage[]>

  /**
   * `$.ui.invalidate("ui.render")`: every pane instance draws again.
   */
  invalidate: () => void

  /**
   * `$.ui.status`: the plugin's line under the prompt.
   */
  status: (text: string | undefined) => void

  /**
   * One debug line under the plugin's name (`$.ui.log`).
   */
  uiLog: (text: string) => void

  /**
   * `$.ui.open`.
   */
  openPane: (pane: PaneOpenArgs) => Promise<unknown>

  /**
   * `$.ui.close`.
   */
  closePane: (pane: PaneCloseArgs) => Promise<void>

  /**
   * `$.command.register`; rejects while another `/diff` is listed.
   */
  registerCommand: (spec: CommandSpec) => Promise<unknown>

  /**
   * Which session the pane-shown row is latched to, as `$.session.id` says.
   */
  sessionId: () => Promise<string>

  /**
   * `$.telemetry.mark`; rejects where the telemetry built-in is absent.
   */
  mark: EngineInterface['telemetry']['mark']

  /**
   * `$.telemetry.log`; rejects where the telemetry built-in is absent.
   */
  log: EngineInterface['telemetry']['log']
}
