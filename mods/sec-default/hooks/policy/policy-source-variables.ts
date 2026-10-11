/**
 * The variables that move where policy and sign-in are read from, or how
 * policy's tiers compose.
 *
 * The managed settings folder, the remote settings file and its mock, the
 * opt-out of the administrator tiers' union, the configuration and
 * credential folders, and the three that choose which server sign-in goes
 * to. All nine are pinned on every build.
 *
 * Not pinned: proxy and certificate, credential, provider and home
 * variables. A person sets the same ones in their own settings and shell,
 * so a pin here would not close that road.
 */
export const POLICY_SOURCE_VARIABLES = [
  'CLAUDE_CODE_MANAGED_SETTINGS_PATH',
  'CLAUDE_CODE_REMOTE_SETTINGS_PATH',
  'CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION',
  'CLAUDE_CODE_MOCK_REMOTE_SETTINGS',
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_SECURESTORAGE_CONFIG_DIR',
  'USE_LOCAL_OAUTH',
  'USE_STAGING_OAUTH',
  'CLAUDE_LOCAL_OAUTH_API_BASE',
] as const
