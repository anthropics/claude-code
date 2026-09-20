import { SENDING_ENV } from './sending-env.js'

/**
 * SENDING_ENV on Bedrock under a host that manages the provider: the CLI's
 * analytics stay on there unless DISABLE_TELEMETRY says otherwise.
 */
export const HOST_MANAGED_BEDROCK_ENV: Readonly<Record<string, string>> = {
  ...SENDING_ENV,
  CLAUDE_CODE_USE_BEDROCK: '1',
  CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: '1',
}
