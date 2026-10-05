import type { Settings } from 'claude-code'

/**
 * A `$` whose calls are answered from the bottom: the policy given is read,
 * and each line logged is handed on.
 *
 * @param policy the managed settings in force
 * @param told what each logged line is handed to
 * @returns the stand-in
 */
export const answering = (
  policy: Settings,
  told: (line: string) => void = () => undefined,
) => ({
  settings: { read: () => Promise.resolve(policy) },
  ui: {
    log(line: string) {
      told(line)

      return Promise.resolve()
    },
  },
})
