---
name: bridge
description: Consolidate session learnings into persistent memory. Run at session end before exiting.
---

# Bridge — Knowledge Consolidation

**Principle**: Keep as much as possible that is not already there. Keep as little as possible that is already there.

## Process

### 1. Scan — What's new this session?

Review session context for learnings not yet in persistent memory:
- New patterns, workflows, or tools discovered
- User preferences expressed (explicit or through correction)
- Failures and their root causes
- Cross-project insights (project-specific discovery that generalizes)

### 2. Classify — Where does it go?

| Level | Location | What belongs here |
|-------|----------|-------------------|
| Project memory | Project's `MEMORY.md` or memory directory | Project state, confirmed project-specific patterns |
| Global config | `~/.claude/CLAUDE.md` | Cross-project principles, user preferences |
| Skill | `~/.claude/skills/<name>/SKILL.md` | Reusable operational procedures |

**Promote** when a pattern appears in 2+ projects or user says "always" / "system wide."
**Retire** when an entry is superseded, contradicted, or promoted to a higher level.

### 3. Act — Update files

For each learning:
- Check if it's already documented (search existing memory + skills)
- If new: write to the appropriate level
- If confirms existing: no action needed
- If contradicts existing: update or remove the stale entry
- If promoted to higher level: remove from the lower level

### 4. Resume snapshot

Update the `## Resume` section at the top of the project's `MEMORY.md`.

**Overwrite** the entire Resume section each bridge. If no such section exists, insert one after the title.

Contents:
- **Goal**: What we were working on (one line)
- **Status**: Last completed step, next step
- **Pending**: Open decisions, blockers, or things the user asked for
- **Key context**: File paths, branch names, IDs — anything needed to pick up without re-discovery

If the session was exploratory with no resumable task, set: `No active task.`

This is a snapshot, not a log — always overwritten, never appended.

### 5. Signal completion

Create the marker file so the Stop hook won't fire again this session:

```bash
touch "/tmp/claude-bridge-${PPID}-done"
```

### 6. Done

Brief summary of what was added, updated, or retired. The user can then `/clear` to start fresh — MEMORY.md reloads from the system prompt, so the resume snapshot is immediately available.

## Saving principle

A single mention is exactly what's worth remembering — it can't be found or regenerated from anywhere else. Those are the real independent signals. Treat every difference as signal. Only discard if deemed irrelevant through logic and intentional user choice, never from pattern-matching speculation (e.g., "only mentioned once" or "might not matter").

## Anti-patterns

- Adding without checking for duplicates
- Duplicating across levels (one canonical location per fact)
- Documenting speculation (only confirmed patterns)
- Comprehensive description instead of generative ground (minimal entries that reconstruct understanding)
- Accumulating entries over time (fewer and stronger, not more)
- Discarding novel signals because they were only mentioned once — frequency measures redundancy, not importance
