import { ASK_CUT_NOTE } from './ask-cut-note'

/**
 * An armed ask's text as it fits in the room a prompt's context has left:
 * whole when it fits, else its first lines and ASK_CUT_NOTE.
 *
 * @param text the armed ask's text
 * @param room the characters the context has left
 * @returns the text to attach, or undefined when not even its first line fits
 */
export function fittedAskTextOf(
  text: string,
  room: number,
): string | undefined {
  if (text.length <= room) {
    return text
  }

  const kept: string[] = []

  let used = ASK_CUT_NOTE.length

  for (const line of text.split('\n')) {
    const cost = line.length + 1

    if (used + cost > room) {
      break
    }

    kept.push(line)
    used += cost
  }

  const hasBody = kept.length > 1

  return hasBody ? `${kept.join('\n')}\n${ASK_CUT_NOTE}` : undefined
}
