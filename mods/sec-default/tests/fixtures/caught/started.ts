import type { TargetTier, ToolInfo, ValueOrDeny } from 'claude-code'

import { TOOLS } from '../tools.js'

/**
 * A `tool.list` hook's `next` that keeps the order its two runs were
 * started in, each answering the session's tools.
 *
 * @param order filled as the runs start: `chain`, then `past <tier>`
 * @returns the stand-in
 */
export const started = (order: (text: string) => void) =>
  Object.assign(
    (_e: unknown): Promise<ValueOrDeny<ToolInfo[]>> => {
      order('chain')

      return Promise.resolve({ value: [...TOOLS] })
    },
    {
      to: (_e: unknown, tier: TargetTier): Promise<ValueOrDeny<ToolInfo[]>> => {
        order(`past ${tier}`)

        return Promise.resolve({ value: [...TOOLS] })
      },
    },
  )
