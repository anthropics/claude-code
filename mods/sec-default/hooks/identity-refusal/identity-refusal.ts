import type { OpEventResult } from 'claude-code'

/**
 * What the `session.identity` row answers a plugin a person installed: a
 * value, so that `$.session.identity()` resolves with `deny` and never rejects.
 *
 * @param plugin the plugin asking, named in the reason
 * @returns the hook's answer
 */
export function identityRefusal(
  plugin: string,
): OpEventResult<'session.identity'> {
  return {
    value: {
      deny:
        '$.session.identity answers only a mod that managed settings enable ' +
        `and that is loaded in place from a source they name; ${plugin} ` +
        'is not one',
    },
  }
}
