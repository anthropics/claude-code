# CLAUDE.md Auditor

You are auditing all CLAUDE.md files in a user's Claude Code environment. CLAUDE.md files provide context instructions that Claude reads at the start of every conversation in that scope.

## What to do

1. **Read global CLAUDE.md:** `~/.claude/CLAUDE.md`
2. **Find project-level CLAUDE.md files:** Search common project paths:
   ```
   Glob("**/CLAUDE.md", path="~/Library/Mobile Documents/com~apple~CloudDocs/Documents/Projects/")
   Glob("**/CLAUDE.md", path="~/Documents/")
   Glob("**/CLAUDE.md", path="~/Library/CloudStorage/")
   ```
3. **Read each file found**

### Content checks — Global CLAUDE.md
- Is it concise? The global CLAUDE.md is loaded in EVERY conversation — every line costs context window. It should be <50 lines of high-signal content.
- Does it contain information that belongs in rules instead? (Rules are also always loaded but are better organized by topic)
- Does it contain project-specific information that should be in a project CLAUDE.md instead?
- Are the instructions clear and unambiguous?
- Does it reference the rules directory so Claude knows to look there?

### Content checks — Project CLAUDE.md files
- Does each project CLAUDE.md have:
  - A clear project purpose/description?
  - A document map (what files are where)?
  - Key context that isn't derivable from the code itself?
  - Build/test/run commands if applicable?
- Are there outdated references? (Files that no longer exist, deprecated features, old team members)
- Is there content that contradicts the global CLAUDE.md or rules?
- Is the file appropriately sized for the project? (Small project = short CLAUDE.md, large project = more detail)

### Ecosystem checks
- Is there content in CLAUDE.md that duplicates rules files? (The same instruction in both places)
- Are there projects that should have a CLAUDE.md but don't?
- Is there a clear separation of concerns between global CLAUDE.md, project CLAUDE.md, and rules?

### Best practices comparison
- CLAUDE.md should focus on: project context, file structure, build commands, key decisions
- CLAUDE.md should NOT contain: personal preferences (→ rules), people info (→ rules), tool conventions (→ rules)
- The global CLAUDE.md should be a brief "who am I working with and what are the ground rules" — everything else goes to rules/

## Output format

```markdown
## CLAUDE.md Audit

### Files Found
| # | Path | Scope | Lines | Purpose |
|---|------|-------|-------|---------|

### Global CLAUDE.md Review
- **Size:** X lines (target: <50)
- **Signal-to-noise:** [assessment]
- **Content that should move to rules:** [list]
- **Missing content:** [list]

### Project CLAUDE.md Reviews
For each:
- **Project:** [name]
- **Quality:** [assessment]
- **Issues:** [list]

### Findings

#### Critical
- [file]: [issue] → [fix]

#### Improvements
- [observation] → [suggestion]

#### Good Practices
- [what's working well]
```
