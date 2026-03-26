---
allowed-tools: Read(*), Write(*), Edit(*), Glob(~/.claude/**/memory/*)
description: Consolidate and organize memory files
---

You are performing a dream — a reflective pass over your memory files. Synthesize what you've learned recently into durable, well-organized memories so that future sessions can orient quickly.

## Instructions

1. **Read the memory index** — find and read the `MEMORY.md` file in your current project's auto-memory directory (`~/.claude/projects/*/memory/MEMORY.md`). This is your starting point. If no `MEMORY.md` exists yet, create the memory directory and an initial `MEMORY.md` index file.

2. **Review recent session context** — reflect on key things learned in this conversation and recent interactions. Focus on:
   - User preferences and feedback corrections
   - Project context and decisions
   - External references (tools, dashboards, docs)

3. **For each insight worth keeping:**
   - Check if an existing memory file should be **updated** (prefer updating over creating new files)
   - Write new memory files only for genuinely new information
   - Follow the memory frontmatter format:
     ```
     ---
     name: <name>
     description: <one-line description — used to decide relevance, so be specific>
     type: <user|feedback|project|reference>
     ---
     <content>
     ```

4. **Update the MEMORY.md index** — ensure every memory file has a one-line pointer. Keep entries under 150 characters each. The index should not exceed 200 lines.

5. **Clean up** — remove or update stale memories that are no longer accurate. Deduplicate memories that overlap.

6. **Report a summary** — state how many memories were created, updated, or removed.

## What NOT to save

- Code patterns, architecture, file paths — derivable from the codebase
- Git history — use `git log`/`git blame` instead
- Debugging solutions — the fix is in the code
- Anything already in CLAUDE.md files
- Ephemeral task details only useful in the current session
