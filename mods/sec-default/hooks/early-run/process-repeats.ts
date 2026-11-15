import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'
import { handedCalls } from './handed-calls.js'
import { nameOf } from './name-of.js'

// Given a script's file first, these hand what follows to that script as data.
const INTERPRETERS =
  /^(sh|bash|zsh|dash|ksh|fish|python|node|bun|deno|ruby|perl|php|osascript)$/
const WINDOWS_SHELLS = /^(pwsh|powershell|cmd)$/
const WRAPPERS =
  /^(wsl|env|sudo|doas|ssh|docker|podman|xargs|nohup|timeout|nice)$/
const NO_SCRIPT_FILE = /^(-|eval$|exec$)|^\/dev\/|(^|\/)(stdin|fd\/\d+)$/i

/**
 * The remembered calls a mod's process repeats: its argv is the command or
 * ends in it, or it hands a call's string whole to a wrapper, or to a shell
 * or an interpreter named anywhere in argv, in any letter case.
 *
 * @param remembered the calls that were not allowed
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
    // An item of several lines may be text that ends in a path, so nothing after it is let go as data.
    !/[\n\r\u2028\u2029]/.test(argv[at] ?? '') &&
    ![first, plainPath(first)].some(path => NO_SCRIPT_FILE.test(path))
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

  const folded = words.map(word => word.toLowerCase())

  return [
    ...remembered.flatMap(call => {
      const { tool, input, served = [] } = call
      const isShell = CODE_TOOLS.get(tool) === 'command'
      const command = isShell
        ? plainLine(String(input.command ?? '')).toLowerCase()
        : ''
      const isRepeat =
        command !== '' &&
        endsIn(folded, starts, command) &&
        !served
          .map(plainLine)
          .some(
            text =>
              text.toLowerCase().endsWith(command) &&
              endsIn(words, starts, text),
          )

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

// As it is spelled: no link is followed.
function plainPath(path: string): string {
  const kept: string[] = []

  for (const part of path.split('/')) {
    if (part === '..') {
      kept.pop()
    } else if (part !== '' && part !== '.') {
      kept.push(part)
    }
  }

  return (path.startsWith('/') ? '/' : '') + kept.join('/')
}

// A shell takes the quotes off and finds the program, so argv has neither.
const plainLine = (line: string): string =>
  line
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\S*[/\\]/, '')
