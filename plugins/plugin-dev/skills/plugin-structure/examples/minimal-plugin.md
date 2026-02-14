# Minimal Plugin Example

A bare-bones plugin with a single command.

## Directory Structure

```
hello-world/
├── .claude-plugin/
│   └── plugin.json
└── commands/
    └── hello.md
```

## File Contents

### .claude-plugin/plugin.json

```json
{
  "name": "hello-world"
}
```

### commands/hello.md

```markdown
---
name: hello
description: Prints a friendly greeting message
---

# Hello Command

Print a friendly greeting to the user.

## Implementation

Output the following message to the user:

> Hello! This is a simple command from the hello-world plugin.
>
> Use this as a starting point for building more complex plugins.

Include the current timestamp in the greeting to show the command executed successfully.
```

## Usage

After installing the plugin:

```
$ claude
> /hello
Hello! This is a simple command from the hello-world plugin.

Use this as a starting point for building more complex plugins.

Executed at: 2025-01-15 14:30:22 UTC
```

## Key Points

1. **Minimal manifest**: Only the required `name` field
2. **Single command**: One markdown file in `commands/` directory
3. **Auto-discovery**: Claude Code finds the command automatically
4. **No dependencies**: No scripts, hooks, or external resources

## When to Use This Pattern

- Quick prototypes
- Single-purpose utilities
- Learning plugin development
- Internal team tools with one specific function

## Extending This Plugin

To add more functionality:

1. **Add commands**: Create more `.md` files in `commands/`
2. **Add metadata**: Update `plugin.json` with version, description, author
3. **Add agents**: Create `agents/` directory with agent definitions
4. **Add hooks**: Create `hooks/hooks.json` for event handling
