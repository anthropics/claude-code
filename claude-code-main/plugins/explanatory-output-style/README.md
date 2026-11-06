# Explanatory Output Style Plugin

This plugin recreates the deprecated Explanatory output style as a SessionStart
hook.

WARNING: Do not install this plugin unless you are fine with incurring the token
cost of this plugin's additional instructions and output.

## What it does

When enabled, this plugin automatically adds instructions at the start of each
session that encourage Claude to:

1. Provide educational insights about implementation choices
2. Explain codebase patterns and decisions
3. Balance task completion with learning opportunities

## How it works

The plugin uses a SessionStart hook to inject additional context into every
session. This context instructs Claude to provide brief educational explanations
before and after writing code, formatted as:

```
`★ Insight ─────────────────────────────────────`
[2-3 key educational points]
`─────────────────────────────────────────────────`
```

## Usage

Once installed, the plugin activates automatically at the start of every
session. No additional configuration is needed.

The insights focus on:

- Specific implementation choices for your codebase
- Patterns and conventions in your code
- Trade-offs and design decisions
- Codebase-specific details rather than general programming concepts

## Migration from Output Styles

This plugin replaces the deprecated "Explanatory" output style setting. If you
previously used:

```json
{
  "outputStyle": "Explanatory"
}
```

You can now achieve the same behavior by installing this plugin instead.

More generally, this SessionStart hook pattern is roughly equivalent to
CLAUDE.md, but it is more flexible and allows for distribution through plugins.

Note: Output styles that involve tasks besides software development, are better
expressed as
[subagents](https://docs.claude.com/en/docs/claude-code/sub-agents), not as
SessionStart hooks. Subagents change the system prompt while SessionStart hooks
add to the default system prompt.

## Managing changes

- Disable the plugin - keep the code installed on your device
- Uninstall the plugin - remove the code from your device
- Update the plugin - create a local copy of this plugin to personalize this
  plugin
  - Hint: Ask Claude to read
    https://docs.claude.com/en/docs/claude-code/plugins.md and set it up for
    you!
