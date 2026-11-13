import { holdsAddress, namesUserAgentWithAddress } from './names-user-agent.js'
import { textOf } from './text-of.js'

const WEB_FETCH_TOOL = 'WebFetch'
const EDIT_TOOL = 'Edit'

/**
 * The tools of which one field is what goes out: what a file tool writes, not
 * its path or the text it replaces, and the URL a fetch asks for, not its prompt.
 */
const OUTGOING_FIELDS: ReadonlyMap<string, string> = new Map([
  ['Write', 'content'],
  [EDIT_TOOL, 'new_string'],
  ['NotebookEdit', 'new_source'],
  [WEB_FETCH_TOOL, 'url'],
])

/**
 * The tools this guard reads by one field.
 */
export const FIELD_TOOLS: readonly string[] = [...OUTGOING_FIELDS.keys()]

/**
 * An MCP tool's name, which this guard reads with its whole input.
 */
export const MCP_TOOL = /^mcp__/

/**
 * One field of a tool call's input.
 *
 * @param input the tool call's input
 * @param field the field's name
 * @param without what to take out of it first, if it is a string
 * @returns its text, from textOf, empty if the input lacks it
 */
export function fieldText(
  input: unknown,
  field: string,
  without?: RegExp,
): string {
  const value =
    typeof input === 'object' && input !== null
      ? Object.entries(input).find(([key]) => key === field)?.[1]
      : undefined

  return textOf(
    without !== undefined && typeof value === 'string'
      ? value.replace(without, ' ')
      : value,
  )
}

/**
 * The text of a call that the tests read: the outgoing field of a tool that has
 * one, and any other tool's whole input.
 *
 * @param tool the tool's name
 * @param input the tool call's input
 * @returns the text, from textOf
 */
export function outgoingText(tool: string, input: unknown): string {
  const field = OUTGOING_FIELDS.get(tool)

  return field === undefined ? textOf(input) : fieldText(input, field)
}

/**
 * Whether a call's own input is refused. A URL goes out by itself, so the
 * address in a fetch's needs no second word. An Edit that carries over a line
 * the file already holds adds nothing, and the person's own contact is theirs.
 *
 * @param tool the tool's name
 * @param input the tool call's input
 * @param email the account's address, if the session has one
 * @returns whether the call is refused
 */
export function isRefused(
  tool: string,
  input: unknown,
  email: string | undefined,
): boolean {
  const text = outgoingText(tool, input)

  if (tool === WEB_FETCH_TOOL) {
    return holdsAddress(text, email)
  }

  return (
    namesUserAgentWithAddress(text, email) &&
    !(
      tool === EDIT_TOOL &&
      namesUserAgentWithAddress(fieldText(input, 'old_string'), email)
    )
  )
}
