import type { EngineInterface } from 'claude-code'

import { bounded } from './bounded.js'
import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'
import type { FirstFolder } from './config-folders.js'
import type { createCallMemory } from './create-call-memory.js'
import { isSettingsFile } from './is-settings-file.js'
import { namesSettingsFile } from './names-settings-file.js'
import { stringsOf } from './strings-of.js'
import { toolRepeats } from './tool-repeats.js'
import { writeRepeats } from './write-repeats.js'
import { writtenPathOf } from './written-path-of.js'

/**
 * What a mod's own tool call matches, at `tool.call` and at `tool.judge` alike.
 *
 * @param $ the calling hook's
 * @param memory the remembered calls
 * @param first the config folder as it was first read
 * @param call the mod's call
 * @param asker the mod
 * @returns the remembered calls it repeats, and whether it reaches a settings file
 */
export async function ownCallMatch(
  $: EngineInterface,
  memory: ReturnType<typeof createCallMemory>,
  first: FirstFolder,
  call: Call,
  asker: string,
): Promise<{ repeated: Call[]; isSettings: boolean }> {
  const own = bounded(call)
  const path = writtenPathOf(own)

  if (path !== undefined) {
    return {
      repeated: await writeRepeats($, memory.calls(asker), path),
      isSettings: await isSettingsFile($, path, first),
    }
  }

  return {
    repeated: toolRepeats(memory.calls(asker), own),
    isSettings:
      CODE_TOOLS.has(own.tool) &&
      (await namesSettingsFile($, stringsOf(own.input), memory.served())),
  }
}
