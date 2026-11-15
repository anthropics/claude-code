/**
 * The program an argv item names: lower case, without its folder, its version
 * number and one `.exe`.
 *
 * @param item one item of a process's argument vector
 * @returns the name to look up
 */
export function nameOf(item: string): string {
  const name = item
    .replace(/^.*[/\\]/s, '')
    .toLowerCase()
    .replace(/\.exe$/, '')
  let end = name.length

  // Back from the end: a pattern for the run would read it again from each of its characters.
  while (/[\d.]/.test(name.charAt(end - 1))) {
    end--
  }

  return name.slice(0, end)
}
