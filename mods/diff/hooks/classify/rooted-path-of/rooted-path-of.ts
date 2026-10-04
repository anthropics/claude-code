/**
 * A path with exactly one leading `/`, so a directory pattern like `/test/`
 * matches at the start of a relative path too.
 *
 * @param path the repository-relative path
 * @returns the rooted path
 */
export const rootedPathOf = (path: string) => `/${path.replace(/^\/+/, '')}`
