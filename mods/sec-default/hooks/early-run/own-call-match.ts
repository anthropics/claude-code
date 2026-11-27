import type { EngineInterface } from 'claude-code'

import { bounded } from './bounded.js'
import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'
import type { FirstFolder } from './config-folders.js'
import type { createCallMemory } from './create-call-memory.js'
import { isSettingsFile } from './is-settings-file.js'
import { namesSettingsFile } from './names-settings-file.js'
import { fold, placed } from './placed.js'
import type { FileWrite } from './refusal-of.js'
import { stringsOf } from './strings-of.js'
import { toolRepeats } from './tool-repeats.js'
import { writeRepeats } from './write-repeats.js'
import { writtenPathOf } from './written-path-of.js'

/**
 * What a mod's own tool call matches, at `tool.call` and at `tool.judge` alike.
 * A write is looked at again at `tool.run`.
 *
 * @param $ the calling hook's
 * @param memory the remembered calls
 * @param first the config folder as it was first read
 * @param call the mod's call
 * @param asker the mod
 * @param by what makes the write, past `tool.call`; `take` where it may stand for a remove
 * @returns the remembered calls it repeats, whether it reaches a settings file,
 *          and for a Write or an Edit what refusalOf asks of the file
 */
export async function ownCallMatch(
  $: EngineInterface,
  memory: ReturnType<typeof createCallMemory>,
  first: FirstFolder,
  call: Call,
  asker: string,
  by?: 'tool' | 'fs' | 'take',
): Promise<{ repeated: Call[]; isSettings: boolean; write?: FileWrite }> {
  const own = bounded(call)
  const path = writtenPathOf(own, by && '')

  if (path !== undefined) {
    if (by && !(await isPlaced($, path, by === 'tool').catch(() => false))) {
      return { repeated: [], isSettings: true }
    }

    const remembered = memory.calls(asker)

    return {
      repeated: await writeRepeats($, remembered, path),
      isSettings: await isSettingsFile($, path, first, by === 'take'),
      ...(own.tool !== 'NotebookEdit' && { write: { path, first, remembered } }),
    }
  }

  return {
    repeated: toolRepeats(memory.calls(asker), own),
    isSettings:
      CODE_TOOLS.has(own.tool) &&
      (await namesSettingsFile($, stringsOf(own.input), memory.served())),
  }
}

async function isPlaced($: EngineInterface, path: string, isTool: boolean) {
  const look = async (at: string) =>
    (await $.fs.stat(at, { resolve: true })).realPath ?? ''
  const plain = /^(?!.*settings(.local)?.json$)(\/(?!\.\.?\/)[^/\\]+){1,32}$/isu
  const isPlain = plain.test(path) && plain.test(fold(path))
  const lands = (at: string, cut = at.lastIndexOf('/')): Promise<string> =>
    look(at).catch(async (error: Error) =>
      cut > 0 && (isPlain || at === path) && error.message.endsWith('ENOENT')
        ? `${await lands(at.slice(0, cut))}${at.slice(cut)}`
        : Promise.reject(error),
    )
  const real = await lands(path).catch(() => '')
  const here = await look('.').catch(() => '')

  return (
    (real === path && real && here && /[\p{L}\p{N}]$/u.test(path)) ||
    ((!isTool || (await $.session.info()).isHosted === false) &&
      (!real || (await placed($, real)) === (await placed($, path))))
  )
}
