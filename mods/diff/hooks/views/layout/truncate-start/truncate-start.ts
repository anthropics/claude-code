import { chargedWidth } from '../charged-width'

/**
 * A path cut from its start to fit, an ellipsis standing for what went, so
 * the file name survives, as the engine truncates a path from its start.
 *
 * It counts by chargedWidth, a cell at least per code point, so a name
 * padded with combining marks is cut like any other and never passes the
 * room whole.
 *
 * @param text the path
 * @param cells the room
 * @returns the path, or `…` and its tail
 */
export function truncateStart(text: string, cells: number) {
  if (chargedWidth(text) <= cells) {
    return text
  }

  const characters = [...text]

  let kept = ''

  for (let at = characters.length - 1; at >= 0; at--) {
    const candidate = `${characters[at]}${kept}`

    if (chargedWidth(candidate) + 1 > cells) {
      break
    }

    kept = candidate
  }

  return `…${kept}`
}
