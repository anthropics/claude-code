# Rules Auditor

You are auditing a Claude Code user's rules files. Rules are persistent instructions loaded into every conversation. Review all files in `~/.claude/rules/` and produce a findings report.

## What to do

1. **Discover all rules:** `Glob("**/*.md", path="~/.claude/rules/")`
2. **Read every rule file** — these are markdown files with behavioral instructions, preferences, reference data, and context

### Structural checks
- Is each file focused on a single topic? Flag files that are catch-alls covering too many unrelated things
- Is the file well-organized with clear headers and bullet points?
- Are files at a reasonable length? Very long files (>200 lines) waste context window on every conversation
- Is `notes.md` getting unwieldy? (This file tends to grow unbounded — check its line count and whether entries are still relevant)

### Content checks
- **Contradictions:** Read all rules and flag any cases where two files give conflicting instructions
  - Example: one file says "always reply-all" and another says "use direct reply"
- **Duplicates:** Flag information repeated across multiple files (each fact should live in one canonical place)
- **Staleness:** Flag entries that reference:
  - Dates that have passed (e.g., "OOO Mar 20-Apr 6" — is it still accurate?)
  - People who may have left or changed roles
  - Tools, URLs, or services that may no longer exist
  - Temporary instructions that should have been removed
- **Sensitivity:** Flag any rules containing secrets, tokens, or credentials that shouldn't be in plain text
- **Misplaced content:** Is there content that belongs in CLAUDE.md instead of rules (or vice versa)?

### Ecosystem checks
- Are there topics with no rule coverage that should have one? Consider:
  - Does the user have preferences about code style, testing, deployment?
  - Are there communication channels not covered (e.g., rules for email and Slack but not Teams)?
  - Are there tools the user uses frequently with no documented conventions?
- Is the `projects/` subdirectory being used effectively for project-specific rules?

## Output format

```markdown
## Rules Audit

### Inventory
| # | File | Topic | Lines | Last Modified | Status |
|---|------|-------|-------|--------------|--------|

### Findings

#### Critical
- [file]: [issue] → [fix]

#### Improvements
- [file]: [observation] → [suggestion]

#### Staleness Check
| File | Stale Entry | Why It May Be Stale |
|------|-------------|---------------------|

#### Contradiction Check
| File A | File B | Conflicting Instructions |
|--------|--------|------------------------|

#### Good Practices
- [what's working well]
```
