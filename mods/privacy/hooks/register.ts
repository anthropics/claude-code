import type { On } from 'claude-code'

import Outbound from './outbound'

/**
 * Registers the hook: a call whose outgoing text, or a script its line names,
 * holds the account's address beside a word that declares who is calling, or a
 * fetch with the address in its URL, is refused, with no prompt. A line that only
 * touches files reads no script. A deny beneath keeps its own reason.
 *
 * @param on the engine's registrar
 */
export function register(on: On): void {
  const shells = [...Outbound.SHELL_TOOLS, ...Outbound.INSTALLED_SHELL_TOOLS]
  const tool = [...shells, ...Outbound.FIELD_TOOLS, Outbound.MCP_TOOL]

  on('tool.check', { tool }, async ($, e, next) => {
    const verdict = await next(e)

    if (verdict.decision === 'deny') {
      return verdict
    }

    const text = Outbound.outgoingText(e.tool, e.input)
    // The line that runs, not a field that only talks about it, such as `description`.
    // An installed shell tool's fields are its own, so its whole input.
    const line = !Outbound.SHELL_TOOLS.includes(e.tool)
      ? text
      : Outbound.onlyTouches(e.tool, e.input)
        ? ''
        : Outbound.fieldText(e.input, 'command', Outbound.GIT_COMMAND)
    const scripts = shells.includes(e.tool) ? Outbound.scriptNames(line) : []

    if (scripts.length === 0 && !Outbound.mayHoldAddress(text)) {
      return verdict
    }

    const { email } = await $.session.identity()

    if (email === undefined) {
      return verdict
    }

    // This runs before any approval, so it opens only a plain file its walk found
    // free of links. One it can't read holds nothing: nobody can answer a refusal.
    const isRefused =
      Outbound.isRefused(e.tool, e.input, email) ||
      (
        await Promise.all(
          scripts.map(async name => {
            try {
              let path = '.'
              let isFile = false

              for (const part of name
                .split(/[/\\]+/)
                .filter(one => one !== '' && one !== '.')) {
                const entry = (await $.fs.list(path)).find(
                  one => one.name === part,
                )

                if (entry === undefined || entry.isLink) {
                  return ''
                }

                path = `${path}/${part}`
                isFile = entry.kind === 'file'
              }

              return isFile ? await $.fs.read(path) : ''
            } catch {
              return ''
            }
          }),
        )
      ).some(script =>
        Outbound.namesUserAgentWithAddress(Outbound.textOf(script), email),
      )

    return isRefused ? { decision: 'deny', reason: Outbound.REFUSAL } : verdict
  })
}
