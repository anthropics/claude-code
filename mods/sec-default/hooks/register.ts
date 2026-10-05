import type { On } from 'claude-code'

import Caught from './caught'
import HeldVerdict from './held-verdict'
import { managedModsOnlyRefusal } from './managed-mods-only-refusal'
import PastUsers from './past-users'
import Policy from './policy'
import { quietly } from './quietly'
import { toolRegistered } from './tool-registered'
import { toolsListed } from './tools-listed'

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
  const toldOfCeiling = new Set<string>()

  on('classic.*', ($, e, next) => next.to(e, 'append')).catch(($, e, next) =>
    Caught.pastUsersCaught(e, next),
  )

  on('prompt.section', ($, e, next) => next.to(e, 'append'))
  on('prompt.context', ($, e, next) => next.to(e, 'append'))
  on('prompt.compose', ($, e, next) => next.to(e, 'append'))
  on('skill.prompt', ($, e, next) => next.to(e, 'append'))
  on('attribution.text', ($, e, next) => next.to(e, 'append'))

  on('settings.read', ($, e, next) => next.to(e, 'append')).catch(
    ($, e, next) => Caught.pastUsersCaught(e, next),
  )

  on('tool.describe', ($, e, next) => PastUsers.pastUsers(e, next)).catch(
    ($, e, next) => Caught.providedCaught(e, next),
  )

  on('command.describe', ($, e, next) => PastUsers.pastUsers(e, next)).catch(
    ($, e, next) => Caught.providedCaught(e, next),
  )

  on('agent.offer', ($, e, next) => PastUsers.pastUsers(e, next)).catch(
    ($, e, next) => Caught.providedCaught(e, next),
  )

  on('agent.spawn', ($, e, next) => PastUsers.pastUsers(e, next)).catch(
    ($, e, next) => Caught.providedCaught(e, next),
  )

  on('tool.register', ($, e, next) =>
    toolRegistered(e, next, () =>
      Policy.decidedByPolicy(
        readPolicy(() => $.settings.read(Policy.SOURCE)),
        Policy.hasMcpAllowlist,
      ),
    ),
  ).catch(($, e, next) =>
    Caught.registerCaught(e, next, () => $.settings.read(Policy.SOURCE)),
  )

  on('tool.list', async ($, e, next) =>
    toolsListed(
      await readPolicy(() => $.settings.read(Policy.SOURCE)).catch(
        () => undefined,
      ),
      e,
      next,
    ),
  ).catch(($, e, next) => Caught.pastUsersCaught(e, next))

  on('tool.check', async ($, e, next) => {
    const answer = await next(e)
    const mods = HeldVerdict.loosenedByUsers(next.trace)
    const lifters = HeldVerdict.liftedByUsers(next.trace, e.ceiling)

    const doRulesHold =
      answer.decision !== 'deny' &&
      mods.length > 0 &&
      (await Policy.decidedByPolicy(
        readPolicy(() => $.settings.read(Policy.SOURCE)),
        Policy.denyRulesHold,
      ))

    if (!doRulesHold && !HeldVerdict.isOverCeiling(answer, e.ceiling)) {
      return answer
    }

    const held = await next.to(e, 'append')

    if (doRulesHold && HeldVerdict.isRuleDeny(held)) {
      for (const mod of HeldVerdict.untold(told, mods)) {
        told.add(mod)
        quietly(() => $.ui.log(HeldVerdict.heldNotice(mod, e.tool, held.rule)))
      }

      return held
    }

    if (!HeldVerdict.isCeilingHeld(answer, held, e.ceiling)) {
      return answer
    }

    for (const mod of HeldVerdict.untold(toldOfCeiling, lifters)) {
      toldOfCeiling.add(mod)
      quietly(() => $.ui.log(HeldVerdict.ceilingNotice(mod, e)))
    }

    return held
  }).catch(($, e, next) =>
    Caught.checkCaught(e, next, () => $.settings.read(Policy.SOURCE)),
  )

  on('ui.log', ($, e, next) =>
    PastUsers.USER_REACHABLE_TIERS.includes(next.origin.tier)
      ? next(e)
      : next.to(e, 'append'),
  ).catch(($, e, next) => Caught.pastUsersCaught(e, next))

  on('plugin.register', { tier: 'user' }, async ($, e, next) =>
    Policy.isManagedModsOnly(await $.settings.read(Policy.SOURCE))
      ? { refuse: managedModsOnlyRefusal(e.name) }
      : next(e),
  ).catch(($, e, next) =>
    Caught.admissionCaught(e, next, line => $.ui.log(line, { to: 'debug' })),
  )
}
