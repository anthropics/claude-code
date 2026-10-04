/**
 * Whether a variable is set to anything at all, as the CLI's privacy level
 * reads DISABLE_TELEMETRY: any non-empty value counts, `0` included.
 *
 * @param value the variable as the environment holds it
 * @returns true for a non-empty value
 */
export const isEnvSet = (value: string | undefined) =>
  value !== undefined && value !== ''
