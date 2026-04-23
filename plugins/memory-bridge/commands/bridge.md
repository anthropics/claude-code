---
description: Consolidate session learnings into persistent memory before exiting
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(touch:*), Bash(git status:*), Bash(git add:*), Bash(git commit:*)
---

## Context

- Current project memory files: !`find .claude -name "MEMORY.md" -o -name "*.md" -path "*/memory/*" 2>/dev/null | head -20`
- Global CLAUDE.md exists: !`test -f ~/.claude/CLAUDE.md && echo "yes" || echo "no"`
- Skills directory: !`ls ~/.claude/skills/ 2>/dev/null || echo "none"`
- Git status: !`git status --short 2>/dev/null || echo "not a git repo"`

## Your task

Use the **bridge** skill to consolidate this session's learnings into persistent memory.

Follow the skill's process exactly:
1. **Scan** the session for new learnings
2. **Classify** each to the right persistence level (project memory, global config, or skill)
3. **Act** — write, update, or retire entries (check for duplicates first)
4. **Re-evaluate** — consolidate existing memory in light of additions (merge, retire, replace with shared priors)
5. **Resume** — write the cursor snapshot
6. **Signal** — create the marker file so the Stop hook passes

After consolidation, tell the user they can `/clear` to start fresh.
