import { QUOTING } from './text-of.js'

/**
 * A word that says a line sets a User-Agent: its name, in a header, a variable
 * or a script; a prefix of the flag, which the clients accept; or `UA=`.
 */
const USER_AGENT_WORD =
  /user[-_]?agent|[-\u2013-\u2015]-user-(?:a(?:g[a-z]*)?)?(?![a-z-])|[-\u2013-\u2015]usera(?:g[a-z]*)?(?![a-z])|\bua\s*[:=]/i

/**
 * `-A`, `-U` and `-User` set a User-Agent only for these clients; Windows PowerShell
 * aliases `curl` and `wget` to Invoke-WebRequest. Not `X`: `-XPATCH` sets nothing.
 */
const CLIENT_FLAGS: readonly (readonly [RegExp, RegExp])[] = [
  [/\bcurl(?:ie)?\b/i, /\s[-\u2013-\u2015][a-zA-WYZ0-9#]*A/],
  [/\bwget2?\b/i, /\s[-\u2013-\u2015][a-zA-Z0-9]*U/],
  [
    /\b(?:curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b/i,
    /\s[-\u2013-\u2015]user(?![\w=-])/i,
  ],
]

/**
 * The base of a percent-encoded byte.
 */
const HEX_RADIX = 16

/**
 * Whether a shell call holds the account's address and names a User-Agent. Two
 * word matches, with no reading of the line.
 *
 * @param text the call's input, from textOf
 * @param email the account's address, if the session has one
 * @returns whether the call is refused
 */
export function namesUserAgentWithAddress(
  text: string,
  email: string | undefined,
): boolean {
  if (email === undefined || email === '') {
    return false
  }

  const spellings = [email, email.replace(QUOTING, '')]
  const lowered = text.toLowerCase()
  const decoded = text
    .replace(/%([0-9a-fA-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, HEX_RADIX)),
    )
    .toLowerCase()
  const holdsAddress = spellings.some(spelling => {
    const address = spelling.toLowerCase()

    return lowered.includes(address) || decoded.includes(address)
  })

  if (!holdsAddress) {
    return false
  }

  // The address is no User-Agent word, though `jo@x.ua:` reads like `UA:`.
  const rest = text.replace(
    new RegExp(
      spellings
        .map(spelling => spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
      'gi',
    ),
    ' ',
  )

  return (
    USER_AGENT_WORD.test(rest) ||
    CLIENT_FLAGS.some(([client, flag]) => client.test(rest) && flag.test(rest))
  )
}
