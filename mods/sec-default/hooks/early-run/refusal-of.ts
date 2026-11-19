import type { EngineInterface } from 'claude-code'

import Policy from '../policy'
import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'
import type { FirstFolder } from './config-folders.js'
import { earlyRunRefusal } from './early-run-refusal.js'
import { isScript } from './is-script.js'
import { isUserSettingsFile } from './is-user-settings-file.js'
import { namesSettingsFile } from './names-settings-file.js'
import { SETTINGS_WRITE_REFUSAL } from './settings-write-refusal.js'
import { stringsOf } from './strings-of.js'
import { writtenPathOf } from './written-path-of.js'

/** A mod's write of one file, beside the calls that were not allowed. */
export type FileWrite = {
  path: string
  first: FirstFolder
  remembered: readonly Call[]
}

/**
 * Why a person's mod may not make an effect: it writes a settings file, or
 * repeats a remembered script, or a call the rules alone do not allow.
 *
 * Never rejects: a failure refuses what matched, and with no match nothing
 * is read. `allowModsToOverrideDenyRules` lifts both. `allowModsToWriteUserSettings`
 * lifts the first for a write of the user settings file, which then repeats
 * each remembered call that names a settings file and is not allowed.
 *
 * @param $ the calling hook's
 * @param readPolicy the memoized policy read
 * @param repeated the remembered calls the effect repeats
 * @param isSettingsWrite whether it writes a settings file
 * @param write the file, where the effect is a `$.fs.write`, a Write or an Edit
 * @returns the refusal, or undefined where the effect passes
 */
export async function refusalOf(
  $: EngineInterface,
  readPolicy: ReturnType<typeof Policy.createPolicyMemo>,
  repeated: readonly Call[],
  isSettingsWrite = false,
  write?: FileWrite,
): Promise<string | undefined> {
  const holds = (decide: typeof Policy.denyRulesHold) =>
    Policy.decidedByPolicy(
      readPolicy(() => $.settings.read(Policy.SOURCE)),
      decide,
    )
  const isHeld =
    (isSettingsWrite || repeated.length > 0) &&
    (await holds(Policy.denyRulesHold))

  if (!isHeld) {
    return undefined
  }

  const asked = [...repeated]

  if (isSettingsWrite) {
    const isTheirs =
      write !== undefined &&
      !(await holds(Policy.userSettingsHold)) &&
      (await isUserSettingsFile($, write.path, write.first))

    if (!isTheirs) {
      return SETTINGS_WRITE_REFUSAL
    }

    for (const call of write.remembered) {
      const key = CODE_TOOLS.get(call.tool)
      const texts = stringsOf(key ? call.input[key] : writtenPathOf(call))

      if (
        !call.isAllowed &&
        (await namesSettingsFile($, texts, call.served ?? []))
      ) {
        asked.push(call)
      }
    }
  }

  for (const { tool, input } of asked) {
    const verdict = isScript({ tool, input })
      ? undefined
      : await $.tool.check({ tool, input }).catch(() => undefined)

    if (verdict?.decision !== 'allow') {
      return earlyRunRefusal(tool)
    }
  }

  return undefined
}
