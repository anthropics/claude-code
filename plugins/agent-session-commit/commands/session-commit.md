---
description: Capture learnings from the current session and update AGENTS.md
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Session Commit

Analyze the current conversation to extract valuable learnings and update the project's AGENTS.md file.

## Instructions

1. **Analyze the session** for:
   - Coding patterns and preferences discovered
   - Architecture decisions made
   - Gotchas or pitfalls encountered
   - Project conventions established
   - Debugging insights
   - Workflow preferences

2. **Read existing AGENTS.md** (or note if missing):
   - Check for `AGENTS.md` in the project root
   - Understand current structure and content
   - Identify where new learnings fit

3. **Propose additions**:
   - Present specific additions/updates to the user
   - Group by category (patterns, conventions, architecture, etc.)
   - Be concise - capture the essence, not verbose explanations
   - Format as actionable guidance for future AI assistants

4. **Apply changes** after user approval:
   - Update AGENTS.md with the approved content
   - Create AGENTS.md if it doesn't exist

5. **Ensure CLAUDE.md exists** with minimal pointer content:

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

- Focus on learnings that would help ANY AI assistant, not just Claude
- Prefer bullet points over paragraphs
- Include specific file paths when referencing project structure
- Avoid duplicating information already in AGENTS.md
