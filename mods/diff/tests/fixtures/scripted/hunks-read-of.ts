import { hunksAnswerOf } from './hunks-answer-of.js'
import { ok } from './ok.js'
import { oneAddedOf } from './one-added-of.js'

/**
 * A hunks read git answered for the given paths, in their order: in each
 * file one added line that names it.
 *
 * @param paths the changed files
 * @returns the run result
 */
export const hunksReadOf = (paths: readonly string[]) =>
  ok(hunksAnswerOf(paths.map(path => [path, oneAddedOf(`in ${path}`)])))
