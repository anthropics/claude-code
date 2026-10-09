import type { FailureRead } from './failure-read'

/**
 * The debug line for a `plugin.register` hook of this plugin that failed:
 * the module it was judging, how it failed, and what the failure said.
 *
 * @param name the judged plugin's name, as its own manifest gives it
 * @param error why the hook failed, as its `.catch` reads it
 * @returns the line
 */
export const admissionFailure = (name: string, error: FailureRead) =>
  `plugin.register hook failed judging ${name} (${error.kind}): ` +
  (error.message ?? 'no message')
