/**
 * The entries that mark a working directory as a version-control checkout,
 * each with the system it names, in the CLI's own order.
 */
export const VCS_MARKERS: readonly (readonly [string, string])[] = [
  ['.git', 'git'],
  ['.hg', 'mercurial'],
  ['.svn', 'svn'],
  ['.p4config', 'perforce'],
  ['$tf', 'tfs'],
  ['.tfvc', 'tfs'],
  ['.jj', 'jujutsu'],
  ['.sl', 'sapling'],
]
