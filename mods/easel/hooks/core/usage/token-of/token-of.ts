/**
 * A source as one word for telemetry.
 *
 * @param source a source that a table carries
 * @returns it in lower case, with underscores for its spaces
 */
export const tokenOf = (source: string): string =>
  source.toLowerCase().replaceAll(' ', '_')
