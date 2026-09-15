/**
 * One git invocation named by what it asks: its subcommand, and its kind.
 *
 * For a `diff` what kind (`--shortstat`, `--numstat`, or the path its body
 * is asked for), for a `rev-parse` whether it finds the repository
 * (`--show-toplevel`) or reads `HEAD` (the poll's fallback where no file
 * answers), so a test reads a session's spawns as the built-in's list.
 *
 * @param argv the invocation, program first, any pinned lead after it
 * @returns `rev-parse --show-toplevel`, `status`, `diff --numstat`, ...
 */
export function gitWordOf(argv: readonly string[]) {
  const [subcommand = '?'] = argv.filter(
    (word, at) => at > 0 && !word.startsWith('-') && argv[at - 1] !== '-c',
  )

  const dashes = argv.indexOf('--')

  if (subcommand === 'rev-parse') {
    return argv.includes('--show-toplevel')
      ? 'rev-parse --show-toplevel'
      : 'rev-parse HEAD'
  }

  if (subcommand !== 'diff') {
    return subcommand
  }

  if (dashes !== -1) {
    return `diff -- ${argv.slice(dashes + 1).join(' ')}`
  }

  const stat = argv.find(word => word === '--shortstat' || word === '--numstat')

  return stat ? `diff ${stat}` : 'diff'
}
