import Json from '../../json'
import Texts from '../../texts'
import Words from '../words'

/**
 * A record of labels gives an entry per label, one text a single entry
 * named by where it was found. `*` is how Datadog writes "no scope".
 *
 * @param node one series, or one field of a frame
 * @param path where its labels are, as `valuesAt` reads it
 * @returns the label entries, none when nothing is there
 */
export function entriesAt(
  node: unknown,
  path: string,
): Array<[string, unknown]> {
  const [found] = Json.valuesAt(node, path)
  const isLabelRecord = Json.isRecord(found)
  const isAbsent = found === undefined || found === Words.NO_SCOPE

  return isLabelRecord
    ? Object.entries(found).map(([name, value]) => [
        name,
        typeof value === 'string' ? Texts.cleanLabel(value) : value,
      ])
    : isAbsent
      ? []
      : [[path, Texts.cleanLabel(String(found))]]
}
