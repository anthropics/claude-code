# Memory Bridge

Structured context consolidation at session boundaries. Prevents knowledge loss across Claude Code sessions.

## The Problem

Claude Code sessions accumulate valuable context — patterns discovered, user preferences expressed, debugging insights, architectural decisions. When the session ends, this knowledge is lost. While `MEMORY.md` and `CLAUDE.md` exist for persistence, there's no structured process to update them. Users either forget or do it inconsistently.

## The Solution

A consolidation cycle: **work → bridge → clear**.

1. You work normally. Context accumulates.
2. When you're done (or the session is getting large), run `/bridge`.
3. Claude reviews the session, consolidates learnings into persistent memory files.
4. You `/clear` to start fresh. The next session loads your updated memory automatically.

## Quick Start

1. Install this plugin in Claude Code
2. Work on your project as usual
3. Before ending your session, run `/bridge`
4. After consolidation, run `/clear` to start fresh

Claude monitors its own context and suggests `/bridge` at natural breakpoints — when learnings are rich, when a task completes, or when focus shifts. A Stop hook warns (never blocks) when context approaches auto-compaction (~1.5MB). The user is always the final decision maker — they can initiate `/bridge` any time, follow or ignore Claude's suggestions, and dismiss the hook warning if they prefer to let auto-compact happen.

## How It Works

The `/bridge` command triggers a 5-step consolidation process:

### 1. Scan
Review the session for new learnings: patterns, preferences, failures, cross-project insights.

### 2. Classify
Route each learning to the appropriate persistence level:

| Level | Location | What belongs here |
|-------|----------|-------------------|
| Project memory | Project's `MEMORY.md` or memory directory | Project state, confirmed project-specific patterns |
| Global config | `~/.claude/CLAUDE.md` | Cross-project principles, user preferences |
| Skill | `~/.claude/skills/<name>/SKILL.md` | Reusable operational procedures |

**Promote** when a pattern appears in 2+ projects or user says "always."
**Retire** when an entry is superseded, contradicted, or promoted to a higher level.

### 3. Act
Write, update, or retire entries. Always check for duplicates first — one canonical location per fact.

### 4. Resume
Write a snapshot to the project's `MEMORY.md` so the next session can pick up without re-discovery:
- **Goal**: What you were working on
- **Status**: Last completed step, next step
- **Pending**: Open decisions or blockers
- **Key context**: File paths, branch names, IDs

### 5. Signal
Create a marker file so the Stop hook knows bridging is done.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BRIDGE_THRESHOLD_KB` | `1500` | Safety-net threshold (KB) — warns when approaching auto-compaction |

Set in your shell profile or `.env`:
```bash
export BRIDGE_THRESHOLD_KB=1200  # adjust safety-net threshold
```

## Components

| Component | File | Purpose |
|-----------|------|---------|
| Command | `commands/bridge.md` | `/bridge` slash command with project context injection |
| Skill | `skills/bridge/SKILL.md` | The consolidation methodology |
| Stop hook | `hooks/stop.py` | Safety net — warns (never blocks) near auto-compaction (~1.5MB) |

## Philosophy

**User agency first.** This plugin builds better tools for users to exercise their agency, not replace it. Every intervention is advisory — the user can always initiate, follow, ignore, or override.

**Consolidate, don't accumulate.** Memory grows stronger over time, not larger. Each bridge pass should result in fewer, more precise entries — not a growing append-only log.

The guiding principle:

> Keep as much as possible that is not already there. Keep as little as possible that is already there.

### Anti-patterns to avoid

- **Adding without checking** — search existing memory before writing
- **Duplicating across levels** — one canonical location per fact
- **Documenting speculation** — only confirmed patterns
- **Comprehensive description** — aim for generative ground (minimal entries that reconstruct understanding)
- **Accumulating over time** — fewer and stronger entries, not more

## How It Integrates

This plugin works with Claude Code's existing memory system:
- **`MEMORY.md`** in your project's `.claude/` directory — loaded into the system prompt each session
- **`~/.claude/CLAUDE.md`** — global instructions loaded for all projects
- **Skills** in `~/.claude/skills/` — reusable procedures available across sessions

The bridge process simply provides structure for maintaining these files.

## Related Issues

- [#18417](https://github.com/anthropics/claude-code/issues/18417) — Session persistence and context continuity
- [#14941](https://github.com/anthropics/claude-code/issues/14941) — Post-compaction behavior loses context
- [#14228](https://github.com/anthropics/claude-code/issues/14228) — Cross-session memory
