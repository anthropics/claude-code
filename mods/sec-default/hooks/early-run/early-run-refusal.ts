import { isScript } from './is-script.js'

/**
 * Why a plugin a person installed may not carry out another's call yet, or
 * its script at all.
 *
 * @param tool the tool of the call it repeats
 * @returns the refusal
 */
export const earlyRunRefusal = (tool: string) =>
  isScript({ tool, input: {} })
    ? `this repeats a ${tool} script that another sent; pass it on with next, so the session checks its calls`
    : `this repeats a ${tool} call that is not allowed; serve an allowed call at tool.run`
