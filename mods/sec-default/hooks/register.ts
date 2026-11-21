import type { On } from 'claude-code'

import { admissionFailure } from './admission-failure'
import EarlyRun, {
  configFolders,
  type FirstFolder,
  isSettingsFile,
  namesSettingsFile,
  ownCallMatch,
  refusalOf,
  writeRepeats,
} from './early-run'
import HeldVerdict from './held-verdict'
import HotReloadPrompt from './hot-reload-prompt'
import { identityRefusal } from './identity-refusal'
import { managedModsOnlyRefusal } from './managed-mods-only-refusal'
import { isOrganizationsHookCall } from './organizations-hook-call'
import { pastUsers } from './past-users'
import { pinnedVariableRefusal } from './pinned-variable-refusal'
import Policy, { isCloudVariableInUse } from './policy'
import { isSkillRow } from './skill-row'
import {
  registerRefusalOf,
  TOOL_REGISTER_REFUSAL,
} from './tool-register-refusal'
import { usesNothing } from './uses-nothing'
import { withoutModules } from './without-modules'

const TOOL_LIST_REFUSAL = 'sec-default could not read the tool list'
const PERSONS_PROMPTS = ['composer', 'bridge', 'sdk', 'slack-ping']

/**
 * The built-in's hooks, seated outermost: each keeps one control an
 * organization has today out of reach of the plugins a person installs.
 *
 * Three moves: continue past the user tier (`next.to(e, "append")`), refuse
 * a user-tier caller or module by name, or pass. Provenance is the event's
 * pinned `provider` or `tier`, or an id policy names; policy is
 * `$.settings.read`; fail closed. Under
 * `forceHotReloadPrompt` it also asks about a mod Claude wrote before it loads.
 * It remembers the model's calls and each `$.agent.call`, so a person's mod runs none before it is allowed.
 *
 * @param on the engine's registrar
 */
