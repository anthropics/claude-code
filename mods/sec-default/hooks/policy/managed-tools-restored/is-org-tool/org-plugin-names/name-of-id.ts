/**
 * The name half of a plugin id: everything before its LAST at-sign, as the
 * engine parts ids, so a scoped id (`@scope/name@npm`) keeps its scope.
 *
 * @param id a plugin id as policy lists it (`<name>@<marketplace>`)
 * @returns the name; the whole id where no at-sign follows a name
 */
export function nameOfId(id: string): string {
  const at = id.lastIndexOf('@')

  return at > 0 ? id.slice(0, at) : id
}
