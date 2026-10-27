import type Git from '../git'
import Limits from '../limits'
import type { ArmedAsk } from './armed-ask'

/**
 * A file's diff as the context block the next prompt carries when the
 * person presses ask.
 *
 * A line saying where it came from, then the hunks in unified form, cut at
 * MAX_LINES_PER_FILE lines.
 *
 * @param path the file's repository-relative path
 * @param hunks its hunks as the pane shows them
 * @returns the armed ask
 */
export function armedAskOf(path: string, hunks: readonly Git.Hunk[]): ArmedAsk {
  const body = hunks
    .flatMap(hunk => [
      `@@ -${hunk.oldStart} +${hunk.newStart} @@`,
      ...hunk.lines,
    ])
    .slice(0, Limits.MAX_LINES_PER_FILE)

  return {
    path,
    text:
      `The user attached the diff of ${path} from the diff pane to this ` +
      `prompt:\n${body.join('\n')}`,
    lines: body.length,
  }
}
