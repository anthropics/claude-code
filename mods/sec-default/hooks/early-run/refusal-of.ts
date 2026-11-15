import type { EngineInterface } from 'claude-code'

import Policy from '../policy'
import type { Call } from './call.js'
import { earlyRunRefusal } from './early-run-refusal.js'
import { isScript } from './is-script.js'
import { SETTINGS_WRITE_REFUSAL } from './settings-write-refusal.js'

/**
 * Why a person's mod may not make an effect: it writes a settings file, or
 * repeats a remembered script, or a call the rules alone do not allow.
 *
 * Never rejects: a failure refuses what matched, and with no match nothing
 * is read. `allowModsToOverrideDenyRules` lifts both.
 *
 * @param $ the calling hook's
 * @param readPolicy the memoized policy read
 * @param repeated the remembered calls the effect repeats
 * @param isSettingsWrite whether it writes a settings file
 * @returns the refusal, or undefined where the effect passes
 */
export async function refusalOf(
  $: EngineInterface,
  readPolicy: ReturnType<typeof Policy.createPolicyMemo>,
  repeated: readonly Call[],
  isSettingsWrite = false,
): Promise<string | undefined> {
  const isHeld =
    (isSettingsWrite || repeated.length > 0) &&
    (await Policy.decidedByPolicy(
      readPolicy(() => $.settings.read(Policy.SOURCE)),
      Policy.denyRulesHold,
    ))

  if (!isHeld) {
    return undefined
  }

  if (isSettingsWrite) {
    return SETTINGS_WRITE_REFUSAL
  }

  for (const { tool, input } of repeated) {
    const verdict = isScript({ tool, input })
      ? undefined
      : await $.tool.check({ tool, input }).catch(() => undefined)

    if (verdict?.decision !== 'allow') {
      return earlyRunRefusal(tool)
    }
  }

  return undefined
}
