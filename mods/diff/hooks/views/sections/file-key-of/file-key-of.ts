import type { BodyEntry } from '../../entries'
import Layout from '../../layout'

/**
 * A file row's Button address: the path made printable, under `file:`.
 *
 * @param entry the file, its path as git or the transcript gave it
 * @returns the key
 */
export const fileKeyOf = (entry: Pick<BodyEntry, 'path'>) =>
  `file:${Layout.sanitizeName(entry.path)}`
