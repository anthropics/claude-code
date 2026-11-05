import type { On } from 'claude-code'

import Outbound from './outbound'

/**
 * Registers the hook: a shell call that holds the account's address and names a
 * User-Agent is refused, with no prompt. A deny beneath keeps its own reason.
 *
 * @param on the engine's registrar
 */
export function register(on: On): void {
  const tool = [...Outbound.SHELL_TOOLS, ...Outbound.INSTALLED_SHELL_TOOLS]

  on('tool.check', { tool }, async ($, e, next) => {
    const verdict = await next(e)

    if (verdict.decision === 'deny') {
      return verdict
    }

    const text = Outbound.textOf(e.input)

    if (!text.includes('@') && !text.includes('%40')) {
      return verdict
    }

    const { email } = await $.session.identity()

    return Outbound.namesUserAgentWithAddress(text, email)
      ? { decision: 'deny', reason: Outbound.REFUSAL }
      : verdict
  })
}
