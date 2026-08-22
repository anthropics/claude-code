# Compound Command Validation

This example demonstrates how to validate and provide clear visibility into compound shell commands that use operators like `&&`, `||`, `;`, and `|`.

## The Problem

When Claude Code asks for permission to run compound commands like:
```bash
sleep 10 && do-something-totally-different
```

The permission system might show it as a single command or use wildcards like "sleep *", making it unclear what you're actually approving. This creates a security and transparency issue.

## The Solution

The `compound-command-validator` rule automatically detects compound commands and breaks them down into their individual components, showing you exactly what will execute and in what order.

## How It Works

The rule uses the `is_compound` operator to detect commands containing multiple operations, then uses the `{{COMMAND_BREAKDOWN}}` template variable to display each component clearly.

### Example Output

When you try to run:
```bash
sleep 10 && echo "done" || echo "failed"
```

You'll see:
```
⚠️ Compound Command Detected

This command contains multiple operations chained together. Here's what will execute:

1. First: `sleep 10`
2. THEN (if successful): `echo "done"`
3. OR (if failed): `echo "failed"`

Each command will run in sequence. Make sure you understand all parts before approving.

Tip: Consider running commands one at a time for better control and visibility.
```

## Installation

1. Copy the example rule to your project:
   ```bash
   cp plugins/hookify/examples/compound-command-validator.local.md .claude/hookify.compound-validator.local.md
   ```

2. The rule will automatically activate for all bash commands

3. Customize the message or action as needed (change `action: warn` to `action: block` to prevent compound commands entirely)

## Supported Operators

The parser correctly handles:
- `&&` - Execute next command if previous succeeded
- `||` - Execute next command if previous failed
- `;` - Execute next command regardless of previous result
- `|` - Pipe output to next command

It also respects quoted strings, so `echo "hello && world"` is correctly treated as a single command.

## Template Variables

Available template variables for bash command rules:

- `{{COMMAND_BREAKDOWN}}` - Formatted list of all commands with their operators
- `{{BASE_COMMANDS}}` - Comma-separated list of base command names (e.g., `sleep`, `echo`, `rm`)

## Customization Examples

### Block All Compound Commands
```yaml
---
name: block-compound-commands
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: is_compound
    pattern: ""
---

❌ **Compound commands are not allowed**

Please run commands one at a time for better security and visibility.

Commands detected: {{BASE_COMMANDS}}
```

### Warn Only for Dangerous Combinations
```yaml
---
name: warn-dangerous-compound
enabled: true
event: bash
action: warn
conditions:
  - field: command
    operator: is_compound
    pattern: ""
  - field: command
    operator: regex_match
    pattern: "rm|del|format|dd"
---

⚠️ **Dangerous compound command detected!**

This command includes potentially destructive operations:

{{COMMAND_BREAKDOWN}}

Please review carefully before proceeding.
```

## Technical Details

The command parser:
- Handles nested quotes (single and double)
- Distinguishes between `|` (pipe) and `||` (or operator)
- Extracts base command names (handling `sudo`, `env`, etc.)
- Preserves command arguments and flags

See `plugins/hookify/utils/command_parser.py` for implementation details.

## Future Improvements

Potential enhancements:
- Per-command permission requests (ask for each component separately)
- Command rewriting (automatically split compound commands)
- Risk scoring based on command combinations
- Integration with shell history and command patterns
