import type { TraceEntry } from 'claude-code'

/**
 * The verdict handed up to one link of a run: what the nearest link beneath
 * it that settled on anything settled on.
 *
 * Undefined for a link that answered without calling `next`: the trace ends
 * short of the engine there, and nothing beneath it ran.
 *
 * @param trace a run as `next.trace` lists it, nearest the caller first
 * @param at the link's place in that list
 * @returns the verdict, or undefined when nothing settled beneath the link
 */
export const handedTo = (
  trace: readonly TraceEntry<'tool.check'>[],
  at: number,
) => trace.slice(at + 1).find(link => link.returned !== undefined)?.returned
