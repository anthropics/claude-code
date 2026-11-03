import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that rewrites the value of every variable
 * any plugin sets to `theirs`.
 */
export const revaluing: Plugin = {
  name: 'revaluing',
  register(on) {
    on('env.set', ($, e, next) => next({ ...e, value: 'theirs' }))
  },
}
