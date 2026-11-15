import { bounded } from './bounded.js'
import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'
import { isSameCall } from './is-same-call.js'
import { isScript } from './is-script.js'
import { stringsOf } from './strings-of.js'
import { writtenPathOf } from './written-path-of.js'

const LIMIT = 256

interface Noted extends Call {
  id: string
  isAsSent: boolean
}

// The engine adds defaults and answers to its own tools' input, and reads numbers and flags off their text.
const holds = (ran: unknown, sent: unknown): boolean =>
  typeof sent === 'object' && sent !== null
    ? Object.entries(sent).every(([key, value]) =>
        holds(Object(ran)[key], value),
      )
    : String(ran) === String(sent)

/**
 * The inputs the model sent that were not allowed yet, and its scripts whether
 * or not they were: those of the newest 256 calls.
 *
 * @returns the memory: what it holds, and the moments that change it
 */
export function createCallMemory() {
  // The calls under way, each with the input it was allowed on once it was.
  const open = new Map<string, Call | undefined>()
  let noted: readonly Noted[] = []
  let isWatching = false

  function note(id: string, whole: Call, isAsSent: boolean): void {
    // Kept whole, one input could fail or stall every later match.
    const call = bounded(whole)

    try {
      isSameCall(call, call)
    } catch {
      return
    }

    // A call the model repeats takes one place, so it does not push the others out.
    const all = [
      ...noted.filter(one => open.has(one.id) || !isSameCall(one, call)),
      { ...call, id, isAsSent },
    ]
    const kept = new Set([...new Set(all.map(one => one.id))].slice(-LIMIT))

    noted = all.filter(one => kept.has(one.id))
  }

  /**
   * The call is allowed, and so is each earlier one like it. What the model
   * sent before a rewrite took an argument away or changed it is not.
   */
  function allowed(id: string, whole: Call): void {
    const ran = bounded(whole)
    const path = writtenPathOf(ran)
    const isLike = (one: Noted) =>
      path === undefined ? isSameCall(one, ran) : writtenPathOf(one) === path
    const spent = new Set(
      noted.filter(one => one.isAsSent && isLike(one)).map(one => one.id),
    )
    const isComparable =
      path !== undefined ||
      CODE_TOOLS.has(ran.tool) ||
      ran.tool.startsWith('mcp__')

    const isHeld = (one: Noted) =>
      !spent.has(one.id) &&
      !isLike(one) &&
      (one.id !== id ||
        (one.isAsSent && (isComparable || !holds(ran.input, one.input))))

    if (isScript(ran)) {
      noted = noted.map(one =>
        isHeld(one) ? one : { ...one, isAllowed: true },
      )

      return
    }

    noted = noted.filter(isHeld)

    if (open.has(id)) {
      open.set(id, ran)
    }
  }

  return {
    allowed,

    calls: (): readonly Call[] =>
      noted.map(one => {
        const key = CODE_TOOLS.get(one.tool)
        const served = [...open.values()]
          .filter(ran => ran?.tool === one.tool)
          .flatMap(ran => stringsOf(key ? ran?.input[key] : ran?.input))

        return { ...one, served }
      }),

    /** At `tool.call`, which the engine raises here only beside a person's mod. */
    sent(id: string, call: Call) {
      isWatching = true
      open.set(id, undefined)
      note(id, call, true)
    },

    /** At `tool.check`, raised in every session: a call heard shows that the rows which forget are too, and a seat once taken keeps them on. */
    checked(id: string, call: Call) {
      if (isWatching) {
        note(id, call, false)
      }
    },

    /** The commands of the allowed calls under way. */
    served: (): readonly string[] =>
      [...open.values()].flatMap(ran =>
        ran && CODE_TOOLS.has(ran.tool) ? stringsOf(ran.input.command) : [],
      ),

    ended(id: string) {
      open.delete(id)
    },

    /** At the person's prompt: a call still waiting for its answer stays. */
    prompted() {
      noted = noted.filter(one => open.has(one.id))
    },
  }
}
