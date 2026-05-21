# Session Management Plugin

Fork or move Claude Code conversations to a different working directory, preserving full conversation history and context.

## Overview

When you reorganize your project files — moving a folder from one location to another — your Claude Code conversation history stays tied to the original directory. This plugin lets you fork or move conversations so you don't lose valuable context like design decisions, debugging history, and iterative refinements.

## Commands

### `/fork` — Fork a conversation to a new directory

Creates a copy of the current conversation in a different working directory. The original stays intact, and you get a full copy with all history preserved.

```
/fork ~/Documents/new-project-location
```

**What it does:**
1. Finds the current session's conversation file
2. Copies it (and any companion data) to the target directory's storage
3. Updates internal directory references so Claude associates it with the new location
4. Both original and fork can continue independently

### `/move` — Move a conversation to a new directory

Moves the current conversation to a different working directory, removing it from the original location.

```
/move ~/Documents/new-project-location
```

**What it does:**
1. Finds the current session's conversation file
2. Moves it (and any companion data) to the target directory's storage
3. Updates internal directory references
4. The original is removed — only the moved copy remains

### `/sessions` — List conversation sessions

Shows all stored sessions for the current (or specified) directory with timestamps, sizes, and message previews.

```
/sessions
/sessions ~/Documents/other-project
```

## Usage Examples

### Project reorganization

You've been working in `~/Desktop/my-app/` and want to move it to `~/Projects/my-app/`:

```bash
# After moving your project files
mv ~/Desktop/my-app ~/Projects/my-app

# Fork the conversation to the new location
/fork ~/Projects/my-app

# End this session, then:
cd ~/Projects/my-app
claude --resume
```

### Working on the same project from multiple locations

```
/fork ~/Projects/my-app-v2
```

Now both directories have the full conversation history, and you can continue independently in each.

### Checking available sessions

```
/sessions
```

## How It Works

Claude Code stores conversations as JSONL files in `~/.claude/projects/`, organized by the working directory path (with `/` replaced by `-`). This plugin:

1. **Locates** the conversation file for the current session
2. **Copies/moves** it to the target directory's project storage
3. **Updates** the `cwd` references inside the conversation so Claude correctly associates it with the new directory
4. **Preserves** companion data (subagent logs, cached tool results)

## Requirements

- Claude Code installed
- `sed`, `cp`, `mv` (standard Unix tools)
- Python 3 (for session preview in `/sessions`)

## Limitations

- The current running session remains bound to its original directory — after forking/moving, you need to start a new session from the target directory using `claude --resume`
- File history backups (`~/.claude/file-history/`) are not moved (they reference session UUIDs, not directories)
- Memory files (auto-memory in `~/.claude/projects/`) are directory-specific and not copied — consider manually copying relevant memory if needed
