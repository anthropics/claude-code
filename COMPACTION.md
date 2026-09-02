# Compaction Best Practices

When Claude Code auto-compacts at ~95% token capacity, important context can be lost. This guide provides recommended instructions to add to your `~/.claude/CLAUDE.md` file to preserve critical context during compaction.

## The Problem

During long sessions, Claude Code automatically compacts conversation history. Without guidance, this can cause loss of:
- Current task state and progress
- File modifications made during the session
- Technical decisions and their rationale
- Error messages and their resolutions

## Solution: Add Compaction Instructions

Add the following to your `~/.claude/CLAUDE.md` file:

### What to Preserve (Full Detail)

1. **Last 10 messages** - Keep recent exchanges verbatim
2. **Current task state** - Active work, pending items, blockers
3. **All file modifications** - Every file path, what changed, and why
4. **Code snippets written** - Actual code created or modified
5. **Decisions made** - Technical choices, user preferences, rejected alternatives
6. **Errors encountered** - Error messages, stack traces, and resolutions
7. **Todo list state** - All pending, in-progress, and completed items

### What to Summarize (Condensed)

1. **Exploration/research** - Condense to: "Searched X, found Y in Z location"
2. **File reads** - Condense to: "Read [file] - contains [key info]"
3. **Failed attempts** - Condense to: "Tried X, failed because Y"
4. **General discussion** - Extract only actionable conclusions

### Structured Summary Block

Include this template in compacted output:

```
## Session Context (Post-Compaction)
- **Project**: [name and path]
- **Current Task**: [what we're doing now]
- **Files Modified**: [list with brief descriptions]
- **Key Decisions**: [numbered list]
- **Pending Actions**: [what's left to do]
- **User Preferences Learned**: [any stated preferences]
```

### Priority Order

If space is limited, preserve in this order:
1. Current task context and last messages
2. File changes and code written
3. Decisions and user preferences
4. Error resolutions
5. Everything else as summary

## Credits

This guide was contributed by [@ajjucoder](https://github.com/ajjucoder) based on real-world experience with long-running Claude Code sessions.
