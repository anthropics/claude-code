import Json from '../../core/json'

/**
 * A sum over all series comes back with no label, so only the call says what
 * was counted. The later names are what calls for Prometheus use.
 *
 * @param input the input of a call to another server's tool
 * @returns the query that the call sent, or no text
 */
export function queryOf(input: unknown): string {
  return (
    ['query', 'expr', 'query_expr']
      .flatMap(field => Json.valuesAt(input, field))
      .find(
        (query): query is string =>
          typeof query === 'string' && query.trim() !== '',
      ) ?? ''
  )
}
