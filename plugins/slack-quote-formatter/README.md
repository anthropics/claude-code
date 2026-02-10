# Slack Quote Formatter

Enhances the visual display of Slack forwarded and quoted messages with distinctive Unicode box formatting.

## Overview

When Claude Code receives messages from Slack that include forwarded messages, they typically appear as plain text:

```
[Forwarded Message]
From: Felix Klock
Message: I assume it would be a matter of reviewing the entries...
```

This plugin transforms these plain blocks into visually distinctive formatted quotes:

```
╔════════════════════════════════════════════════════════════════════╗
║  FORWARDED MESSAGE                                                 ║
╠════════════════════════════════════════════════════════════════════╣
║  From: Felix Klock                                                 ║
╟────────────────────────────────────────────────────────────────────╢
║    I assume it would be a matter of reviewing the entries...       ║
╚════════════════════════════════════════════════════════════════════╝
```

## Features

- Unicode box drawing characters for clear visual boundaries
- Distinct header section highlighting "FORWARDED MESSAGE"
- Sender information prominently displayed
- Message content indented for quote-like appearance
- Automatic text wrapping for long messages
- Handles multiple forwarded messages in a single prompt

## Installation

This plugin is included in the Claude Code plugins repository. To enable it:

1. Add the plugin to your project's `.claude/settings.json`:
   ```json
   {
     "plugins": [
       "path/to/plugins/slack-quote-formatter"
     ]
   }
   ```

2. Or install via the Claude Code plugin command:
   ```
   /plugin add slack-quote-formatter
   ```

## How It Works

The plugin registers a `UserPromptSubmit` hook that:

1. Intercepts incoming prompts
2. Detects `[Forwarded Message]` blocks in the Slack context
3. Transforms them into formatted boxes with visual distinction
4. Passes the transformed prompt to Claude

## Configuration

No configuration required. The plugin automatically activates when Slack forwarded messages are detected.

## Plugin Structure

```
slack-quote-formatter/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── hooks/
│   ├── hooks.json           # Hook configuration
│   └── format_slack_quotes.py  # Transformation logic
└── README.md
```

## Why Visual Distinction Matters

When working with Slack context in Claude Code, quoted messages can easily blend into the surrounding text, making it harder to:

- Identify what content is quoted vs. original
- Understand the source of different pieces of information
- Parse complex threads with multiple forwarded messages

This plugin makes quoted content immediately recognizable, improving readability and reducing confusion.
