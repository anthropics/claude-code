import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that compiles the empty WebAssembly module when the session
 * starts, in the tier given (the person's own by default), and logs how it went.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const compiling = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('session.start', async ($, e, next) => {
      const empty = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0])

      $.ui.log(
        await $.wasm.compile(empty).then(
          () => 'compiled',
          () => 'refused',
        ),
      )

      return next(e)
    })
  },
})
