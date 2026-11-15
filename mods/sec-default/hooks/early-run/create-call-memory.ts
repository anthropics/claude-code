import { bounded } from './bounded.js'
import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'
import { isSameCall } from './is-same-call.js'
import { isScript } from './is-script.js'
import { stringsOf } from './strings-of.js'
import { writtenPathOf } from './written-path-of.js'

const LIMIT = 256

interface Noted extends Call {
  /** Once its raise ended, one no later call carries: an allow under the same id is another input's. */
  id: string | symbol
  isAsSent: boolean
  /** The plugin whose `$.agent.call` it is, which it is not held against. */
  maker?: string
}

// The engine adds defaults and answers to its own tools' input, and reads numbers and flags off their text.
const holds = (ran: unknown, sent: unknown): boolean =>
  typeof sent === 'object' && sent !== null
    ? Object.entries(sent).every(([key, value]) =>
        holds(Object(ran)[key], value),
      )
    : String(ran) === String(sent)

/**
 * The inputs the model or a plugin's `$.agent.call` sent that were not allowed
 * yet, and scripts whether or not they were: each maker's newest 256 calls.
 *
 * @returns the memory: what it holds, and the moments that change it
 */
export function createCallMemory() {
  // The calls under way, each with the input it was allowed on once it was.
  const open = new Map<
    Noted['id'],
    Pick<Noted, 'tool' | 'input' | 'maker'> | undefined
  >()
  let noted: readonly Noted[] = []
  let isWatching = false

  function note(
    id: Noted['id'],
    whole: Call,
    isAsSent: boolean,
    maker?: string,
  ): void {
    // Kept whole, one input could fail or stall every later match.
    const call = bounded(whole)

    try {
      isSameCall(call, call)
    } catch {
      return
    }

    // The note taken at `agent.call` gives way to the same call beneath it.
    const given = noted.find(
      one =>
        isAsSent &&
        typeof id === 'string' &&
        typeof one.id === 'symbol' &&
        open.has(one.id) &&
        one.maker === maker &&
        isSameCall(one, call),
    )
    // A call the model repeats takes one place, so it does not push the others out.
    const all = [
      ...noted.filter(
        one =>
          one !== given &&
          ((open.has(one.id) && (one.id !== id || one.isAsSent !== isAsSent)) ||
            one.maker !== maker ||
            !isSameCall(one, call)),
      ),
      { ...call, id, isAsSent, maker },
    ]
    // Counted by maker, so a plugin's calls do not push the model's out.
    const ids = all.filter(one => one.maker === maker).map(one => one.id)
    const kept = new Set([...new Set(ids)].slice(-LIMIT))

    noted = all.filter(one => one.maker !== maker || kept.has(one.id))
  }

  /**
   * The call is allowed, in each form the engine told it, and so is each
   * earlier one like it. What the model sent before a rewrite took an argument
   * away or changed it is not. A plugin's allow reaches its own calls alone.
   */
  function allowed(id: string, whole: Call, maker?: string): void {
    const ran = bounded(whole)
    const path = writtenPathOf(ran)
    const isLike = (one: Noted) =>
      (maker === undefined || one.maker === maker || one.id === id) &&
      (path === undefined ? isSameCall(one, ran) : writtenPathOf(one) === path)
    const isComparable =
      path !== undefined ||
      CODE_TOOLS.has(ran.tool) ||
      ran.tool.startsWith('mcp__')
    const isRun = (one: Noted) =>
      isLike(one) ||
      (one.id === id && !isComparable && holds(ran.input, one.input))
    const spent = new Set(
      noted.filter(one => one.isAsSent && isRun(one)).map(one => one.id),
    )

    const isHeld = (one: Noted) =>
      !spent.has(one.id) && !isLike(one) && (one.id !== id || one.isAsSent)

    if (isScript(ran)) {
      noted = noted.map(one =>
        isHeld(one) ? one : { ...one, isAllowed: true },
      )

      return
    }

    noted = noted.filter(isHeld)

    if (open.has(id)) {
      open.set(id, { ...ran, maker })
    }
  }

  return {
    allowed,

    calls: (asker?: string): readonly Call[] =>
      noted.flatMap(one => {
        if (one.maker !== undefined && one.maker === asker) {
          return []
        }

        const key = CODE_TOOLS.get(one.tool)
        const runs = [...open.values()].filter(
          ran =>
            ran?.tool === one.tool &&
            (ran.maker === undefined || ran.maker === one.maker),
        )
        const at = (name = '') =>
          runs.flatMap(ran => stringsOf(ran?.input[name]))

        return key === undefined && runs.length > 0
          ? {
              ...one,
              servedAt: new Map(
                Object.keys(one.input).map(name => [name, at(name)]),
              ),
            }
          : { ...one, served: at(key) }
      }),

    /** At `tool.call`, which the engine raises here only beside a person's mod, and first as the model's call is whole. */
    sent(id: Noted['id'], call: Call, maker?: string) {
      isWatching = true
      open.set(id, undefined)
      note(id, call, true, maker)
    },

    /** At `tool.check`, raised in every session: a call heard shows that the rows which forget are too, and a seat once taken keeps them on. */
    checked(id: string, call: Call, maker?: string) {
      if (isWatching) {
        note(id, call, false, maker)
      }
    },

    /** The commands of the model's allowed calls under way. */
    served: (): readonly string[] =>
      [...open.values()].flatMap(ran =>
        ran && ran.maker === undefined && CODE_TOOLS.has(ran.tool)
          ? stringsOf(ran.input.command)
          : [],
      ),

    ended(id: Noted['id']) {
      const left = Symbol()
      open.delete(id)
      noted = noted.map(one => (one.id === id ? { ...one, id: left } : one))
    },

    /** At the person's prompt: a call still waiting for its answer stays. */
    prompted() {
      noted = noted.filter(one => open.has(one.id))
    },
  }
}
