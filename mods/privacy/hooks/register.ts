import type { On } from 'claude-code'

import Outbound from './outbound'

/**
 * Registers the hooks. At `tool.check`, a call whose outgoing text, or a script
 * its line names, holds the account's address beside a word that declares who is
 * calling, or a fetch with the address in its URL, is refused, with no prompt. A
 * line that only touches files reads no script. A deny beneath keeps its reason.
 *
 * At `session.identity`, a `user`-tier caller is refused, and the address the
 * context hands the model is left off the answer of a caller outside `builtin`.
 *
 * @param on the engine's registrar
 */
export function register(on: On): void {
  const shells = [...Outbound.SHELL_TOOLS, ...Outbound.INSTALLED_SHELL_TOOLS]
  const tool = [...shells, ...Outbound.FIELD_TOOLS, Outbound.MCP_TOOL]

  on('tool.check', { tool }, async ($, e, next) => {
    const verdict = await next(e)

    // A refused settings hook is skipped, and what it guards goes on unjudged.
    if (verdict.decision === 'deny' || next.origin.hookOwner !== undefined) {
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

    const identity = await $.session.identity()
    const email = identity.contextEmail ?? identity.email

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

  // No call on `$` here: a hook that call reached would run with this one left out.
  // A refusal is a value, so that the call resolves with `deny` and never rejects.
  on('session.identity', async ($, e, next) => {
    if (next.origin.tier === 'user') {
      return {
        value: {
          deny:
            '$.session.identity answers only a mod that managed settings ' +
            'enable and that is loaded in place from a source they name; ' +
            `${next.origin.plugin} is not one`,
        },
      }
    }

    const answer = await next(e)

    if (
      next.origin.tier === 'builtin' ||
      answer.value?.contextEmail === undefined
    ) {
      return answer
    }

    const { contextEmail: _handed, ...rest } = answer.value

    return { value: rest }
  }).catch(() => ({ value: { deny: 'privacy could not read the identity' } }))
}
