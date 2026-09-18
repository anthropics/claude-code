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
import Switches from './switches'
import Telemetry from './telemetry'

/**
 * No files: what a walk not taken, or one that failed, found.
 */
const NONE: readonly FsAncestor[] = []

/**
 * Registers the plugin's hooks for the mode `instructionFiles` names
 * (`claude-md-or-agents-md` when unset; the manifest lists the four, nothing
 * else arrives).
 *
 * `claude-md`: nothing beyond the usage row, the engine's CLAUDE.md walk
 * standing alone. `managed-only`: the project's and the person's instruction
 * files dropped, the organization's kept. `claude-md-or-agents-md` (a project
 * with none of its own) and `claude-md-and-agents-md`: AGENTS.md files joined
 * to the engine's instruction files, nested ones on a Read except in a run
 * where the engine attaches nothing to a turn (--bare, which sets
 * CLAUDE_CODE_SIMPLE, or CLAUDE_CODE_DISABLE_ATTACHMENTS). Every mode sends
 * its usage rows through `$.telemetry` where that noun is seated and drops
 * them where it is not.
 *
 * @param on the engine's registrar
 * @param options the plugin's options; `instructionFiles` is `claude-md`,
 * `claude-md-or-agents-md`, `claude-md-and-agents-md` or `managed-only`
 */
export function register(on: On, options: PluginOptions): void {
  const named = Modes.modeOf(options.instructionFiles)
  // COMPAT_BREAK(agents-md-project-instructions): drop the projectInstructions
  // mapping once stored settings have migrated. The host fills in the default,
  // so an instructionFiles set to it cannot be told from one left unset.
  const legacy = Modes.legacyModeOf(options.projectInstructions)
  const isLegacyRead = legacy !== undefined && named === Modes.DEFAULT_MODE
  const mode = isLegacyRead ? legacy : named
  let isRenameTold = legacy === undefined

  on('session.start', ($, e, next) => {
    Telemetry.quietly(() =>
      $.telemetry.log(Telemetry.modeRowOf(mode, e.isInteractive)),
    )

    if (!isRenameTold) {
      isRenameTold = true
      $.ui.log(
        isLegacyRead
          ? 'option projectInstructions in settings is honoured for now, ' +
              `read as instructionFiles ${mode}; set instructionFiles to ` +
              `${mode} and remove projectInstructions`
          : `option projectInstructions in settings is not read: ` +
              `instructionFiles ${mode} is set; remove projectInstructions`,
      )
    }

    return next(e)
  })

  if (mode === 'claude-md') {
    return
  }

  if (mode === 'managed-only') {
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

  const isFallback = mode === 'claude-md-or-agents-md'
  const given = new Map<string, Set<string>>()
  let inContext: readonly InstructionFile[] = []
  let home: string | undefined
  let isClaudeProject: boolean | undefined
  let rootSeen: string | undefined
  let rootLogged: string | undefined
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
    let isWalkFailed = false
    // The walk, not only what was handed: the engine can withhold a project
    // CLAUDE.md it loaded, and the project still has one.
    isClaudeProject =
      root !== undefined &&
      (handed.some(file => Files.isClaudeFileOnWalk(file, root)) ||
        (await $.fs.ancestors({ names: Names.CLAUDE_NAMES }).then(
          files => files.length > 0,
          () => {
            isWalkFailed = true

            return true
          },
        )))
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
        isClaudeProject && !isWalkFailed,
        isWalkFailed,
      )
      Telemetry.quietly(() =>
        $.telemetry.log(Telemetry.loadRowOf(mode, counts)),
      )
      Telemetry.quietly(() => $.telemetry.mark(Telemetry.loadMarkOf(counts)))
    }

    const isFirstLoad =
      root !== undefined && root !== rootLogged && added.length > 0

    if (isFirstLoad) {
      rootLogged = root
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

    if (!(await attachesOnRead($))) {
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
 * Whether a Read attaches nested AGENTS.md files in this run: not where the
 * engine attaches nothing to a turn, a nested CLAUDE.md included, which is a
 * --bare run (it sets CLAUDE_CODE_SIMPLE) or one with
 * CLAUDE_CODE_DISABLE_ATTACHMENTS on.
 *
 * Read on every Read, as the engine reads them on every turn: a settings
 * `env` block or a managed delivery can flip either mid-session. The files of
 * the walk itself need no such check: where the engine loads no instruction
 * files `$.fs.ancestors` finds none.
 *
 * @param $ the engine, as the `tool.call` hook holds it
 * @returns whether nested files ride a Read's result here
 */
async function attachesOnRead($: EngineInterface): Promise<boolean> {
  const [simple, attachmentsOff] = await Promise.all([
    $.env.get('CLAUDE_CODE_SIMPLE'),
    $.env.get('CLAUDE_CODE_DISABLE_ATTACHMENTS'),
  ])

  return (
    !Switches.isSwitchedOn(simple) && !Switches.isSwitchedOn(attachmentsOff)
  )
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
