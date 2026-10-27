/**
 * A `/`-separated path's last segment: the file's own name.
 *
 * @param path the repository-relative path
 * @returns the base name
 */
export const baseNameOf = (path: string) => path.split('/').at(-1) ?? path
