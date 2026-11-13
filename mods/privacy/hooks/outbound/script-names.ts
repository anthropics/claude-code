import { POWERSHELL_TOOL } from './shell-tools.js'

/**
 * A file named on a line: by a script's extension, or as `./name` with none, so
 * not `./log.txt`. Whole words of a shell line, so not a URL's last part.
 */
const SCRIPT_NAME =
  /(?<![^\s"'`=(;&|<>])(?:[\w./\\-]*\.(?:py|sh|bash|zsh|js|mjs|cjs|ts|mts|cts|rb|pl|php|lua|ps1|go)|\.[/\\][\w/\\-]+)(?![^\s"'`);&|<>])/gi

/**
 * A name that starts at a root or climbs out of the working directory.
 */
const LEAVES_FOLDER = /^[/\\]|(?:^|[/\\])\.\.(?:[/\\]|$)/

/**
 * A command that git or gh runs, after any `VAR=value` assignments, up to `&`, `|`,
 * `;` or a newline, with what it holds past its line: a heredoc to its closing word,
 * and whole quotes. One never closed runs to the end, since a miss here costs less
 * than refusing a commit, and that keeps this linear.
 */
export const GIT_COMMAND =
  /(?<=^|[&;|\n])[ \t]*(?:\w+=[^\s&;|]*[ \t]+)*(?:git|gh)(?=\s|$)(?:<<-?[ \t]*["']?(\w+)[^]*?(?:\n[ \t]*\1(?:\n?[ \t]*\)"|[ \t\r]*(?=\n|$))|$)|[^\n"'\\<;|&]+|"(?=\$\(cat\s+<<)|"[^"\\]*(?:\\[^]?[^"\\]*)*(?:"|$)|'[^']*(?:'|$)|\\[^]?|<)*/g

/**
 * The first words of commands that only view, edit, move, check or test a file.
 */
const TOUCH_WORDS =
  'git|gh|cat|head|tail|wc|grep|rg|diff|ls|sed|mv|cp|rm|chmod|cd|mkdir|echo|ruff|black|isort|flake8|pylint|mypy|pyright|prettier|eslint|biome|tsc|shellcheck|shfmt|pytest|jest|vitest|mocha|bun test|gofmt|go (?:vet|test|fmt)|get-content|get-childitem|set-location|select-string|test-path|(?:move|remove|copy|rename)-item'

/**
 * A command that starts with a bare touch word, by GIT_COMMAND's own pattern, or is
 * one (`ls;`). An assignment before it is plain, so `MSG="a cat b"` starts none.
 */
const TOUCH_COMMAND = new RegExp(
  GIT_COMMAND.source
    .replace(String.raw`[^\s&;|]`, String.raw`[\w./:-]`)
    .replace(
      String.raw`(?:git|gh)(?=\s`,
      String.raw`(?:(?:python[\d.]* -m|uv run|npx|bunx) )?(?:${TOUCH_WORDS})(?=[\s;|&]`,
    ),
  'gi',
)

/**
 * What may run a command inside another, or hide where one ends: a substitution,
 * a here-string, a separator on a heredoc's opening line, a comment's quote or `<<`.
 */
const HIDES_A_COMMAND =
  /`|\$\((?!cat\s+<<)|[<>@]\(|<<(?:<|[^\n<]*[;|&])|(?<!\S)#[^\n#]*(?:(?<=\S)#[^\n#]*)*(?:['"]|<<)/

/**
 * A path's last backslash, which escapes nothing in PowerShell, so that
 * `cd .\out\; python fetch.py` holds two commands.
 */
const ENDS_A_PATH = /\\[;|&\n"]/

/**
 * How many files one line reads, since each read copies up to 4 MiB.
 */
const MOST_SCRIPTS = 8

/**
 * The files a shell line names that may run, by a word match and not a parser,
 * relative and inside the session's working directory. A name reached any other
 * way, such as after a `cd`, is not found, and holds nothing.
 *
 * @param text the line, from textOf
 * @returns the names, without repeats, at most MOST_SCRIPTS
 */
export function scriptNames(text: string): string[] {
  const names = new Set<string>()

  for (const [name] of text.matchAll(SCRIPT_NAME)) {
    if (!LEAVES_FOLDER.test(name)) {
      names.add(name)
    }

    if (names.size === MOST_SCRIPTS) {
      break
    }
  }

  return [...names]
}

/**
 * Whether every command of a shell line only touches files, so that it runs no
 * script. A number is left over from `2>&1`, and is no command.
 *
 * @param tool the shell tool's name
 * @param input the call's input, whose line is read as written
 * @returns whether the scripts it names go unread
 */
export function onlyTouches(tool: string, input: unknown): boolean {
  const line =
    typeof input === 'object' && input !== null && 'command' in input
      ? input.command
      : undefined

  return (
    typeof line === 'string' &&
    !HIDES_A_COMMAND.test(line) &&
    !(tool === POWERSHELL_TOOL && ENDS_A_PATH.test(line)) &&
    !/[^\s\d;&|]/.test(line.replace(TOUCH_COMMAND, ''))
  )
}
