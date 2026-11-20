import type { EngineInterface } from 'claude-code'

import { CLOUD_VARIABLES } from './cloud-variables.js'

const ON = /^\s*(1|true|yes|on)\s*$/i

/**
 * Whether a variable is one of a cloud the session runs on: a switch of that
 * cloud is on, read as the engine reads it, or cannot be read. Anthropic's
 * switch is a base URL that is set.
 *
 * @param $ the calling hook's
 * @param name the variable a plugin would set or unset
 * @returns true when a model request may depend on it
 */
export function isCloudVariableInUse(
  $: EngineInterface,
  name: string,
): Promise<boolean> {
  const isOf = (cloud: keyof typeof CLOUD_VARIABLES) =>
    CLOUD_VARIABLES[cloud].some(pattern => pattern.test(name.toUpperCase()))

  return Promise.all([
    isOf('anthropic') && $.env.get('ANTHROPIC_BASE_URL'),
    isOf('aws') && $.env.get('CLAUDE_CODE_USE_ANTHROPIC_AWS'),
    isOf('aws') && $.env.get('CLAUDE_CODE_USE_BEDROCK'),
    isOf('aws') && $.env.get('CLAUDE_CODE_USE_MANTLE'),
    isOf('google') && $.env.get('CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD'),
    isOf('google') && $.env.get('CLAUDE_CODE_USE_VERTEX'),
    isOf('azure') && $.env.get('CLAUDE_CODE_USE_FOUNDRY'),
  ]).then(
    ([baseUrl, ...switches]) =>
      Boolean(baseUrl) || switches.some(value => ON.test(value || '')),
    () => true,
  )
}
