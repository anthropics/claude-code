import Patterns from '../patterns'
import type Types from '../types'

/**
 * Of a row under a label only the id is the model's, so the name is what the
 * call of that id was made under. The hooks see every call that may hold a
 * chart from when they are loaded, so one read names the earlier ones. Only
 * the names are kept of it, and a read that fails is forgotten.
 *
 * @param readTranscript reads the main transcript afresh from the host
 * @param cache where the names of the calls are kept
 * @param row the call as the host draws it
 * @returns the row under the name its tool was called by, or as it was
 */
export async function rowAsCalled(
  readTranscript: Types.TranscriptRead,
  cache: Types.ChartCache,
  row: Types.ToolCallRow,
): Promise<Types.ToolCallRow> {
  const { tool_use_id, tool } = row
  const isNamed = !Patterns.ROW_LABEL.test(tool) || tool_use_id === undefined

  if (isNamed) {
    return row
  }

  const sinceLoaded = cache.calledTools.get(tool_use_id)

  if (sinceLoaded !== undefined) {
    return { ...row, tool: sinceLoaded }
  }

  cache.earlierTools ??= readTranscript().then(
    calls => new Map(calls.map(call => [call.id, call.tool])),
    (error: unknown) => {
      cache.earlierTools = undefined
      throw error
    },
  )
  const earlier = (await cache.earlierTools).get(tool_use_id)

  return earlier === undefined ? row : { ...row, tool: earlier }
}
