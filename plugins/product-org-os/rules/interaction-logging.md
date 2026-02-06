---
globs:
  - "**/*"
---

# Interaction Logging (SELECTIVE)

Log **meaningful agent work** for cross-session continuity. Skip quick lookups and simple Q&A.

---

## Core Rule: Log Meaningful Work Only

**Log when:**
- Agent spawned and produced deliverable or recommendations
- Gateway session with multi-agent synthesis
- Skill created or updated a document

**Skip when:**
- Simple Q&A (no agent spawned)
- Context/feedback recalls with no synthesis
- Quick lookups or explanations
- System operations (`/setup`, `/clear-demo`)
- Failed/cancelled operations

---

## The Quick Test

Before logging, ask: **"Did an agent do meaningful work that should be remembered?"**

- **YES** → Log it
- **NO** → Skip logging

---

## Quick Reference

| Log | Skip |
|-----|------|
| Agent spawns with deliverables | Simple Q&A, greetings |
| Gateway sessions with synthesis | Context recalls (no synthesis) |
| Skills producing documents | System ops |
| Multi-agent strategic discussions | Quick lookups |

---

## Implementation Details

**For full logging implementation (entry format, JSON index, session summary, storage structure), see `agent-spawn-protocol.md` Section 12.**

Key points:
- Entry ID format: `IX-YYYY-NNNNN` (5-digit zero-padded)
- Storage: `context/interactions/YYYY/YYYY-MM-DD.md`
- Index: `context/interactions/index.json`
- Session: `context/interactions/current-session.md`

---

## Operating Principle

> "Log work that matters, skip noise. Cross-session memory is for continuity on meaningful threads, not a transcript of every question."
