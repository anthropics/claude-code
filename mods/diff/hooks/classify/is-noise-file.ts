import { isGeneratedFile } from './is-generated-file'
import { isTestFile } from './is-test-file'

/**
 * Whether a changed file is hidden behind the pane's tests-and-generated
 * line until the person asks to see it.
 *
 * @param path the file's path from the repository root
 * @returns whether it is a test or a generated file
 */
export const isNoiseFile = (path: string) =>
  isTestFile(path) || isGeneratedFile(path)
