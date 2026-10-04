/**
 * The client types the CLI names by entrypoint alone: the SDKs, the VS Code
 * and desktop hosts, and the local agent.
 */
export const CLIENT_TYPE_BY_ENTRYPOINT: Readonly<Record<string, string>> = {
  'sdk-ts': 'sdk-typescript',
  'sdk-py': 'sdk-python',
  'sdk-cli': 'sdk-cli',
  'claude-vscode': 'claude-vscode',
  'local-agent': 'local-agent',
  'claude-desktop': 'claude-desktop',
}
