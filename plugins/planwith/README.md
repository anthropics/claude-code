# Planwith Plugin

Combine `/plan` and your prompt into a single command.

## Overview

The Planwith Plugin provides the `/planwith` command, which allows you to enter plan mode and specify your planning task in a single command. Instead of typing `/plan` and then entering your prompt separately, you can combine both into one step.

## Command: `/planwith`

Enters plan mode with your prompt inline.

**Usage:**
```bash
/planwith Add user authentication with OAuth
```

This is equivalent to:
```bash
/plan
# [wait for plan mode to activate]
Add user authentication with OAuth
```

**Examples:**
```bash
/planwith implement user authentication with OAuth 2.0
/planwith refactor the database layer to use connection pooling
/planwith add a dark mode toggle to the settings page
```

## How it Works

When you invoke `/planwith <prompt>`:
1. The command calls `EnterPlanMode` to activate plan mode
2. Your prompt is passed as the planning task
3. Plan mode proceeds with the standard planning workflow

This gives you the full plan mode experience (read-only restrictions, plan file creation, structured workflow) with the convenience of an inline prompt.

## Best Practices

- **Be specific**: Include context in your prompt
  - Good: `/planwith add OAuth 2.0 login with Google and GitHub providers`
  - Less good: `/planwith add login`

- **Let planning complete**: Allow Claude to explore and ask questions

- **Review the plan**: Check the proposed approach before approving implementation

## When to Use

**Use for:**
- Quick entry into plan mode with a specific task
- When you already know what you want to plan
- Reducing the two-step `/plan` + prompt into one step

**Don't use for:**
- When you want to enter plan mode without a specific task (use `/plan` instead)

## Installation

This plugin is included in the Claude Code repository. The command is automatically available when using Claude Code.

## Author

Anthropic (support@anthropic.com)

## Version

1.0.0
