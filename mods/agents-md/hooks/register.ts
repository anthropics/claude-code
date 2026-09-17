import type {
  EngineInterface,
  FsAncestor,
  InstructionFile,
  On,
  PluginOptions,
} from 'claude-code'

import Files from './files'
import Frames from './frames'
import Modes from './modes'
import Names from './names'
import Telemetry from './telemetry'

/**
 * No files: what a walk not taken, or one that failed, found.
 */
const NONE: readonly FsAncestor[] = []

/**
 * Registers the plugin's hooks for the mode `projectInstructions` names
 * (`claude` when unset; the manifest lists the four, nothing else arrives).
 *
 * `claude`: a nudge for a project with AGENTS.md alone. `none`: the project's
 * and the person's instruction files dropped, the organization's kept.
 * `agents-fallback` (a project with none of its own) and `both`: AGENTS.md
 * files joined to the engine's instruction files, nested ones on a Read.
 * Every mode sends its usage rows through `$.telemetry` where that noun is
 * seated and drops them where it is not.
 *
 * @param on the engine's registrar
 * @param options the plugin's options; `projectInstructions` is `claude`,
 * `agents-fallback`, `both` or `none`
 */
export function register(on: On, options: PluginOptions): void {
  const mode = Modes.modeOf(options.projectInstructions)

  on('session.start', ($, e, next) => {
    void started($, mode, e.isInteractive).catch(() => undefined)

    return next(e)
  })

  if (mode === 'claude') {
    return
  }

  if (mode === 'none') {
    on(
      'prompt.context',
      { instructionFiles: { kind: Files.DROPPED_KINDS } },
      ($, e, next) =>
        next({
          ...e,
          instructionFiles: e.instructionFiles?.filter(
            Files.isKeptWithoutInstructions,
          ),
        }),
    )

    return
  }

  const isFallback = mode === 'agents-fallback'
  const given = new Map<string, Set<string>>()
  let inContext: readonly InstructionFile[] = []
  let home: string | undefined
  let isClaudeProject: boolean | undefined
  let rootSeen: string | undefined
  let isLogged = false
  let isCounted = false

  on('prompt.context', async ($, e, next) => {
    const handed = e.instructionFiles

    if (handed === undefined) {
      return next(e).finally(() => {
        given.clear()
      })
    }

    const root = isFallback ? await $.session.root() : undefined
    rootSeen = root ?? rootSeen
    isClaudeProject =
      root !== undefined &&
      handed.some(file => Files.isClaudeFileOnWalk(file, root))
    let isWalkFailed = false
    const found = isClaudeProject
      ? NONE
      : await $.fs.ancestors({ names: Names.AGENTS_NAMES }).catch(() => {
          isWalkFailed = true

          return NONE
        })
    const added = Files.unseenFiles(Files.filesOf(found), handed)

    if (!isCounted) {
      isCounted = true
      const counts = Telemetry.loadCountsOf(
        added,
        isClaudeProject,
        isWalkFailed,
      )
      Telemetry.quietly(() =>
        $.telemetry.log(Telemetry.loadRowOf(mode, counts)),
      )
      Telemetry.quietly(() => $.telemetry.mark(Telemetry.loadMarkOf(counts)))
    }

    const isFirstLoad = isFallback && !isLogged && added.length > 0

    if (isFirstLoad) {
      isLogged = true
      $.ui.log(
        'no CLAUDE.md found; AGENTS.md loaded: ' +
          added
            .filter(file => file.parent === undefined)
            .map(file => file.path)
            .join(', '),
      )
    }

    const instructionFiles = Files.withProjectFiles(handed, added)

    return next({ ...e, instructionFiles }).finally(() => {
      given.clear()
      inContext = instructionFiles
    })
  })

  on('agent.spawn', { fork: true }, async ($, e, next) => {
    const result = await next(e)

    if (result.agentId !== undefined) {
      const parent = given.get(e.parentAgentId ?? Names.MAIN_LOOP)
      given.set(result.agentId, new Set(parent))
    }

    return result
  })

  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const result = await next(e)
    const isSettledElsewhere =
      e.tool !== 'Read' || result.deny !== undefined || result.isError

    if (isSettledElsewhere) {
      return result
    }

    const [root, cwd] = await Promise.all([$.session.root(), $.session.cwd()])
    home ??= await homeOf($, cwd)
    const read = Frames.absoluteOf(e.file_path, cwd, home)

    if (root !== rootSeen) {
      rootSeen = root
      isClaudeProject = undefined
      given.clear()
    }

    isClaudeProject ??=
      isFallback &&
      (await $.fs.ancestors({ names: Names.CLAUDE_NAMES })).length > 0
    const isOutOfReach = isClaudeProject || !Frames.isBelow(read, root)

    if (isOutOfReach) {
      return result
    }

    const [stack, claude] = await Promise.all([
      $.fs.ancestors({ names: Names.AGENTS_NAMES, of: read, below: root }),
      $.fs.ancestors({ names: Names.CLAUDE_NAMES, of: read, below: root }),
    ]).catch((): [typeof NONE, typeof NONE] => [NONE, NONE])
    const loop = e.agentId ?? Names.MAIN_LOOP
    const sent = given.get(loop) ?? new Set<string>()
    given.set(loop, sent)
    const nested = (
      isFallback ? Frames.outsideClaudeDirs(stack, claude) : stack
    ).filter(file => Frames.isBelow(file.dir, root))
    const fresh = Files.unseenFiles(Files.filesOf(nested), [
      ...inContext,
      ...Files.filesOf(claude),
    ]).filter(file => !sent.has(file.path))
    const attached = fresh.filter(file => !Frames.isFileAt(file, read))
    const isWholeRead = e.offset === undefined && e.limit === undefined

    for (const file of fresh) {
      const isSent =
        attached.includes(file) || (Frames.isFileAt(file, read) && isWholeRead)

      if (isSent) {
        sent.add(file.path)
      }
    }

    const hasAttached = attached.length > 0

    if (hasAttached) {
      Telemetry.quietly(() =>
        $.telemetry.log(Telemetry.nestedRowOf(mode, attached.length)),
      )
    }

    return hasAttached
      ? {
          ...result,
          context: [
            ...(result.context ?? []),
            ...attached.map(Frames.nestedFrame),
          ],
        }
      : result
  })
}

