import type Git from '../../git'

/**
 * The file bodies the pane has read, by path: the parsed hunks, or null
 * where the backend could not read them; a path not in it is still loading.
 */
export type Bodies = ReadonlyMap<string, Git.FileHunks | null>
