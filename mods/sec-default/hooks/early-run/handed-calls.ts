import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'
import { isScript } from './is-script.js'
import { stringsOf } from './strings-of.js'

/**
 * The remembered calls one of whose strings stands whole in a text that is
 * about to be run, each as the rules are asked about it.
 *
 * A command or a script counts, and a string of an `mcp__` tool, which is
 * asked about as Bash unless handed to that same tool: its single word, or a
 * script that is one bare name, only as the whole text. Of another tool's, a
 * path or a single word is no text to run. A string inside a longer word is
 * not that string, and a run of whitespace is one space. Letter case folds.
 *
 * @param remembered the calls that were not allowed
 * @param texts what a shell, an interpreter or a wrapper is handed
 * @param into the tool that is handed them, where it is one
 * @returns the calls to ask about
 */
export const handedCalls = (
  remembered: readonly Call[],
  texts: readonly string[],
  into?: string,
): Call[] => {
  const spelled = new Set(texts.map(text => text.trim()))
  const everything = linesOf([...spelled])

  return remembered.flatMap(call => {
    const key = CODE_TOOLS.get(call.tool)
    const isMcp = call.tool.startsWith('mcp__')
    const isBare = (value: string) => isScript(call) && /^[\w.]+$/.test(value)
    const lessServed = (texts: readonly string[] = []): Lines => {
      // As they are spelled: a line break that reads as a space starts another command.
      const served = texts.map(text => text.trim())

      return served.some(text => spelled.has(text))
        ? linesOf([...spelled].filter(one => !served.includes(one)))
        : everything
    }
    const shared = lessServed(call.served)
    const held = Object.entries(call.input)
      .filter(([name]) =>
        key === undefined ? isMcp || !name.endsWith('path') : name === key,
      )
      .flatMap(([name, argument]) => {
        const { whole, all } = call.servedAt
          ? lessServed(call.servedAt.get(name))
          : shared

        return stringsOf(argument)
          .map(value => value.trim())
          .filter(value => value !== '')
          .filter(value => {
            const line = spaced(value)

            return (key === undefined ? line.includes(' ') : !isBare(value))
              ? holdsWhole(all, line)
              : (isMcp || key !== undefined) && whole.has(value.toLowerCase())
          })
      })

    return isMcp && call.tool !== into
      ? held.map(command => ({ tool: 'Bash', input: { command } }))
      : held.slice(0, 1).map(() => call)
  })
}

const spaced = (text: string): string =>
  text.replace(/\s+/g, ' ').trim().toLowerCase()

type Lines = { whole: ReadonlySet<string>; all: string }

function linesOf(texts: readonly string[]): Lines {
  const lines = texts.map(spaced)

  return { whole: new Set(lines), all: lines.join('\n') }
}

function holdsWhole(text: string, value: string): boolean {
  const isJoined = (before = '', after = '') => /^\w\w$/.test(before + after)

  for (
    let at = text.indexOf(value);
    at !== -1;
    at = text.indexOf(value, at + 1)
  ) {
    const isWhole =
      !isJoined(text[at - 1], value[0]) &&
      !isJoined(value.at(-1), text[at + value.length])

    if (isWhole) {
      return true
    }
  }

  return false
}