export function register(on: On) {
  const readPolicy = Policy.createPolicyMemo(Policy.POLICY_MEMO_MS)
  const told = new Set<string>()
  const admittedAs = new Map<string, string>()
  const answers = new Map<string, string>()
  // Whose run of the hook below got past allowManagedModsOnly, for its `.catch`.
  const pastManagedOnly = new Set<string>()
  const memory = EarlyRun.createCallMemory()
  const first: FirstFolder = {}

  on('classic.*', ($, e, next) => next.to(e, 'append'))

  // This row and the attribution.text row below are skipped when alone on their
  // event: see the command.describe row.
  on('prompt.section', ($, e, next) => next.to(e, 'append'))
  on('prompt.context', ($, e, next) => next.to(e, 'append'))
  // This row and the session.append rows below only pass the event on, so the
  // engine may skip them when no other plugin hooks the event. Before one does
  // more, end that skip: an engine test, not in this folder, fails and says how.
  on('prompt.attachment', ($, e, next) => next.to(e, 'append'))
  on('prompt.compose', ($, e, next) => next.to(e, 'append'))
  on('skill.prompt', ($, e, next) => next.to(e, 'append'))
  on('attribution.text', ($, e, next) => next.to(e, 'append'))

  on('session.append', { door: 'attachment' }, ($, e, next) =>
    next.to(e, 'append'),
  )
  on('session.append', { door: 'hook-context' }, ($, e, next) =>
    next.to(e, 'append'),
  )
  on('session.append', { door: 'compaction' }, ($, e, next) =>
    next.to(e, 'append'),
  )
  on('session.append', { door: 'tool-message' }, ($, e, next) =>
    isSkillRow(e) ? next.to(e, 'append') : next(e),
  )
  on('session.append', { door: 'note' }, ($, e, next) => {
    const isOrgs =
      next.origin.tier === 'prepend' || next.origin.tier === 'append'

    return isOrgs ? next.to(e, 'append') : next(e)
  })

  on('session.compact', ($, e, next) => next.to(e, 'append'))

  on('settings.read', ($, e, next) => next.to(e, 'append'))

  on('session.info', ($, e, next) => next.to(e, 'append'))
  on('session.redact', ($, e, next) => next.to(e, 'append'))

  on('telemetry.log', { to: 'collector' }, ($, e, next) => next.to(e, 'append'))

  // It refuses, so it is never skipped when alone. No call on `$` here: a hook
  // that call reached would run with this one left out.
  on('session.identity', ($, e, next) =>
    next.origin.tier === 'user'
      ? identityRefusal(next.origin.plugin)
      : next.to(e, 'append'),
  ).catch(($, e, next) =>
    next.origin.tier === 'user'
      ? identityRefusal(next.origin.plugin)
      : next.to(e, 'append'),
  )

  // The tool.describe and command.describe rows, like the tool.offer, agent.offer, agent.report,
  // prompt.section, attribution.text, env.get and vcs rows (but vcs.diff), only pass the event on. The engine skips them
  // where this plugin is the copy built into it and no other plugin hooks the event. Before one does
  // more, take its event off that skip list: a test in the engine's repository fails and says where.
  on('tool.describe', ($, e, next) => pastUsers(e, next))
  on('command.describe', ($, e, next) => pastUsers(e, next))
  on('agent.offer', ($, e, next) => pastUsers(e, next))
  on('agent.spawn', ($, e, next) => pastUsers(e, next))
  on('agent.report', ($, e, next) => pastUsers(e, next))

  // By name too, as tool.list holds them: policy names tools the engine leaves in the user tier.
  on('tool.offer', async ($, e, next) => {
    const isOrgs = await Policy.decidedByPolicy(
      readPolicy(() => $.settings.read(Policy.SOURCE)),
      policy => Policy.isOrgTool(policy, e.tool),
    )

    return isOrgs ? next.to(e, 'append') : pastUsers(e, next)
  }).catch(($, e, next) => (next.called ? next(e) : next.to(e, 'append')))

  on('tool.register', async ($, e, next) => {
    const isOrgs =
      next.origin.tier === 'prepend' || next.origin.tier === 'append'

    if (isOrgs) {
      return next.to(e, 'append')
    }

    const refusal =
      next.origin.tier === 'user'
        ? await readPolicy(() => $.settings.read(Policy.SOURCE))
            .then(policy =>
              registerRefusalOf(
                policy,
                next.origin.plugin,
                e.name,
                admittedAs.get(next.origin.plugin),
              ),
            )
            .catch(() => TOOL_REGISTER_REFUSAL)
        : undefined

    return refusal === undefined ? next(e) : { deny: refusal }
  })

  on('tool.list', async ($, e, next) => {
    // The engine asks because settings changed, among other causes, and asks
    // only then: a memo younger than that change would answer it for good.
    const policy =
      next.origin.tier === 'core'
        ? $.settings.read(Policy.SOURCE)
        : readPolicy(() => $.settings.read(Policy.SOURCE))
    const managed = await policy.catch(() => undefined)
    const listed = await next.to(e, 'append')

    // Here and not in `.catch`, whose `next` replays this hook's last call: the
    // organization's listing is in hand, and whatever fails below costs it nothing.
    try {
      const answered = await next(e)
      const engine = await next.to(e, 'builtin')

      return Policy.managedToolsRestored(
        managed,
        listed,
        answered,
        engine,
        next.trace.some(
          link => link.tier === 'prepend' && link.reason === undefined,
        ),
      )
    } catch {
      return Policy.orgRemovalsApplied(managed, listed)
    }
  }).catch(async ($, e, next) =>
    Policy.orgRemovalsApplied(
      await $.settings.read(Policy.SOURCE).catch(() => undefined),
      await next.to(e, 'append').catch(() => ({ deny: TOOL_LIST_REFUSAL })),
    ),
  )

  // The rows from here to process.spawn read as absent where this is the built-in copy and no person's mod took a seat.
  // None has a .catch: a failure before a match is no ground to refuse, and refusalOf catches its own.
  on('tool.call', async ($, e, next) => {
    const call = EarlyRun.callOf(e)
    const id = e.tool_use_id

    if (EarlyRun.isUnasked(id)) {
      const match =
        next.origin.tier === 'user'
          ? await ownCallMatch($, memory, first, call, next.origin.plugin)
          : undefined
      const deny =
        match &&
        (await refusalOf(
          $,
          readPolicy,
          match.repeated,
          match.isSettings,
          match.write,
        ))

      return deny === undefined ? next(e) : { deny }
    }

    memory.sent(id, call, EarlyRun.makerOf(id, next.origin))

    try {
      return await next(e)
    } finally {
      memory.ended(id)
    }
  })

  on('agent.call', async ($, e, next) => {
    const id = Symbol()
    memory.sent(id, { tool: e.tool, input: e.input }, next.origin.plugin)

    try {
      return await next(e)
    } finally {
      memory.ended(id)
    }
  })

  on('tool.run', ($, e, next) => {
    const id = e.tool_use_id

    if (!EarlyRun.isUnasked(id)) {
      memory.allowed(id, EarlyRun.callOf(e), EarlyRun.makerOf(id, next.origin))
    }

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    if (PERSONS_PROMPTS.includes(e.origin.kind) && e.isMeta === undefined) {
      memory.prompted()
    }

    return next(e)
  })

  on('fs.write', async ($, e, next) => {
    if (next.origin.tier !== 'user') {
      return next(e)
    }

    const remembered = memory.calls(next.origin.plugin)
    const deny = await refusalOf(
      $,
      readPolicy,
      await writeRepeats($, remembered, e.path),
      await isSettingsFile($, e.path, first),
      { path: e.path, first, remembered },
    )

    return deny === undefined ? next(e) : { deny }
  })

  // A hook of theirs that heard this plugin's own stat would run inside the row that made it, unheard by that row.
  on('fs.stat', { resolve: true }, ($, e, next) =>
    next.origin.tier === 'prepend' && next.origin.plugin === $.plugin.name
      ? next.to(e, 'append')
      : next(e),
  )

  on('process.run', async ($, e, next) => {
    const deny =
      next.origin.tier === 'user'
        ? await refusalOf(
            $,
            readPolicy,
            EarlyRun.processRepeats(
              memory.calls(next.origin.plugin),
              e.argv,
              e.init?.stdin,
            ),
            await namesSettingsFile(
              $,
              [...e.argv, e.init?.stdin ?? ''],
              memory.served(),
            ),
          )
        : undefined

    return deny === undefined ? next(e) : { deny }
  })

  on('process.spawn', async function* ($, e, next) {
    const deny =
      next.origin.tier === 'user'
        ? await refusalOf(
            $,
            readPolicy,
            EarlyRun.processRepeats(
              memory.calls(next.origin.plugin),
              e.argv,
              e.input,
            ),
            await namesSettingsFile(
              $,
              [...e.argv, e.input ?? ''],
              memory.served(),
            ),
          )
        : undefined

    return deny === undefined ? yield* next(e) : { deny }
  })

  // The engine skips this row on a successful check where this is the built-in copy and no other hook could run;
  // a failure still reaches the .catch. Before the row does more on success, end that skip: an engine test says where.
  on('tool.check', async ($, e, next) => {
    const id = e.tool_use_id

    if (id === undefined) {
      if (
        isOrganizationsHookCall(next.origin) ||
        (next.origin.tier === 'prepend' &&
          next.origin.plugin === $.plugin.name)
      ) {
        return next.to(e, 'append')
      }
    } else if (!EarlyRun.isUnasked(id)) {
      const call = { tool: e.tool, input: Object(e.input) }
      memory.checked(id, call, EarlyRun.makerOf(id, next.origin))
    }

    const answer = await next(e)
    const mods = HeldVerdict.rewrittenByUsers(next.trace)

    const shouldRecheck =
      mods.length > 0 &&
      (await Policy.decidedByPolicy(
        readPolicy(() => $.settings.read(Policy.SOURCE)),
        Policy.denyRulesHold,
      ))

    if (!shouldRecheck) {
      return answer
    }

    const held = await next.to(e, 'append')

    const { approver }: { tool: string; approver?: string } = e

    if (!HeldVerdict.holdsOver(held, answer, approver)) {
      return answer
    }

    const lines = HeldVerdict.untoldNotices(told, mods, e.tool, {
      held,
      answer,
    })

    for (const line of lines) {
      $.ui.log(line)
    }

    return held
  }).catch(async ($, e, next) => {
    if (isOrganizationsHookCall(next.origin)) {
      return next.to(e, 'append')
    }

    const last = await next(e).catch(() => undefined)

    const shouldVouch = await Policy.decidedByPolicy(
      readPolicy(() => $.settings.read(Policy.SOURCE)),
      Policy.denyRulesHold,
    )

    return shouldVouch ? HeldVerdict.caughtAnswer(last, next.trace) : last
  })

  // The engine raises nothing here where this is the built-in copy and no other hook could run.
  // Before the row does more than hand up what it heard then, end that skip (tool-judge.ts).
  on('tool.judge', async ($, e, next) => {
    const match =
      next.origin.tier === 'user'
        ? await ownCallMatch(
            $,
            memory,
            first,
            { tool: e.tool, input: Object(e.input) },
            next.origin.plugin,
          )
        : undefined
    const isMatched =
      match !== undefined &&
      (match.isSettings ||
        match.repeated.some(call => call.isAllowed === undefined))
    const answer = await next(e)
    // The engine names a plugin as the origin only on a call its allow stands on.
    const isOwnAllow =
      answer.decision === 'allow' &&
      next.origin.tier !== 'core' &&
      answer.plugin === next.origin.plugin &&
      !isMatched
    // A deny that rewords no other plugin's is final, and worth no classifier request.
    const isPlainDeny =
      answer.decision === 'deny' &&
      next.trace.every(({ returned }) =>
        [undefined, answer.plugin].includes(returned?.plugin),
      )
    const mods =
      isOwnAllow || isPlainDeny ? [] : HeldVerdict.rewrittenByUsers(next.trace)

    const shouldRecheck =
      mods.length > 0 &&
      (await Policy.decidedByPolicy(
        readPolicy(() => $.settings.read(Policy.SOURCE)),
        Policy.denyRulesHold,
      ))

    if (!shouldRecheck) {
      return answer
    }

    const held = await next.to(e, 'append')

    if (!HeldVerdict.holdsAtJudge(held, answer, e)) {
      return answer
    }

    // An allow refuses nothing, and a missing verdict has no name to tell.
    const isTold =
      held.decision === 'deny' ||
      (held.decision === 'ask' && held.plugin !== undefined)
    const lines = isTold
      ? HeldVerdict.untoldNotices(told, mods, e.tool, { held, answer })
      : []

    for (const line of lines) {
      $.ui.log(line)
    }

    return held
  }).catch(async ($, e, next) => {
    const last = await next(e).catch(() => undefined)

    const shouldVouch = await Policy.decidedByPolicy(
      readPolicy(() => $.settings.read(Policy.SOURCE)),
      Policy.denyRulesHold,
    )

    return shouldVouch ? HeldVerdict.caughtAnswer(last, next.trace) : last
  })

  on('ui.log', ($, e, next) => {
    const isOrgs =
      next.origin.tier === 'prepend' || next.origin.tier === 'append'

    return isOrgs ? next.to(e, 'append') : next(e)
  })

  // Skipped when alone on the event: see the command.describe row.
  on('env.get', ($, e, next) => {
    const isOrgs =
      next.origin.tier === 'prepend' || next.origin.tier === 'append'

    return isOrgs ? next.to(e, 'append') : next(e)
  })

  on('env.set', async ($, e, next) => {
    const isOrgs =
      next.origin.tier === 'prepend' || next.origin.tier === 'append'

    if (isOrgs) {
      return next.to(e, 'append')
    }

    const isPinned =
      (await Policy.decidedByPolicy(
        readPolicy(() => $.settings.read(Policy.SOURCE)),
        policy => Policy.isPinnedVariable(policy, e.name),
      )) || (await isCloudVariableInUse($, e.name))

    if (!isPinned) {
      // A home variable can get here, and the settings hold reads them.
      if (first.folder === undefined) {
        await configFolders($, first)
      }

      return next(e)
    }

    const isTheirs = next.origin.tier === 'user'

    return isTheirs
      ? { deny: pinnedVariableRefusal(e.name) }
      : next.to(e, 'append')
  }).catch(($, e, next) => {
    if (next.called) {
      return next(e)
    }

    const isTheirs = next.origin.tier === 'user'

    return isTheirs
      ? { deny: pinnedVariableRefusal(e.name) }
      : next.to(e, 'append')
  })

  // Skipped when alone on the event: see the command.describe row.
  on(
    'vcs.detect',
    async ($, e, next) => (await next.to(e, 'append')) ?? next(e),
  ).catch(($, e, next) => next.to(e, 'append'))

  on('vcs.diff', async ($, e, next) => {
    const theirs = await next.to(e, 'append')

    return theirs.unknown === null ? next(e) : theirs
  }).catch(($, e, next) => next.to(e, 'append'))

  on('wasm.compile', ($, e, next) => {
    const isOrgs =
      next.origin.tier === 'prepend' || next.origin.tier === 'append'

    return isOrgs ? next.to(e, 'append') : next(e)
  }).catch(($, e, next) => {
    const isOrgs =
      next.origin.tier === 'prepend' || next.origin.tier === 'append'

    return isOrgs ? next.to(e, 'append') : next(e)
  })

  // Skipped when alone on their event: see the command.describe row.
  on('vcs.isolate', async ($, e, next) => {
    const isOrgs = await Policy.decidedByPolicy(
      readPolicy(() => $.settings.read(Policy.SOURCE)),
      Policy.hasWorktreeHook,
    )

    return isOrgs ? next.to(e, 'append') : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : next.to(e, 'append')))

  on('vcs.list', async ($, e, next) => {
    const isOrgs = await Policy.decidedByPolicy(
      readPolicy(() => $.settings.read(Policy.SOURCE)),
      Policy.hasWorktreeHook,
    )

    return isOrgs ? next.to(e, 'append') : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : next.to(e, 'append')))

  on('vcs.status', async ($, e, next) => {
    const isOrgs = await Policy.decidedByPolicy(
      readPolicy(() => $.settings.read(Policy.SOURCE)),
      Policy.hasWorktreeHook,
    )

    return isOrgs ? next.to(e, 'append') : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : next.to(e, 'append')))

  on('vcs.release', async ($, e, next) => {
    const isOrgs = await Policy.decidedByPolicy(
      readPolicy(() => $.settings.read(Policy.SOURCE)),
      Policy.hasWorktreeHook,
    )

    return isOrgs ? next.to(e, 'append') : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : next.to(e, 'append')))

  on('plugin.register', { tier: 'user' }, async ($, e, next) => {
    admittedAs.set(e.name, e.provenance)
    pastManagedOnly.delete(e.name)

    const policy = await $.settings.read(Policy.SOURCE)
    const folder = HotReloadPrompt.devModsFolderOf(e.root)

    if (Policy.isManagedModsOnly(policy) && !usesNothing(e.uses)) {
      // Claude writes in a dev-mods folder, so the other parts stay out too.
      if (folder !== undefined) {
        return { refuse: managedModsOnlyRefusal(e.name) }
      }

      $.ui.log(managedModsOnlyRefusal(e.name), { to: 'debug' })

      // The option covers modules alone, and a person's mods have no say on the rest.
      return next.to(withoutModules(e), 'append')
    }

    pastManagedOnly.add(e.name)

    const isRequired = e.requiredByOrganization === true

    if (!Policy.isHotReloadPromptForced(policy) || folder === undefined) {
      // An organization's plugin can sit in the user tier, where a person's
      // refusal would take its command hooks with it.
      return isRequired || Policy.isOrgPlugin(policy, e.provenance)
        ? next.to(e, 'append')
        : next(e)
    }

    const kept = answers.get(folder)

    if (kept === HotReloadPrompt.TURN_THEM_ON) {
      return isRequired ? next.to(e, 'append') : next(e)
    }

    if (kept !== undefined) {
      return { refuse: HotReloadPrompt.declinedRefusal(e.name) }
    }

    const isStored =
      (await $.store.get(HotReloadPrompt.yesKey(folder)).catch(() => false)) ===
      true

    if (isStored) {
      answers.set(folder, HotReloadPrompt.TURN_THEM_ON)

      return isRequired ? next.to(e, 'append') : next(e)
    }

    // A rejection is no answer: the next load, where someone can answer, asks.
    const answer = await $.ui
      .ask(HotReloadPrompt.HOT_RELOAD_QUESTION, {
        header: 'Organization',
        // First, so a stray Enter refuses: in bypass and auto no other question comes.
        options: [HotReloadPrompt.NOT_NOW, HotReloadPrompt.TURN_THEM_ON],
      })
      .catch(() => undefined)

    if (answer === undefined) {
      return { refuse: HotReloadPrompt.unaskedRefusal(e.name) }
    }

    answers.set(folder, answer)

    if (answer !== HotReloadPrompt.TURN_THEM_ON) {
      return { refuse: HotReloadPrompt.declinedRefusal(e.name) }
    }

    // A failed write costs the next session a question, not this one its answer.
    await $.store.set(HotReloadPrompt.yesKey(folder), true).catch(() => {})

    return isRequired ? next.to(e, 'append') : next(e)
  }).catch(($, e, next) => {
    // A `.catch` that throws or waits past its grace answers nothing, and the mod
    // would load unasked: so this one waits on nothing, and its log line cannot stop it.
    try {
      $.ui.log(admissionFailure(e.name, next.error), { to: 'debug' })
    } catch {
      // The refusal below is what matters.
    }

    const folder = HotReloadPrompt.devModsFolderOf(e.root)
    const isAnsweredYes =
      folder !== undefined &&
      answers.get(folder) === HotReloadPrompt.TURN_THEM_ON

    const isRequired = e.requiredByOrganization === true

    if (pastManagedOnly.has(e.name) && (next.called || isAnsweredYes)) {
      return isRequired ? next.to(e, 'append') : next(e)
    }

    if (folder !== undefined && !isAnsweredYes) {
      return { refuse: HotReloadPrompt.unaskedRefusal(e.name) }
    }

    if (usesNothing(e.uses)) {
      return isRequired ? next.to(e, 'append') : next(e)
    }

    if (folder !== undefined) {
      return { refuse: managedModsOnlyRefusal(e.name) }
    }

    try {
      $.ui.log(managedModsOnlyRefusal(e.name), { to: 'debug' })
    } catch {
      // Keeping the module out is what matters.
    }

    return next.to(withoutModules(e), 'append')
  })
}
