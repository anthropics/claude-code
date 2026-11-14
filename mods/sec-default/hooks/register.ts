import type { On } from 'claude-code'

import { admissionFailure } from './admission-failure'
import HeldVerdict from './held-verdict'
import HotReloadPrompt from './hot-reload-prompt'
import { managedModsOnlyRefusal } from './managed-mods-only-refusal'
import { pastUsers } from './past-users'
import { pinnedVariableRefusal } from './pinned-variable-refusal'
import Policy from './policy'
import { isSkillRow } from './skill-row'
import {
  registerRefusalOf,
  TOOL_REGISTER_REFUSAL,
} from './tool-register-refusal'
import { usesNothing } from './uses-nothing'

const TOOL_LIST_REFUSAL = 'sec-default could not read the tool list'

/**
 * The built-in's hooks, seated outermost: each keeps one control an
 * organization has today out of reach of the plugins a person installs.
 *
 * Three moves: continue past the user tier (`next.to(e, "append")`), refuse
 * a user-tier caller or module by name, or pass. Provenance is the event's
 * pinned `provider` or `tier`; policy is `$.settings.read`; fail closed. Under
 * `forceHotReloadPrompt` it also asks about a mod Claude wrote before it loads.
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

  // The tool.describe and command.describe rows, like the agent.offer, prompt.section,
  // attribution.text and env.get rows, only pass the event on. The engine skips them where this
  // plugin is the copy built into it and no other plugin hooks the event. Before one does more,
  // take its event off that skip list: a test in the engine's repository fails and says where.
  on('tool.describe', ($, e, next) => pastUsers(e, next))
  on('command.describe', ($, e, next) => pastUsers(e, next))
  on('agent.offer', ($, e, next) => pastUsers(e, next))
  on('agent.spawn', ($, e, next) => pastUsers(e, next))

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

  // The engine skips this row on a successful check where this is the built-in copy and no other hook could run;
  // a failure still reaches the .catch. Before the row does more on success, end that skip: an engine test says where.
  on('tool.check', async ($, e, next) => {
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
    const answer = await next(e)
    // The engine names a plugin as the origin only on a call its allow stands on.
    const isOwnAllow =
      answer.decision === 'allow' &&
      next.origin.tier !== 'core' &&
      answer.plugin === next.origin.plugin
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

    const isPinned = await Policy.decidedByPolicy(
      readPolicy(() => $.settings.read(Policy.SOURCE)),
      policy => Policy.isPinnedVariable(policy, e.name),
    )

    if (!isPinned) {
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

  on('wasm.compile', ($, e, next) => {
    const isOrgs =
      next.origin.tier === 'prepend' || next.origin.tier === 'append'

    return isOrgs ? next.to(e, 'append') : next(e)
  }).catch(($, e, next) => {
    const isOrgs =
      next.origin.tier === 'prepend' || next.origin.tier === 'append'

    return isOrgs ? next.to(e, 'append') : next(e)
  })

  on('plugin.register', { tier: 'user' }, async ($, e, next) => {
    admittedAs.set(e.name, e.provenance)
    pastManagedOnly.delete(e.name)

    const policy = await $.settings.read(Policy.SOURCE)

    if (Policy.isManagedModsOnly(policy) && !usesNothing(e.uses)) {
      return { refuse: managedModsOnlyRefusal(e.name) }
    }

    pastManagedOnly.add(e.name)

    const folder = HotReloadPrompt.devModsFolderOf(e.root)

    if (!Policy.isHotReloadPromptForced(policy) || folder === undefined) {
      return next(e)
    }

    const kept = answers.get(folder)

    if (kept === HotReloadPrompt.TURN_THEM_ON) {
      return next(e)
    }

    if (kept !== undefined) {
      return { refuse: HotReloadPrompt.declinedRefusal(e.name) }
    }

    const isStored =
      (await $.store.get(HotReloadPrompt.yesKey(folder)).catch(() => false)) ===
      true

    if (isStored) {
      answers.set(folder, HotReloadPrompt.TURN_THEM_ON)

      return next(e)
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

    return next(e)
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

    if (next.called || (isAnsweredYes && pastManagedOnly.has(e.name))) {
      return next(e)
    }

    if (folder !== undefined && !isAnsweredYes) {
      return { refuse: HotReloadPrompt.unaskedRefusal(e.name) }
    }

    return usesNothing(e.uses)
      ? next(e)
      : { refuse: managedModsOnlyRefusal(e.name) }
  })
}
