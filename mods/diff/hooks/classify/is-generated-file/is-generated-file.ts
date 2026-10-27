import { baseNameOf } from '../base-name-of'
import { rootedPathOf } from '../rooted-path-of'
import { GENERATED_DIRECTORIES } from './generated-directories'
import { GENERATED_FILENAME_PATTERNS } from './generated-filename-patterns'
import { GENERATED_FILENAMES } from './generated-filenames'
import { GENERATED_SUFFIXES } from './generated-suffixes'

/**
 * Whether a repository-relative path names generated or vendored content,
 * by the Linguist-style rules the engine's own diff panel applies.
 *
 * @param path the file's path from the repository root, `/`-separated
 * @returns whether the diff pane counts it among the tests and generated files
 */
export function isGeneratedFile(path: string) {
  const name = baseNameOf(path).toLowerCase()
  const rooted = rootedPathOf(path)

  const hasGeneratedSuffix = GENERATED_SUFFIXES.some(suffix =>
    name.endsWith(suffix),
  )

  return (
    GENERATED_FILENAMES.has(name) ||
    hasGeneratedSuffix ||
    GENERATED_DIRECTORIES.some(directory => rooted.includes(directory)) ||
    GENERATED_FILENAME_PATTERNS.some(pattern => pattern.test(name))
  )
}
