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
 * A command that git runs, after any `VAR=value` assignments, up to `&`, `|`, `;`
 * or a newline, with what it holds past its line: a heredoc to its closing word,
 * and whole quotes. One never closed runs to the end, since a miss here costs less
 * than refusing a commit, and that keeps this linear.
 */
export const GIT_COMMAND =
  /(?<=^|[&;|\n])[ \t]*(?:\w+=[^\s&;|]*[ \t]+)*git(?=\s|$)(?:<<-?[ \t]*["']?(\w+)[^]*?(?:\n[ \t]*\1(?:\n?[ \t]*\)"|[ \t\r]*(?=\n|$))|$)|[^\n"'\\<;|&]+|"(?=\$\(cat\s+<<)|"[^"\\]*(?:\\[^]?[^"\\]*)*(?:"|$)|'[^']*(?:'|$)|\\[^]?|<)*/g

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
