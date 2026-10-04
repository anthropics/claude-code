import type { On } from 'claude-code'

import { admissionFailure } from './admission-failure'
import HeldVerdict from './held-verdict'
import { managedModsOnlyRefusal } from './managed-mods-only-refusal'
import { pastUsers } from './past-users'
import Policy from './policy'
import { TOOL_REGISTER_REFUSAL } from './tool-register-refusal'

/**
 * The built-in's hooks, seated outermost: each keeps one control an
 * organization has today out of reach of the plugins a person installs.
 *
 * Three moves: continue past the user tier (`next.to(e, "append")`), refuse
 * a user-tier caller or module by name, or pass. Provenance is the event's
 * pinned `provider` or `tier`; policy is `$.settings.read`; fail closed.
 *
 * @param on the engine's registrar
 */
export function register(on: On) {
  const readPolicy = Policy.createPolicyMemo(Policy.POLICY_MEMO_MS)
  const told = new Set<string>()

  on('classic.*', ($, e, next) => next.to(e, 'append'))

  on('prompt.section', ($, e, next) => next.to(e, 'append'))
  on('prompt.context', ($, e, next) => next.to(e, 'append'))
  on('prompt.compose', ($, e, next) => next.to(e, 'append'))
  on('skill.prompt', ($, e, next) => next.to(e, 'append'))
  on('attribution.text', ($, e, next) => next.to(e, 'append'))

  on('settings.read', ($, e, next) => next.to(e, 'append'))

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

    const isRefused =
      next.origin.tier === 'user' &&
      (await Policy.decidedByPolicy(
        readPolicy(() => $.settings.read(Policy.SOURCE)),
        Policy.hasMcpAllowlist,
      ))

    return isRefused ? { deny: TOOL_REGISTER_REFUSAL } : next(e)
  })

  on('tool.list', async ($, e, next) =>
    Policy.managedToolsRestored(
      await readPolicy(() => $.settings.read(Policy.SOURCE)).catch(
        () => undefined,
      ),
      await next.to(e, 'append'),
      await next(e),
    ),
  )

  on('tool.check', async ($, e, next) => {
    const answer = await next(e)
    const mods = HeldVerdict.loosenedByUsers(next.trace)

    const shouldRecheck =
      answer.decision !== 'deny' &&
      mods.length > 0 &&
      (await Policy.decidedByPolicy(
        readPolicy(() => $.settings.read(Policy.SOURCE)),
        Policy.denyRulesHold,
      ))

    if (!shouldRecheck) {
      return answer
    }

    const held = await next.to(e, 'append')

    if (!HeldVerdict.isRuleDeny(held)) {
      return answer
    }

    for (const mod of mods.filter(name => !told.has(name))) {
      told.add(mod)
      $.ui.log(HeldVerdict.heldNotice(mod, e.tool, held.rule))
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

  on('plugin.register', { tier: 'user' }, async ($, e, next) =>
    Policy.isManagedModsOnly(await $.settings.read(Policy.SOURCE))
      ? { refuse: managedModsOnlyRefusal(e.name) }
      : next(e),
  ).catch(($, e, next) => {
    $.ui.log(admissionFailure(e.name, next.error), { to: 'debug' })

    return next.called ? next(e) : { refuse: managedModsOnlyRefusal(e.name) }
  })
}
