import { QUOTING } from './text-of.js'

/**
 * A word that says a line sets a User-Agent: its name, in a header, a variable
 * or a script; a prefix of the flag, which the clients accept; or `UA=`.
 */
const USER_AGENT_WORD =
  /user[-_]?agent|[-\u2013-\u2015]-user-(?:a(?:g[a-z]*)?)?(?![a-z-])|[-\u2013-\u2015]usera(?:g[a-z]*)?(?![a-z])|\bua\s*[:=]/i

/**
 * A word that declares who is calling, other than a User-Agent. The site words
 * catch an address given by position, in forms a person's name or folder can't
 * take. Not `--email-identity=`, which looks one up.
 */
const IDENTITY_WORD =
  /set_identity|(?<!-)identity=|(?<![\w-])--identity(?![\w-])|\bmailto=|sec_edgar|edgartools|browse-edgar|\bfrom\s+edgar\s+import\b|\bimport\s+edgar\b|\bsec\.gov\b/i

/**
 * A `From` header given to a client by a flag, and not one in a mail's text.
 */
const FROM_FLAG =
  /(?:\s-[a-zA-Z]*H|--header)[\s=]*(?:["']\s*)?[Ff][Rr][Oo][Mm]\s*:/

/**
 * A quoted `From` key, which names a header only where the text also says
 * HEADERS: a mail API's body and `SetHeader("From", ...)` have one of their own.
 */
const FROM_KEY = /["']From\\*["']\s*[:=,]/
const HEADERS = /(?<![a-z])headers(?![a-z])/i

/**
 * A value read at run time that is the address: git's setting or variables. Not
 * `git config user.email <value>`, which release scripts run beside `git add -A`.
 */
const COMPUTED_ADDRESS =
  /\bgit\b[^\n]{0,40}\bconfig\b[^\n]{0,40}\buser\.email\b(?![ \t]+(?!\d?>)["'$\w])|\$(?:\{|env:)?GIT_(?:AUTHOR|COMMITTER)_EMAIL\b/i

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
 * The two ways an address is spelled in a text.
 *
 * @param email the account's address
 * @returns as it is, and with what the shell takes out of a line taken out
 */
function spellingsOf(email: string): string[] {
  return [email, email.replace(QUOTING, '')]
}

/**
 * Whether a text could be refused at all, asked before the session's address.
 *
 * @param text a call's text, from textOf
 * @returns whether it holds an `@`, or a value that stands for the address
 */
export function mayHoldAddress(text: string): boolean {
  return (
    text.includes('@') || text.includes('%40') || COMPUTED_ADDRESS.test(text)
  )
}

/**
 * Whether a text holds the account's address, in any case or percent-encoded.
 *
 * @param text a call's text, from textOf
 * @param email the account's address, if the session has one
 * @returns whether it does
 */
export function holdsAddress(
  text: string,
  email: string | undefined,
): boolean {
  if (email === undefined || email === '') {
    return false
  }

  const lowered = text.toLowerCase()
  const decoded = text
    .replace(/%([0-9a-fA-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, HEX_RADIX)),
    )
    .toLowerCase()

  return spellingsOf(email).some(spelling => {
    const address = spelling.toLowerCase()

    return lowered.includes(address) || decoded.includes(address)
  })
}

/**
 * Whether a text says it declares who is calling.
 *
 * @param text a text with no address in it to be taken for a word
 * @returns whether a word of the test is there
 */
function namesIdentity(text: string): boolean {
  return (
    USER_AGENT_WORD.test(text) ||
    IDENTITY_WORD.test(text) ||
    FROM_FLAG.test(text) ||
    (HEADERS.test(text) && FROM_KEY.test(text)) ||
    CLIENT_FLAGS.some(([client, flag]) => client.test(text) && flag.test(text))
  )
}

/**
 * Whether a text holds the account's address and says anywhere that it declares
 * who is calling, or reads the address at run time on a line that says so. Two
 * word matches, with no reading of the line.
 *
 * @param text a call's text, from textOf
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

  if (!holdsAddress(text, email)) {
    return text
      .split('\n')
      .some(line => COMPUTED_ADDRESS.test(line) && namesIdentity(line))
  }

  // The address is no word of these, though `jo@x.ua:` reads like `UA:`.
  return namesIdentity(
    text.replace(
      new RegExp(
        spellingsOf(email)
          .map(spelling => spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|'),
        'gi',
      ),
      ' ',
    ),
  )
}
