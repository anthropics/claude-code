import Layout from '../../layout'

/**
 * A file's ask Button address: the path made printable, under `ask:`, so
 * each file's Button in the body has its own.
 *
 * @param path the file's path as git or the transcript gave it
 * @returns the key
 */
export const askKeyOf = (path: string) => `ask:${Layout.sanitizeName(path)}`
