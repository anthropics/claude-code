/**
 * Whether a variable reads as on, as the CLI reads its boolean switches:
 * `1`, `true`, `yes` or `on`, in any case, spaces around it ignored.
 *
 * @param value the variable as the environment holds it
 * @returns true for one of the four spellings
 */
export const isEnvTruthy = (value: string | undefined) =>
  ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase())
