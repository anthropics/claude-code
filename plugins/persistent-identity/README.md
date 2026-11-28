# Persistent Identity Plugin

Gives your Claude Code instance a persistent name and per-project memory that carries across sessions.

## Features

- **Persistent Name**: Auto-generated on first run (e.g., "swift-fox", "keen-owl"), consistent across all projects
- **Per-Project Memory**: Claude remembers important context, decisions, and preferences for each project between sessions
- **Natural Identity**: Claude uses its name naturally in conversation without being repetitive

## How It Works

On every session start, the plugin:
1. Reads (or creates) your instance's identity from `~/.claude/persistent-identity/identity.md`
2. Loads per-project memory from `~/.claude/persistent-identity/projects/<hash>/memory.md`
3. Injects identity and memory into the session context

Claude will naturally maintain its memory file by writing important observations as it works with you.

## Commands

### `/name [new-name]`

View or change your Claude instance's name.

- `/name` -- show current name
- `/name marvin` -- rename to "marvin"

Name requirements: 2-30 characters, letters/numbers/hyphens, must start with a letter.

## Data Storage

All data lives in `~/.claude/persistent-identity/`:

```
~/.claude/persistent-identity/
├── identity.md                  # Your instance's name
└── projects/
    └── <project-hash>/
        ├── project-info.txt     # Maps hash to project path
        └── memory.md            # Per-project memory
```

## Uninstallation

1. Remove the plugin from your Claude Code configuration
2. Optionally delete `~/.claude/persistent-identity/` to remove all identity and memory data

## Notes

- Memory files are markdown and can be manually edited
- The plugin adds ~400-600 tokens of context per session (plus the size of your memory file)
- Names are auto-generated from 1,600 adjective-noun combinations
- The identity is global (same name across all projects); memory is per-project
