import { DEVICE_ID } from './device-id.js'
import { REMOTE_HASH } from './remote-hash.js'

/**
 * The survey answer's row as SENDING_ENV's session sends it, complete: the
 * shape rowOf reads back, every column the plugin can fill filled.
 */
export const EXPECTED_ROW = {
  event_type: 'ClaudeCodeInternalEvent',
  hasEventId: true,
  hasTimestamp: true,
  event_name: 'tengu_plugin_survey_answered',
  device_id: DEVICE_ID,
  email: 'person@example.invalid',
  auth: { account_uuid: 'acc-1111-2222', organization_uuid: 'org-3333-4444' },
  session_id: 'the-session',
  model: 'the-model',
  user_type: 'ant',
  is_interactive: true,
  client_type: 'cli',
  entrypoint: 'cli',
  env: {
    platform: 'darwin',
    platform_raw: 'darwin',
    arch: 'arm64',
    terminal: 'ghostty',
    shell: 'zsh',
    package_managers: 'npm,pnpm',
    runtimes: 'bun,node',
    is_ci: false,
    is_claubbit: false,
    is_github_action: false,
    is_claude_code_action: false,
    is_claude_code_remote: false,
    is_local_agent_mode: false,
    is_conductor: false,
    deployment_environment: 'unknown-darwin',
    vcs: 'git',
    is_claude_ai_auth: true,
  },
  metadata: { rh: REMOTE_HASH, answer: 2, page: 'ready', seen: true },
}
