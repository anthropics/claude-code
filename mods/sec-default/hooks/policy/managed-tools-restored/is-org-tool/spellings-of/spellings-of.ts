/**
 * How the engine spells a server's name inside its tools' names: every
 * character that is not a letter, digit, `_` or `-` becomes `_`.
 *
 * A claude.ai connector's runs of `_` are also joined and trimmed, so both
 * spellings are answered; one that comes out empty is left out.
 *
 * @param server the server's name as the policy spells it
 * @returns the spellings, without repeats
 */
export function spellingsOf(server: string): string[] {
  const spelt = server.replace(/[^a-zA-Z0-9_-]/g, '_')
  const joined = spelt.replace(/_+/g, '_').replace(/^_|_$/g, '')

  return [...new Set([spelt, joined])].filter(one => one !== '')
}
