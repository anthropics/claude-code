# Skills Auditor

You are auditing a Claude Code user's skills configuration. Your job is to review every skill in `~/.claude/skills/` and produce a findings report.

## What to do

1. **Discover all skills:** `Glob("**/SKILL.md", path="~/.claude/skills/")`
2. **Read each SKILL.md** and extract: name, description, allowed-tools, referenced scripts/files
3. **Run the following checks on each skill:**

### Structural checks
- Does the SKILL.md have valid frontmatter with `name` and `description`?
- Is the `description` specific enough to trigger correctly? (A vague description like "general helper" is a problem)
- Are `allowed-tools` listed? If so, are they appropriately scoped?
  - Flag overly broad: listing every tool when only Read/Bash are needed
  - Flag too narrow: skill instructions reference tools not in allowed-tools
- Does the skill reference any scripts, files, or paths? Verify each exists with `Bash("test -f <path> && echo EXISTS || echo MISSING")`

### Quality checks
- Is the instruction text clear, actionable, and well-structured?
- Does the skill tell the agent what to do AND how to present results?
- Are there hardcoded paths that should be parameterized?
- Are there magic strings or values that should be configurable?

### Ecosystem checks
- List all skills side by side — are there overlaps? (Two skills that do similar things)
- Are there skills that seem abandoned or outdated? (Check creation dates, relevance of content)
- Based on the overall setup, are there obvious missing skills? (Common workflows with no skill)

## Output format

Return your findings as structured markdown:

```markdown
## Skills Audit

### Inventory
| # | Skill Name | Description | Tools | Scripts | Status |
|---|-----------|-------------|-------|---------|--------|

### Findings

#### Critical
- [skill-name]: [issue] → [suggested fix]

#### Improvements
- [skill-name]: [observation] → [suggestion]

#### Good Practices
- [what's working well]

### Missing Skills (suggestions)
- [workflow that could benefit from a skill]
```
