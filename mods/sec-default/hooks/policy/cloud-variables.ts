/**
 * The variables each cloud's libraries read for a credential, a region, a
 * project or an endpoint, the home folders they look under among them:
 * patterns over the name in upper case.
 *
 * Pinned only where the session runs on that cloud (isCloudVariableInUse),
 * so a person's plugin elsewhere still sets them for the tools it runs.
 */
export const CLOUD_VARIABLES = {
  anthropic: [/^(HOME|XDG_CONFIG_HOME|APPDATA|USERPROFILE)$/],
  aws: [
    /^AWS_\w*(KEY|TOKEN|CRED|ROLE_|AUTH_SCHEME|ACCOUNT_ID|PROFILE|CONFIG_FILE)/,
    /^AWS_\w*(REGION|ENDPOINT|METADATA|CA_BUNDLE|LOGIN_CACHE)/,
    /^(HOME|HOMEDRIVE|HOMEPATH|USERPROFILE)$/,
  ],
  google: [
    /^GOOGLE_(APPLICATION_CREDENTIALS|API_CERTIFICATE_CONFIG|EXTERNAL_ACCOUNT_)/,
    /^(GOOGLE_CLOUD_\w*PROJECT|GCLOUD_PROJECT|CLOUD_ML_REGION)$/,
    /^(CLOUDSDK_\w*(CONFIG|PROJECT|ACCOUNT|AUTH_)|GCE_METADATA_)/,
    /^(GOOGLE_SDK_NODE_LOGGING|METADATA_SERVER_DETECTION|HOME|APPDATA)$/,
  ],
  azure: [
    /^AZURE_(CLIENT_|TENANT_ID|USERNAME|PASSWORD|FEDERATED_|TOKEN_CREDENTIALS)/,
    /^(AZURE_(\w*AUTHORITY|ADDITIONALLY_|IDENTITY_)|AZ(URE|D)_CONFIG_DIR)/,
    /^(IDENTITY_(ENDPOINT|HEADER|SERVER_THUMBPRINT)|(IMDS|MSAL|MSI)_)/,
    /^(DEFAULT_IDENTITY_CLIENT_ID|REGION_NAME|HOME)$/,
  ],
} as const
