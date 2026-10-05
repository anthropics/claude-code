import Hooks from '../../../hooks'

/**
 * What the plugin registers, read off its own `register`: each event's
 * hook and its `.catch`, as the engine would call them.
 *
 * @returns `(event, part) => function`; it throws where there is none
 */
export function handlersRegistered() {
  const registered = new Map<string, unknown>()

  Hooks.register((event: string, ...rest: unknown[]) => {
    registered.set(`${event} hook`, rest.at(-1))

    return {
      catch: (handler: unknown) =>
        void registered.set(`${event} catch`, handler),
    }
  })

  return (event: string, part: 'hook' | 'catch' = 'catch') => {
    const handler = registered.get(`${event} ${part}`)

    if (typeof handler !== 'function') {
      throw new Error(`${event} carries no ${part}`)
    }

    return handler
  }
}