/**
 * What a fresh load does once the session has started, never awaited there:
 * sends the mode row; under `claude` runs the nudge's two walks, toasts the
 * nudge for a project with AGENTS.md and no CLAUDE.md and notes it shown;
 * under any other mode notes a nudge shown earlier as acted on, once.
 *
 * A failed walk finds nothing; a store or telemetry call that fails is
 * dropped. The session's start waits on none of it.
 *
 * @param $ the engine, as the `session.start` hook holds it
 * @param mode the configured mode
 * @param isInteractive whether a person is at the terminal
 */
async function started(
  $: EngineInterface,
  mode: Modes.Mode,
  isInteractive: boolean,
): Promise<void> {
  if (mode !== 'claude') {
    Telemetry.quietly(() =>
      $.telemetry.log(Telemetry.modeRowOf(mode, { isInteractive })),
    )
    const noted = await $.store.get(Telemetry.NUDGE_KEY)

    if (noted === 'shown') {
      await $.store.set(Telemetry.NUDGE_KEY, 'acted')
      Telemetry.quietly(() => $.telemetry.log(Telemetry.nudgeRowOf('acted')))
    }

    return
  }

  const [agents, claude] = await Promise.all([
    $.fs.ancestors({ names: Names.AGENTS_NAMES }),
    $.fs.ancestors({ names: Names.CLAUDE_NAMES }),
  ]).catch((): [typeof NONE, typeof NONE] => [NONE, NONE])
  const isAgentsOnlyProject = agents.length > 0 && claude.length === 0
  Telemetry.quietly(() =>
    $.telemetry.log(
      Telemetry.modeRowOf(mode, {
        isInteractive,
        agentsFileCount: agents.length,
        claudeFileCount: claude.length,
      }),
    ),
  )

  if (!isAgentsOnlyProject) {
    return
  }

  $.ui.toast(Names.NUDGE, { timeoutMs: Names.NUDGE_TIMEOUT_MS })
  Telemetry.quietly(() => $.telemetry.log(Telemetry.nudgeRowOf('shown')))
  const noted = await $.store.get(Telemetry.NUDGE_KEY)

  if (noted === undefined) {
    await $.store.set(Telemetry.NUDGE_KEY, 'shown')
  }
}

/**
 * The home directory a `~` in a Read's path stands for, read the way the
 * Read tool reads it.
 *
 * The profile directory on a Windows spelling of the working directory,
 * else `HOME`, each falling back to the other.
 *
 * @param $ the engine, as the `tool.call` hook holds it
 * @param cwd the session's working directory, whose spelling names the platform
 * @returns the home directory, or undefined when the environment names none
 */
async function homeOf(
  $: EngineInterface,
  cwd: string,
): Promise<string | undefined> {
  const [home, profile] = await Promise.all([
    $.env.get('HOME'),
    $.env.get('USERPROFILE'),
  ])
  const isWindowsSpelling = cwd.includes('\\')

  return isWindowsSpelling ? (profile ?? home) : (home ?? profile)
}
