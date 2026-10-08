# New Session Plugin

Start a fresh session from within an existing one, preserving the old session for `/resume`.

## Overview

The `/new` command bridges the gap between `/clear` and `/branch`. While `/clear` resets the conversation in the same session and `/branch` forks with full history, `/new` gives you a clean slate — a truly fresh session — while keeping the old one intact and resumable.

## Commands

### `/new`

Creates a fresh session, preserving the old one for later access via `/resume`.

**Usage:**
```bash
/new
/new my-feature-work
```

**What it does:**
1. Labels the current session (if a name is provided)
2. Starts a fresh conversation with no prior context
3. Preserves the old session data — accessible via `/resume`

**When to use:**
- Switching to a completely different task
- Starting fresh after completing a piece of work
- When you want a clean context without losing your previous conversation

## How It Differs From Built-in Commands

| Command | Creates New Session ID? | Preserves History? | Old Session Resumable? |
|---------|------------------------|--------------------|------------------------|
| `/clear` | No (same session) | No | Yes (via `/resume`) |
| `/branch` | Yes | Yes (copies history) | Yes |
| `/new` | Effectively yes | No (clean slate) | Yes (via `/resume`) |

## Installation

Install via the Claude Code plugin system:

```bash
claude
# Then use /plugin to install, or add to .claude/settings.json
```

## Author

Ajay Achinth (cjajay93@gmail.com)

## Version

1.0.0
