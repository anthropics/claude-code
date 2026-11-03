/**
 * The row's `entrypoint` field: the variable as the CLI or its host set it
 * when spelled like one (a short lowercase token), else `other`.
 *
 * @param variable CLAUDE_CODE_ENTRYPOINT as read; undefined stays so
 * @returns the field, or undefined
 */
export function entrypointOf(variable: string | undefined) {
  const isSpelled =
    variable === undefined || /^[a-z][a-z0-9_-]{0,39}$/.test(variable)

  return isSpelled ? variable : 'other'
}
