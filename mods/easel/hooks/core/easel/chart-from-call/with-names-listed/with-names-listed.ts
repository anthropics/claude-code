import Json from '../../../json'

/**
 * One name in place of a list leaves no doubt: it is read as a list of one.
 *
 * @param cleaned The tool's input after cleaning.
 * @returns The same input, with a lone name under y or by made a list.
 */
export function withNamesListed(cleaned: unknown): unknown {
  const isRecord = Json.isRecord(cleaned)

  return isRecord
    ? {
        ...cleaned,
        ...(typeof cleaned.y === 'string' && { y: [cleaned.y] }),
        ...(typeof cleaned.by === 'string' && { by: [cleaned.by] }),
      }
    : cleaned
}
