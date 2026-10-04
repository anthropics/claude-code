/**
 * One key's value in an os-release file, unquoted; undefined when the file
 * has no such line.
 *
 * @param content the file's text
 * @param key the key
 * @returns the value, or undefined
 */
export const osReleaseValue = (content: string, key: 'ID' | 'VERSION_ID') =>
  content
    .split('\n')
    .map(line => /^(ID|VERSION_ID)=(.*)$/.exec(line))
    .find(match => match?.[1] === key)?.[2]
    ?.replace(/^"|"$/g, '')
