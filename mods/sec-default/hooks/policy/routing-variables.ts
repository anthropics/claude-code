/**
 * The variables that say where a model request goes, what its connection
 * trusts, what signs it, what is merged into its body and whether the runtime
 * traces it, whichever provider the session runs on: patterns over the name in
 * upper case.
 *
 * The names that choose a model stay a person's.
 */
export const ROUTING_VARIABLES = [
  /^ANTHROPIC_\w*(BASE_URL|UNIX_SOCKET|RESOURCE|CUSTOM_HEADERS)$/,
  /^ANTHROPIC_\w*(PROJECT|LOCATION|REGION|REGION_PREFIX|PROFILE|CONFIG_DIR)$/,
  /^ANTHROPIC_\w*(PROJECT|WORKSPACE|ORGANIZATION|ACCOUNT|RULE)_ID$/,
  /^ANTHROPIC_\w*(API_KEY|AUTH_TOKEN|IDENTITY_TOKEN(_FILE)?|SCOPE)$/,
  /^(_?CLAUDE_CODE_\w*BASE|CLAUDE_\w*BRIDGE\w*)_URL$/,
  /^CLAUDE_CODE_USE_(ANTHROPIC_\w+|BEDROCK|FOUNDRY|GATEWAY|MANTLE|VERTEX)$/,
  /^(CLAUDE_CODE_(SKIP_\w+_AUTH|SIMPLE)$|VERTEX_REGION_)/,
  /^CLAUDE_(CODE|LOCAL|BRIDGE)_\w*(OAUTH|HOST_AUTH|FEDERATION)_/,
  /^CLAUDE_CODE_(\w*CERT|CLIENT_KEY|PROXY_|(EN|DIS)ABLE_(PROXY|HTTPS)_)/,
  /^(CLAUDE_CODE_(API_KEY_\w*|FORCE_WINDOWS_CREDMAN)|USER)$/,
  /^CLAUDE_CODE_EXTRA_(BODY|METADATA)$/,
  /^((HTTPS?|ALL|NO)_PROXY|SSL_CERT_(DIR|FILE)|NODE_EXTRA_CA_CERTS)$/,
  /^((NODE|BUN)_TLS_|BUN_CONFIG_VERBOSE_FETCH$)/,
  /^(HOSTALIASES|LOCALDOMAIN|RES_OPTIONS)$/,
] as const
