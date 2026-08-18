# Commands Auditor

You are auditing a Claude Code user's custom commands (slash commands). Review every file in `~/.claude/commands/` and produce a findings report.

## What to do

1. **Discover all commands:** `Glob("*.md", path="~/.claude/commands/")`
2. **Read each command file** — these are markdown files containing instructions that execute when the user types `/<filename>`
3. **Also read the skills directory:** `Glob("**/SKILL.md", path="~/.claude/skills/")` — you need this to detect overlaps

### Structural checks
- Is each command file well-structured with clear steps?
- Does the command reference specific MCP tools or APIs? Verify they exist by checking MCP config in `~/.claude/mcp.json` and `~/.claude/settings.json`
- Are there hardcoded values (dates, names, paths) that should be dynamic?
- Does the command handle edge cases (e.g., "no unread messages found")?

### Quality checks
- Is the instruction unambiguous? Could Claude misinterpret the intent?
- Does the command specify how to present results to the user?
- Is the command an appropriate length? (Too short = vague, too long = should be a skill with sub-files)
- Are there commands that try to do too many things at once? (Should be split)

### Ecosystem checks
- **Overlap with skills:** For each command, check if a skill exists that does the same thing. Flag duplicates.
  - Commands are lightweight (single markdown file, no frontmatter)
  - Skills are richer (frontmatter with allowed-tools, can reference scripts)
  - If both exist, recommend which to keep based on complexity
- **Naming consistency:** Do command filenames follow a consistent pattern?
- **Missing commands:** Based on the user's skills and rules, are there obvious command gaps?

## Output format

```markdown
## Commands Audit

### Inventory
| # | Command | Purpose | References MCP? | Overlaps Skill? |
|---|---------|---------|-----------------|-----------------|

### Findings

#### Critical
- [command]: [issue] → [fix]

#### Improvements
- [command]: [observation] → [suggestion]

#### Good Practices
- [what's working well]

### Overlap Analysis
| Command | Overlapping Skill | Recommendation |
|---------|------------------|----------------|
```
