import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'
import { handedCalls } from './handed-calls.js'

// Given a script's file first, these hand what follows to that script as data.
const INTERPRETERS =
  /^(sh|bash|zsh|dash|ksh|fish|python|node|bun|deno|ruby|perl|php|osascript)$/
const WINDOWS_SHELLS = /^(pwsh|powershell|cmd)$/
const WRAPPERS =
  /^(wsl|env|sudo|doas|ssh|docker|podman|xargs|nohup|timeout|nice)$/

/**
 * The remembered calls a mod's process repeats: its argv is the command or
 * ends in it, or it hands a call's string whole to a wrapper, or to a shell
 * or an interpreter named anywhere in argv.
 *
 * @param remembered the model's calls that were not allowed
 * @param argv the process's argument vector
 * @param stdin what it is given to read
 * @returns the calls to ask the rules about
 */
export function processRepeats(
  remembered: readonly Call[],
  argv: readonly string[],
  stdin = '',
): Call[] {
  const names = argv.map(nameOf)
  const at = WRAPPERS.test(names[0] ?? '')
    ? 0
    : names.findIndex(
        name => INTERPRETERS.test(name) || WINDOWS_SHELLS.test(name),
      )
  const [first = '-', ...rest] = argv.slice(at + 1)
  const isScriptRun =
    INTERPRETERS.test(names[at] ?? '') &&
    !/^(-|\/dev\/|eval$|exec$)/.test(first)
  const words: string[] = []
  const starts = new Set<number>()

  for (const [index, item] of argv.entries()) {
    // One last item that holds the command is data to a program off the lists.
    if (index === 0 || index < argv.length - 1) {
      starts.add(words.length)
    }

    for (const word of item.replace(/['"]/g, '').match(/\S+/g) ?? []) {
      words.push(word)
    }
  }

  return [
    ...remembered.flatMap(call => {
      const { tool, input, served = [] } = call
      const isShell = CODE_TOOLS.get(tool) === 'command'
      const command = isShell ? plainLine(String(input.command ?? '')) : ''
      const isRepeat =
        command !== '' &&
        endsIn(words, starts, command) &&
        !served
          .map(plainLine)
          .some(text => text.endsWith(command) && endsIn(words, starts, text))

      const asked = tool.startsWith('mcp__')
        ? { tool: 'Bash', input: { command: input.command } }
        : call

      return isRepeat ? [asked] : []
    }),
    ...(at === -1
      ? []
      : handedCalls(
          remembered,
          isScriptRun ? [first] : [first, ...rest, stdin],
        )),
  ]
}

// Whether argv's words, from the start of one of its items on, are a plain line: read back from the end.
function endsIn(
  words: readonly string[],
  starts: ReadonlySet<number>,
  line: string,
): boolean {
  const from = words.length - line.split(' ').length

  return starts.has(from) && plainLine(words.slice(from).join(' ')) === line
}

const nameOf = (item: string): string =>
  item
    .replace(/^.*[/\\]/, '')
    .toLowerCase()
    .replace(/[\d.]*(\.exe)?$/, '')

// A shell takes the quotes off and finds the program, so argv has neither.
const plainLine = (line: string): string =>
  line
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\S*[/\\]/, '')
