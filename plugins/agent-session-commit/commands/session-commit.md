---
description: Capture learnings from the current session and update AGENTS.md
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - LS
---

# Session Commit

Analyze the current conversation to extract valuable learnings and update the project's AGENTS.md file.

## Instructions

### Step 1: Check for AGENTS.md

First, check if `AGENTS.md` exists in the project root.

**If AGENTS.md is missing**, initialize it:
1. Analyze the project structure (package.json, pyproject.toml, Cargo.toml, etc.)
2. Create `AGENTS.md` with:
   - Project name and brief description
   - Key directories and their purposes
   - Tech stack and dependencies
   - Any patterns you've observed during this session
   - Development workflow (build, test, lint commands)

**If AGENTS.md exists**, read it to understand current content.

### Step 2: Analyze Session Learnings

Review the conversation for:
- Coding patterns and preferences discovered
- Architecture decisions made
- Gotchas or pitfalls encountered
- Project conventions established
- Debugging insights
- Workflow preferences

### Step 3: Propose Updates

Present specific additions/updates to the user:
- Group by category (patterns, conventions, architecture, etc.)
- Be concise - capture actionable guidance, not verbose explanations
- Format as bullet points
- Focus on learnings that help ANY AI assistant, not just Claude

### Step 4: Apply Changes

After user approval:
- Update AGENTS.md with the approved content
- Merge with existing content appropriately

### Step 5: Ensure CLAUDE.md Exists

Check if `CLAUDE.md` exists. If missing or different, create/update it with:

```markdown
# CLAUDE.md

⚠️ This file is intentionally minimal.

**Authoritative project instructions live in `AGENTS.md`.**

You must:

1. Open and follow `AGENTS.md` before doing any work.
2. Treat `AGENTS.md` as the single source of truth for all operations.
3. Update `AGENTS.md` (not this file) when guidelines/architecture/standards change.

➡️ Read now: [AGENTS.md](./AGENTS.md)
```

## Tips

- If no meaningful learnings in this session, say so - don't force updates
- Prefer bullet points over paragraphs in AGENTS.md
- Include specific file paths when referencing project structure
- Avoid duplicating information already in AGENTS.md
