---
description: Initialize CLAUDE.md with skill-aware codebase analysis (checks for available Skills before file exploration)
---

## Your Task

Analyze this codebase to create or update a comprehensive CLAUDE.md file that provides project context. **IMPORTANT:** Check for available Skills first before manually exploring files.

**Related:** This addresses GitHub issue [#11661](https://github.com/anthropics/claude-code/issues/11661) - using Skills before manual file exploration.

## Analysis Workflow

### Phase 1: Check for Available Skills (PRIORITY)

**Before exploring any files manually**, check if any Skills provide organized project knowledge:

1. **List available Skills** in the current project:
   ```bash
   # Check for project skills
   if [ -d .claude/skills ]; then
     echo "=== Project Skills Available ==="
     find .claude/skills -name "SKILL.md" -type f | sed 's|.claude/skills/||' | sed 's|/SKILL.md||'
   else
     echo "No project skills found in .claude/skills/"
   fi
   ```

2. **Check global skills**:
   ```bash
   # Check for global skills
   if [ -d ~/.claude/skills ]; then
     echo ""
     echo "=== Global Skills Available ==="
     find ~/.claude/skills -name "SKILL.md" -type f | sed 's|'$HOME'/.claude/skills/||' | sed 's|/SKILL.md||'
   else
     echo "No global skills found in ~/.claude/skills/"
   fi
   ```

3. **If Skills are found**: Use them by invoking the Skill tool with each discovered skill name
   - Skills provide pre-synthesized project knowledge
   - They're specifically designed for understanding architecture and context
   - This is more efficient than reading files individually

4. **If no Skills are found**: Proceed to Phase 2 for manual exploration

### Phase 2: Manual Codebase Exploration (Fallback)

**Only use this phase if no relevant Skills were found in Phase 1.**

#### Step 1: Understand Project Structure

```bash
# Get high-level directory structure
echo "=== Project Structure ==="
tree -L 2 -d -I 'node_modules|venv|.git|__pycache__|dist|build' 2>/dev/null || find . -maxdepth 2 -type d -not -path '*/\.*' -not -path '*/node_modules/*' -not -path '*/venv/*' | head -20

echo ""
echo "=== File Count by Type ==="
find . -type f -not -path '*/\.*' -not -path '*/node_modules/*' -not -path '*/venv/*' 2>/dev/null | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -10
```

#### Step 2: Identify Core Files

```bash
# Find README and documentation
echo "=== Documentation Files ==="
find . -maxdepth 3 -type f \( -name "README*" -o -name "CONTRIBUTING*" -o -name "ARCHITECTURE*" \) -not -path '*/node_modules/*' 2>/dev/null

# Find package/dependency files
echo ""
echo "=== Package Configuration ==="
find . -maxdepth 3 -type f \( -name "package.json" -o -name "pyproject.toml" -o -name "Cargo.toml" -o -name "go.mod" -o -name "pom.xml" -o -name "build.gradle" \) 2>/dev/null
```

#### Step 3: Read Key Files

Read and analyze (in this priority order):
1. README.md or README.rst
2. package.json / pyproject.toml / Cargo.toml / go.mod (for dependencies)
3. CONTRIBUTING.md or ARCHITECTURE.md (if exists)
4. Main entry points (e.g., src/main.*, src/index.*, main.py)

#### Step 4: Analyze Code Structure

```bash
# Find main source directories
echo "=== Source Code Organization ==="
find . -type d \( -name "src" -o -name "lib" -o -name "pkg" -o -name "app" \) -not -path '*/node_modules/*' -not -path '*/venv/*' -maxdepth 3 2>/dev/null

# Identify test directories
echo ""
echo "=== Test Organization ==="
find . -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "spec" \) -not -path '*/node_modules/*' -maxdepth 3 2>/dev/null
```

### Phase 3: Generate CLAUDE.md

Create a comprehensive CLAUDE.md with these sections:

```markdown
# Project Context for Claude Code

## Project Overview
[Brief description of what this project does]

## Technology Stack
[Languages, frameworks, key dependencies]

## Project Structure
[Directory organization and key modules]

## Development Workflow
[Common commands, build process, testing]

## Architecture
[High-level architecture decisions, patterns used]

## Key Files and Their Purpose
[Important files and what they do]

## Common Tasks
[Frequent development operations]

## Conventions
[Code style, naming conventions, patterns]

## External Dependencies
[Key libraries and their purposes]

## Notes for Claude Code
[Specific guidance for AI assistance - e.g., "always run tests before committing"]
```

## Key Differences from Standard /init

1. **Skills-First Approach**: Checks for and uses Skills before manual exploration
2. **More Efficient**: Leverages pre-synthesized knowledge when available
3. **Better Context**: Skills are specifically designed for project context
4. **Fallback Support**: Still explores manually if no Skills exist

## Expected Behavior

### If Skills Are Found:
1. Discover available Skills
2. Invoke relevant Skills to gather project knowledge
3. Synthesize information from Skills into CLAUDE.md
4. Supplement with targeted file reads only for gaps

### If No Skills Are Found:
1. Report that no Skills were discovered
2. Fall back to systematic file exploration
3. Read key documentation and configuration files
4. Analyze project structure and dependencies
5. Generate CLAUDE.md from gathered information

## Success Criteria

- [ ] Checked for Skills before exploring files
- [ ] Used available Skills if found (or reported none exist)
- [ ] Created/updated CLAUDE.md with comprehensive context
- [ ] Included project structure, tech stack, and workflows
- [ ] Documented common tasks and conventions
- [ ] Added AI-specific guidance in "Notes for Claude Code" section

## Why This Approach Is Better

**From GitHub issue #11661:**

> Skills align with Anthropic's documented use cases:
> - "Execute company-specific data analysis workflows"
> - "Automate personal workflows and customize Claude to match your work style"
>
> The `/init` task (understanding architecture, identifying common commands, synthesizing documentation)
> directly matches what project-specific Skills are designed to provide.

Using Skills first:
- ✅ More efficient context usage
- ✅ Faster analysis
- ✅ Leverages pre-synthesized knowledge
- ✅ Better alignment with Skills' intended purpose
