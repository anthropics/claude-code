import type { Host } from '../host'
import Limits from '../limits'
import { messageOf } from '../message-of'
import type { ReadVerdict } from './read-verdict.js'
import { withinTime } from './within-time.js'

const NO_TOOL = /\$\.tool\.check: no tool named "\w+" in this session/
const PATH_RULE = /^Read\(/
const TOOLS = ['Read', 'Grep', 'Glob'] as const

/**
 * The engine's word on reading each path, each asked once, CHECKS_AT_ONCE
 * at a time, for CHECK_TIMEOUT_MS in all. Where Read does not say, a search
 * tool is asked, as the same rules hold for it.
 *
 * @param engine the bound host
 * @param paths the paths, repeats allowed
 * @returns the verdict of any path, `unknown` for one not answered
 */
export async function readVerdictsOf(
  engine: Pick<Host, 'after' | 'checkRead'>,
  paths: readonly string[],
): Promise<(path: string) => ReadVerdict> {
  const waiting = [...new Set(paths)]
  const answered = new Map<string, ReadVerdict>()

  async function verdictOf(path: string): Promise<ReadVerdict> {
    for (const tool of TOOLS) {
      try {
        const { decision, rule } = await engine.checkRead(tool, path)

        if (decision === 'allow' || decision === 'ask') {
          return tool === 'Read' ? 'open' : 'closed'
        }

        if (PATH_RULE.test(rule ?? '')) {
          return 'denied'
        }
      } catch (error) {
        if (!NO_TOOL.test(messageOf(error))) {
          return 'unknown'
        }
      }
    }

    return 'untold'
  }

  async function drain() {
    for (
      let path = waiting.shift();
      path !== undefined;
      path = waiting.shift()
    ) {
      answered.set(path, await verdictOf(path))
    }
  }

  if (waiting.length > 0) {
    await withinTime(
      engine,
      Promise.all(Array.from({ length: Limits.CHECKS_AT_ONCE }, drain)),
      [],
    )
  }

  waiting.length = 0

  return path => answered.get(path) ?? 'unknown'
}
