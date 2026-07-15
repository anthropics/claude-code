---
name: bridge
description: Consolidate session learnings into memory and skills. Run at session end before exiting. Stop hook advises (never blocks) for substantial sessions.
---

# Bridge — Knowledge Consolidation

Memory is a bridge — a living derivation path from generative ground to the current question. It grows when understanding deepens, not when words accumulate. Selective forgetting is the feature, not the bug — intelligence is knowing what to discard, not just what to retain.

**Saving principle**: A single mention is exactly what's worth remembering — it can't be found or regenerated from anywhere else. Those are the real independent signals. Frequency measures redundancy, not importance. Only discard through logic and intentional choice, never from pattern-matching speculation.

**Consolidation direction**: Entries consolidate *toward their shared priors*. Two entries with common ground become the ground. The count goes down over time, each entry carrying more weight.

Nothing in this process is static — every rule here is itself refinable through use.

## When to bridge

The user is the final decision maker. Claude suggests `/bridge` at natural breakpoints when learnings have accumulated — task complete, rich exploration, shift in focus. Don't interrupt mid-flow. A Stop hook at ~1.5MB warns (never blocks) before auto-compaction. The user can follow, ignore, or override at every step.

After `/bridge` completes, create the marker so the safety-net hook passes:
```bash
touch "/tmp/claude-bridge-${PPID}-done"
```

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

### 4. Re-evaluate — Consolidate in light of additions

After adding, read the full memory and ask:
- Can any entries now be merged? Two entries sharing common ground become one.
- Is any entry now derivable from others? Retire it.
- Has a new addition revealed the shared prior beneath older entries? Replace them with the prior.

Memory should get *shorter* through consolidation, not just avoid growing. Without this step, memory grows monotonically because the default rewards completeness over minimality.

### 5. Resume snapshot

Write the resume as a cursor — where the project stands right now.

If the project has a `## Resume` section in MEMORY.md, update it there. Otherwise, save to a separate file in the memory directory (e.g., `memory/resume.md`) to preserve previous snapshots as reference.

Contents:
- **Goal**: What we were working on (one line)
- **Status**: Last completed step, next step
- **Pending**: Open decisions, blockers, or things the user asked for
- **Key context**: File paths, branch names, IDs — anything needed to pick up without re-discovery

If the session was exploratory with no resumable task, set: `No active task.`

### 6. Signal completion

Create the marker file so the Stop hook won't fire again this session:

```bash
touch "/tmp/claude-bridge-${PPID}-done"
```

### 7. Done

Brief summary of what was added, updated, or retired — including net change in entry count. The user can then `/clear` to start fresh.

## Anti-patterns

- Adding without checking for duplicates
- Duplicating across levels (one canonical location per fact)
- Documenting speculation (only confirmed patterns)
- Comprehensive description instead of generative ground
- Growing memory session over session — if entry count is rising, consolidation is failing
- Discarding novel signals because they were only mentioned once
- Treating any part of this process as settled — everything here is a projection, refinable through use
