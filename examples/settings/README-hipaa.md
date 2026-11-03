# HIPAA settings example

Example `managed-settings.json` and `managed-mcp.json` files for an organization that has the HIPAA configuration applied and wants to limit how session content can leave a developer's computer.
They apply whether or not the HIPAA configuration is in effect.

> [!WARNING]
> They are a sample that we recommend as a starting point.
> Your organization is responsible for deciding what its own environment needs and for confirming that its configuration meets those needs.

Requires Claude Code v2.1.285 or later, and Claude Desktop v2.19675.0 or later for the Code tab and Cowork.

Start with [Set up Claude Code (local mode) for a HIPAA-ready organization](https://code.claude.com/docs/en/hipaa-setup), which covers versions, network access, and a four-key starting sample.
For the Claude Desktop policy and Cowork, see [Set up Cowork (local mode) for a HIPAA-ready organization](https://claude.com/docs/cowork/hipaa-setup).

## Files

| File | Purpose |
|---|---|
| [`settings-hipaa.json`](./settings-hipaa.json) | Deploy as `managed-settings.json`. Sandboxed commands reach only the hosts you list, and the retention period for local session data is 30 days. [Tighten further](#tighten-further) lists optional changes. |
| [`managed-mcp-hipaa.json`](./managed-mcp-hipaa.json) | Deploy as `managed-mcp.json` beside the settings file to [turn MCP off](https://code.claude.com/docs/en/managed-mcp#disable-mcp-entirely). Keep the `mcpServers` key. |

The settings file also governs local sessions in the Code tab of Claude Desktop and, [by default](https://code.claude.com/docs/en/managed-settings#where-and-when-a-policy-applies), Cowork.
[Check which Claude Code managed settings apply in Cowork](https://claude.com/docs/cowork/hipaa-setup#check-which-claude-code-managed-settings-apply-in-cowork) lists what these keys change in Cowork.

## Edit before you deploy

On Windows, decide where each copy goes before you edit.
The sandbox can't run on native Windows or WSL1, so `sandbox.failIfUnavailable` makes Claude Code exit at startup there.
Run the terminal in WSL2 with the full file inside the distribution.
For the Code tab and Cowork, deploy a copy without the `sandbox` block to `C:\Program Files\ClaudeCode\managed-settings.json`.

1. Replace the `forceLoginOrgUUID` placeholder with your [organization ID](https://code.claude.com/docs/en/hipaa-setup#what-each-key-does).
   Until it matches, Claude Code exits at startup for every claude.ai sign-in.
2. Replace `proxy.example.internal:8080` in the four proxy variables with your proxy.
   If you have none, delete those four lines and the two `NO_PROXY` lines.
   An unedited placeholder stops Claude Code from starting.
3. Point `OTEL_EXPORTER_OTLP_ENDPOINT` at your own collector, and put the collector's host in `NO_PROXY` and `no_proxy` beside `localhost` and `127.0.0.1`.
   Those entries send exports straight to the collector, because a corporate proxy often can't reach an internal host, and keep local HTTP MCP servers and other loopback endpoints off the proxy.
   If your proxy is the only route to the collector, leave only the two loopback entries.
4. Replace the placeholder hosts in `sandbox.network.allowedDomains` with your Git host and package registry.
   If either host is internal, add it to `NO_PROXY` and `no_proxy` as in step 3, or the sandbox forwards those requests to your corporate proxy.
5. Set `cleanupPeriodDays` to your retention period.
6. Add the MCP servers, plugin marketplaces, and HTTP hook URLs you have reviewed to `allowedMcpServers`, `strictKnownMarketplaces`, and `allowedHttpHookUrls`.
   As shipped, all three are empty.
   Empty `allowedMcpServers` and `strictKnownMarketplaces` lists block everything, and `allowedHttpHookUrls` is one of the [lists that merge across scopes](#what-these-files-dont-cover).
7. Extend the `Read` and `Edit` rules in `permissions.deny`, `sandbox.filesystem.denyWrite`, and `sandbox.credentials` with your computers' other shells, `PATH` directories, and secrets.
   Add an `Edit` rule for each credential path you add: `denyWrite` binds sandboxed commands, not Claude's own file edits.
   Yarn and Bun configuration files (`~/.yarnrc`, `~/.yarnrc.yml`, `~/.bunfig.toml`) aren't hidden as shipped, because those tools can't start when they are; keep registry tokens in the hidden variables instead, and check that no token sits in those files on your computers.
   On Linux and WSL2, a `denyWrite` entry with a wildcard is skipped, so spell paths out there; see [Sandbox path prefixes](https://code.claude.com/docs/en/settings-reference#sandbox-path-prefixes).
   The denies match exact names, so cover the spellings your developers use: a relocated `XDG_CONFIG_HOME`, npm's `npm_config_` variables, and pointer variables such as `NPM_CONFIG_USERCONFIG` or `NETRC` aren't covered as shipped.
8. On Linux and WSL2, [install bubblewrap and socat](https://code.claude.com/docs/en/sandboxing#set-up-linux-and-wsl2).
9. In a container that lacks the privileges the sandbox needs, such as a dev container, every sandboxed command fails with a `bwrap` error about [mounting `/proc`](https://code.claude.com/docs/en/sandboxing#bubblewrap-fails-to-start-inside-a-container) while [`sandbox.enableWeakerNestedSandbox`](https://code.claude.com/docs/en/settings-reference#sandbox-enableweakernestedsandbox) is `false`, and `allowUnsandboxedCommands: false` leaves no fallback.
   Claude Code usually still starts there, so check a command rather than the startup.
   Deploy a copy with that key set to `true` in those containers, after you read what the weaker mode gives up.

## Tighten further

The file favors a working developer setup over the tightest possible one.
These optional changes tighten it:

- Set `cleanupPeriodDays` lower, for example `7`.
- Empty `sandbox.network.allowedDomains` so sandboxed commands reach no host at all.
  `git` against your Git host and package installs then fail inside the sandbox.
- Add the home-directory files that later run or configure tools outside the sandbox, such as `~/.bashrc`, `~/.profile`, `~/.zshrc`, `~/.gitconfig`, `~/.config/autostart`, `~/Library/LaunchAgents`, and the package-manager files `~/.yarnrc`, `~/.yarnrc.yml` and `~/.bunfig.toml`, to `sandbox.filesystem.denyWrite`, with a matching `Edit` rule for each in `permissions.deny`.
  On Linux and WSL2, create each listed path before you deploy: the sandbox stands in for a listed path that doesn't exist with [an unreadable placeholder](https://code.claude.com/docs/en/sandboxing#troubleshooting), so an absent `~/.yarnrc.yml` on that list stops every `yarn` command, and an empty `~/.bash_profile` or `~/.xinitrc` can break a login, so give the shell files real content.

## What the keys do

The [settings reference](https://code.claude.com/docs/en/settings-reference) describes each key in full.

| Keys | What they do |
|---|---|
| `forceLoginMethod`, `forceLoginOrgUUID`, `allowedProviders`, `cleanupPeriodDays` | The four keys from the setup page. Claude Code (local mode) refuses cloud providers, LLM gateways, custom base URLs, and sign-ins to other organizations. See [What each key does](https://code.claude.com/docs/en/hipaa-setup#what-each-key-does). |
| `forceRemoteSettingsRefresh` | Claude Code (local mode) exits at startup if it can't fetch fresh server-managed settings. The check runs at startup only, and only in sessions that fetch server-managed settings. |
| `allowManagedHooksOnly`, `allowedHttpHookUrls`, `allowManagedMcpServersOnly`, `allowedMcpServers`, `deniedMcpServers`, `allowManagedPermissionRulesOnly`, `strictKnownMarketplaces`, `strictPluginOnlyCustomization`, `disableSideloadFlags` | Hooks, MCP servers, permission rules, plugins, skills, and agents come from managed settings. Bundled skills, built-in agents, and hooks from plugins that managed settings force-enable still load, and CLAUDE.md files and output styles aren't locked. `deniedMcpServers` names the built-in browser, computer use, and IDE servers, which the allowlist never evaluates. [What developers lose](#what-developers-lose) lists the cost. |
| `permissions` | Blocks these tools, which send content off the computer: WebFetch, Projects (file uploads to a claude.ai project), SendUserFile, ShareOnboardingGuide, and Artifact. Keeps Claude's own file reads and edits out of credential files and folders, and removes bypass permissions mode. |
| `disableRemoteControl`, `enableArtifact`, `syncClaudeAiSkills`, `syncClaudeAiPlugins`, `crossSessionInbound`, `skillOverrides` | Turns off Remote Control, artifact publishing, claude.ai skill and plugin sync, inbound messages from other sessions, and `/auto-mode-setup`. |
| `autoMode` | Keeps the built-in auto mode rules in force. See [Auto mode](#auto-mode). |
| `sandbox` | The Bash commands Claude runs start in the sandbox, and Claude Code (local mode) exits at startup if the sandbox can't start. Commands that match a developer's own `excludedCommands` entries, and commands a developer types at the `!` prompt, run outside it. Only managed settings can list the hosts sandboxed commands reach, and credential files and variables are hidden from them. |
| `env` | Sends OpenTelemetry metrics and events to your collector with prompt text, response text, tool details, tool content, and raw API bodies turned off. Routes traffic through your proxy, and turns off error reports, `/feedback`, the feedback survey, and `/install-github-app`. |

In a terminal, managed `env` values overwrite the shell.
When Claude Desktop or a runner starts the session, [its launch environment takes precedence](https://code.claude.com/docs/en/settings-reference#how-env-values-interact-with-your-shell).
The file doesn't set `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`: it turns off the auto-updater, and it leaves WebFetch on.

## What developers lose

Tell developers about these changes before you deploy.

- **Their own skills, commands, and agents**: `strictPluginOnlyCustomization` stops them from loading.
- **Their own permission rules**: `allowManagedPermissionRulesOnly` hides the always-allow choices in permission prompts and ignores the allow, ask, and deny rules in developers' settings files.
  In a Cowork (local mode) task that asks before edits, Claude can't write to connected folders until you [add allow rules for those folders](https://code.claude.com/docs/en/managed-settings#keep-cowork-folder-access-when-only-managed-rules-apply).
- **IDE features in terminal sessions**: denying `ide` stops Claude Code (local mode) from connecting to VS Code or a JetBrains IDE, so `/ide`, IDE diff views, selection context, and diagnostics stop working.
- **`/goal`**: the command can't run while `allowManagedHooksOnly` is set.
- **Private package registries inside the sandbox**: the file hides `~/.npmrc` and the npm, Yarn, Corepack, and Bun token variables from sandboxed commands, so an install that needs a registry token fails there, and Yarn 1.x, which reads `~/.npmrc` on every run, fails whenever that file exists.
  Yarn and Bun configuration files such as `~/.yarnrc.yml` and `~/.bunfig.toml` stay readable, because those tools can't start without them; keep registry tokens in the variables, not in those files.
- **Plugins and account skills in Claude Desktop**: with [`disableSideloadFlags`](https://code.claude.com/docs/en/settings-reference#disablesideloadflags) on the computer, Claude Desktop passes none of the plugins it manages to Code tab or Cowork (local mode) sessions.
  Code tab sessions also start without the skills enabled for the developer's claude.ai account.

## Auto mode

With the HIPAA configuration applied, sessions [start in Manual mode](https://code.claude.com/docs/en/permission-modes#hipaa-configuration), and auto mode stays available.
The file pins `"$defaults"` in `environment`, `soft_deny`, and `hard_deny`, so a developer's own list adds to the built-in entries and can't replace them.
In `environment`, the pin keeps the built-in sensitivity entries.
It doesn't limit what the data exfiltration rule trusts: a developer's own `environment` entries are still added, and the rule treats the repositories, domains, and buckets listed there as trusted.
A developer's `allow` entry can still override a `soft_deny` entry, so put anything that must always be blocked in `permissions.deny`.
`classifyAllShell` changes nothing until you add managed allow rules.
[Configure auto mode](https://code.claude.com/docs/en/auto-mode-config) explains how the lists combine.

In auto mode, a classifier reviews each action in place of a person, so an injected instruction that the classifier allows runs without anyone approving it.
Keep the `sandbox` block if your developers use auto mode, or set `disableAutoMode` to `"disable"` to remove auto mode.
If you set it, keep `strictPluginOnlyCustomization` as well: it stops user and project subagent files, which can declare their own permission mode, from loading.
Sandboxed Bash commands run without a prompt while `sandbox.autoAllowBashIfSandboxed` is at its default of `true`, apart from the exceptions in [Auto-allow mode](https://code.claude.com/docs/en/sandboxing#auto-allow-mode), so for those commands the sandbox is the control.
Set the key to `false` if your policy requires a person to approve each command.

## Check a computer

Run these checks on one managed computer after you deploy, and again after every edit.

1. Follow [Confirm the settings loaded](https://code.claude.com/docs/en/hipaa-setup#confirm-the-settings-loaded).
2. Ask Claude to run `curl https://example.com`.
   The command fails.
3. Ask Claude to run `curl -I https://github.example.com`, with your Git host in place of the placeholder.
   The command gets an HTTP response, because that host is in `sandbox.network.allowedDomains`.
   This check shows reach only.
   `git` against a private repository can still fail to sign in, because the file hides SSH keys, `~/.git-credentials`, `~/.netrc`, the GitHub token variables, and the `gh` configuration from sandboxed commands.
4. Confirm that your collector receives Claude Code events, and that the `prompt` attribute of `user_prompt` events reads `<REDACTED>`.

## What these files don't cover

- **Server-managed settings**: if your organization also uses [server-managed settings](https://code.claude.com/docs/en/server-managed-settings), have an Owner add the same keys there.
  [How Claude Code combines managed sources](https://code.claude.com/docs/en/managed-settings#how-claude-code-combines-managed-sources) explains which source applies.
  Keep the file on each computer as well, because Cowork (local mode) reads only the managed settings on the computer.
- **Sessions that never read the computer's settings**: the Claude Code GitHub Action, personal accounts on unmanaged computers, and browsers or other apps.
  Those are for your identity provider and network controls to handle.
- **Claude Console sign-ins**: `forceLoginOrgUUID` checks claude.ai sign-ins only, so don't give developers Claude Console access.
- **Processes outside the sandbox**: [What runs outside the sandbox](https://code.claude.com/docs/en/sandboxing#what-runs-outside-the-sandbox) lists them, and [Scope](https://code.claude.com/docs/en/sandboxing#scope) shows how to put a boundary around the whole process.
- **Lists that merge across scopes**: `allowedHttpHookUrls`, `sandbox.excludedCommands`, and `sandbox.filesystem.allowWrite` also take entries from a developer's own settings, so treat the managed values as defaults.
  `allowManagedHooksOnly` is what decides which hooks run.
  A developer who widens `allowWrite` to their home directory lets a sandboxed command write shell startup files.
  [Tighten further](#tighten-further) shows how to block those.
- **Anything you later allow**: a sandboxed command can send data to any allowlisted host, including other repositories on the same Git host.
  An approved plugin, MCP server, or hook runs outside the sandbox.
- **Injected instructions**: content Claude Code (local mode) reads from repositories, issues, and CI output can direct Claude to move content through the developer's own shell and Git.
  Only the sandbox network allowlist limits where it goes.
- **Data that outlives the retention period**: cleanup runs only when Claude Code runs, and it never deletes auto memory.
  [Check the retention sweep](https://code.claude.com/docs/en/monitoring-usage#check-the-retention-sweep) shows how to confirm that each computer runs it.
  [Manage local session data](https://code.claude.com/docs/en/hipaa-setup#manage-local-session-data) covers what to delete when a developer leaves.

## Full documentation

- [Set up Claude Code (local mode) for a HIPAA-ready organization](https://code.claude.com/docs/en/hipaa-setup)
- [Set up Cowork (local mode) for a HIPAA-ready organization](https://claude.com/docs/cowork/hipaa-setup)
- [Managed settings](https://code.claude.com/docs/en/managed-settings) and the [settings reference](https://code.claude.com/docs/en/settings-reference)
- [Sandboxing](https://code.claude.com/docs/en/sandboxing) and [Managed MCP](https://code.claude.com/docs/en/managed-mcp)
