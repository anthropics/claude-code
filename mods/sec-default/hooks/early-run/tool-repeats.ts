import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'
import { handedCalls } from './handed-calls.js'
import { isSameCall } from './is-same-call.js'
import { stringsOf } from './strings-of.js'

/**
 * The remembered calls a mod's own tool call repeats: the same call, or one
 * whose string it hands whole to a tool that runs a command or a script.
 *
 * @param remembered the calls that were not allowed
 * @param own the mod's call
 * @returns the calls to ask the rules about
 */
export const toolRepeats = (remembered: readonly Call[], own: Call): Call[] => [
  ...remembered.filter(call => isSameCall(call, own)),
  ...handedCalls(
    remembered,
    CODE_TOOLS.has(own.tool) ? stringsOf(own.input) : [],
    own.tool,
  ),
]
