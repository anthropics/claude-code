# Account Profiles

Account Profiles manages isolated `CLAUDE_CONFIG_DIR` launch environments for people who use personal, work, or client Claude accounts on one computer.

It packages the existing configuration-directory workaround into validated profile creation, launch instructions, project safeguards, and diagnostics. It **does not** modify or copy OAuth credentials, switch the currently running Claude Code process, or guarantee that operating-system credential storage is isolated.

## Commands

- `/account-profiles:add <name>` creates an empty profile directory.
- `/account-profiles:list` lists registered profiles.
- `/account-profiles:status` identifies the selected local launch profile.
- `/account-profiles:launch <name>` prints PowerShell and POSIX launch commands.
- `/account-profiles:assign <name>` adds a local expected-profile marker to the current project.
- `/account-profiles:doctor` validates directories and registry data.
- `/account-profiles:remove <name>` removes a profile after explicit confirmation.

## Workflow

```text
/account-profiles:add personal
/account-profiles:add work
/account-profiles:launch work
```

Run the printed command in a new terminal and authenticate once using `/login`. Later launches reuse whatever authentication Claude Code itself associates with that configuration environment.

Always verify the actual account with `/status`. A profile name is local metadata and is not proof of the authenticated or billed identity.

## Development

Load the plugin directly:

```bash
claude --plugin-dir /path/to/claude-code/plugins/account-profiles
```

Run automated tests:

```bash
node --test plugins/account-profiles/tests/profile-manager.test.mjs
```

Use a temporary profiles home for non-destructive testing:

```bash
CLAUDE_PROFILES_HOME=/tmp/account-profiles-test node plugins/account-profiles/scripts/profile-manager.mjs add work
```

## Security and limitations

- Credentials are handled only by Claude Code's existing `/login` flow.
- The plugin never reads, copies, exports, or displays tokens.
- Profile removal deletes local settings and sessions but does not revoke OAuth access.
- A plugin cannot mutate the parent process environment; switching requires a new process.
- Some Claude Code surfaces and OS credential stores may not fully honor `CLAUDE_CONFIG_DIR`. Test two real accounts concurrently before relying on isolation.
- Keep `.claude/account-profile.local.json` out of version control when project assignments reveal internal account or organization names.

This is an interim workflow related to [#20131](https://github.com/anthropics/claude-code/issues/20131), not native multi-account authentication.
