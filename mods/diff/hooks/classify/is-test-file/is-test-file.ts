import { baseNameOf } from '../base-name-of'
import { rootedPathOf } from '../rooted-path-of'
import { TEST_DIRECTORIES } from './test-directories'
import { TEST_FILENAME_PATTERNS } from './test-filename-patterns'

/**
 * Whether a repository-relative path is a test, spec, fixture or snapshot,
 * by the same rules the engine's own diff panel applies.
 *
 * @param path the file's path from the repository root, `/`-separated
 * @returns whether the diff pane counts it among the tests and generated files
 */
export function isTestFile(path: string) {
  const name = baseNameOf(path)
  const rooted = rootedPathOf(path)

  return (
    TEST_DIRECTORIES.some(directory => rooted.includes(directory)) ||
    TEST_FILENAME_PATTERNS.some(pattern => pattern.test(name))
  )
}
