# Plugin Lifecycle and Management

Practical guidance for installing, testing, updating, and publishing Claude Code
plugins without tripping over CLI or cache behavior.

## Use the Right Interface

### Inside an active Claude Code session

Prefer the `/plugin` slash commands:

```text
/plugin install my-plugin@my-marketplace
/plugin update my-plugin
/plugin disable my-plugin
```

These are the safest option when Claude Code is already running because they
operate within the current session and do not require nesting a second Claude
CLI invocation.

### Outside Claude Code

Use the standalone CLI in a separate terminal:

```bash
claude plugin list
claude plugin install my-plugin@my-marketplace
claude plugin marketplace add owner/repo
```

**Important**: The correct command is `claude plugin` (singular). `claude plugins`
is a common hallucination and will not work.

## TTY Expectations

Many plugin-management flows are interactive and may expect a real TTY. That
means a command like `claude plugin install ...` is not a reliable thing to run
from an arbitrary non-interactive shell or from Claude's own tool execution.

Use this rule:

- If Claude is already in a session, prefer `/plugin ...`
- If you need the CLI, ask the user to run it in a separate terminal
- Do not assume plugin-management commands behave well when piped, backgrounded,
  or launched without terminal access

## Marketplace Commands

### Adding a marketplace from GitHub

For GitHub-hosted marketplaces, pass `owner/repo` directly:

```bash
claude plugin marketplace add owner/repo
```

Avoid these incorrect variants unless the CLI explicitly documents them:

```bash
claude plugin marketplace add github:owner/repo
claude plugin marketplace add https://github.com/owner/repo
```

## Local Development Workflow

For iterative plugin development, load the plugin from disk:

```bash
cc --plugin-dir /path/to/plugin
```

This avoids unnecessary marketplace indirection while you are still changing the
plugin structure, prompts, hooks, or scripts.

Recommended loop:

1. Edit plugin files locally
2. Validate the manifest and component structure
3. Test with `cc --plugin-dir /path/to/plugin`
4. Bump versions before publishing or reinstall testing

## Versioning Is Also Cache Invalidation

The plugin version is not just release metadata. In practice it also controls
whether Claude Code treats an install as a new artifact.

### What to do

- Bump `.claude-plugin/plugin.json` whenever you ship a change users need to receive
- If you publish through a marketplace registry, update the registry version too
- Keep version numbers monotonic across published artifacts

### What goes wrong if you do not

If you change plugin files but reuse the same version, existing installs may keep
serving cached plugin contents. That can look like:

- users reinstalling but not seeing your changes
- "works on my machine" confusion between local and installed copies
- debugging time wasted on a cache issue that is really a versioning issue

## Quick Checks Before Publishing

- Confirm the manifest lives at `.claude-plugin/plugin.json`
- Confirm component paths still resolve from `${CLAUDE_PLUGIN_ROOT}`
- Validate any marketplace entry points or registry metadata
- Bump the plugin version before asking users to update
- Test a fresh install path, not just your already-loaded local development copy
