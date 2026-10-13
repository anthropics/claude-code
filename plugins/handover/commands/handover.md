---
description: Export session context to a handover file for another Claude session or LLM
argument-hint: [--llm]
allowed-tools: Write
---

## Session Snapshot

- **Date/Time:** !`date '+%Y-%m-%d %H:%M:%S'`
- **Directory:** !`pwd`
- **Branch:** !`git branch --show-current 2>/dev/null || echo "(not a git repo)"`
- **Git status:** !`git status --short 2>/dev/null || echo "(clean)"`
- **Recent commits:**
  !`git log --oneline -8 2>/dev/null || echo "(no commits)"`
- **Uncommitted diff stat:**
  !`git diff HEAD --stat 2>/dev/null || echo "(none)"`

## Your Task

Arguments: `$ARGUMENTS`

Synthesize this entire conversation into a handover document and write it to a file in the current working directory.

### Step 1 — Choose format

- If `$ARGUMENTS` contains `--llm`: use **LLM format** (compact, structured for pasting as an opening message to another AI)
- Otherwise: use **human format** (rich markdown, for a person or a new Claude Code session picking up the work)

### Step 2 — Determine filename

Derive today's date from the Date/Time in the snapshot above.

- Human format filename: `handover-YYYY-MM-DD.md`
- LLM format filename: `handover-YYYY-MM-DD-llm.md`

### Step 3 — Synthesize from the conversation

Reflect on every message in this session and extract:

1. **What we were working on** — the main goal or task of this session
2. **Accomplished** — work that is complete or in a solid, usable state
3. **Key decisions** — design, architecture, or approach choices made (include the rationale for each)
4. **Files touched** — files created or modified during the session, enriched with the git diff stat from the snapshot
5. **Next steps** — remaining work, ordered by priority
6. **Open questions / blockers** — anything unresolved or requiring a decision before work can continue

### Step 4 — Write the file

**Human format** — write a markdown document with these sections:

- Title: `# Session Handover — {date}`
- **Project Context**: directory, branch, git status (clean or list of changed files)
- **Recent Commits**: the last 8 commits from the snapshot, one per line
- **What We Were Working On**: 2–4 sentence narrative summary of the session goal and starting context
- **Accomplished**: bullet list of completed work items
- **Key Decisions**: bullet list, each formatted as `Decision → rationale`
- **Files Touched This Session**: combined list from conversation + git diff stat from the snapshot
- **Next Steps**: numbered list in priority order
- **Open Questions / Blockers**: bullet list, or the single word "None" if everything is clear
- **Handoff Notes**: any gotchas, important caveats, or non-obvious context that the next person or session needs to know

**LLM format** — write a compact context block with these sections:

- Title: `# Handover Context`
- Opening line: `You are continuing a coding session. Current state:`
- **Project line** (single line): `{directory name} | Branch: {branch} | As of: {date}`
- **Task**: 1–2 sentence description of the main goal
- **Status**: two-part brief list — Done items, then Pending items
- **Key Decisions**: bullet list with each decision and its rationale on one line
- **Active Files**: comma-separated list of the key files in play
- **Next Action**: the single most important next step to take
- **Blockers**: omit this section entirely if there are none
- **Git Context**: branch name, last 5 commits (one per line), uncommitted changes summary or "none"

### Step 5 — Confirm

After writing the file, output to the user:

1. The filename that was created
2. One sentence summarizing what was captured
3. Usage tip: "Paste the contents of `{filename}` as your opening message in the next Claude session to resume with full context."
