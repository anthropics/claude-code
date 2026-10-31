# Command Development Skill

Comprehensive guidance on creating Claude Code slash commands, including file format, frontmatter options, dynamic arguments, and best practices.

## Overview

This skill provides knowledge about:
- Slash command file format and structure
- YAML frontmatter configuration fields
- Dynamic arguments ($ARGUMENTS, $1, $2, etc.)
- File references with @ syntax
- Bash execution with !` syntax
- Command organization and namespacing
- Best practices for command development
- Plugin-specific features (${CLAUDE_PLUGIN_ROOT}, plugin patterns)
- Integration with plugin components (agents, skills, hooks)
- Validation patterns and error handling

## Skill Structure

### SKILL.md (~2,470 words)

Core skill content covering:

**Fundamentals:**
- Command basics and locations
- File format (Markdown with optional frontmatter)
- YAML frontmatter fields overview
- Dynamic arguments ($ARGUMENTS and positional)
- File references (@ syntax)
- Bash execution (!` syntax)
- Command organization patterns
- Best practices and common patterns
- Troubleshooting

**Plugin-Specific:**
- ${CLAUDE_PLUGIN_ROOT} environment variable
- Plugin command discovery and organization
- Plugin command patterns (configuration, template, multi-script)
- Integration with plugin components (agents, skills, hooks)
- Validation patterns (argument, file, resource, error handling)

### References

Detailed documentation:

- **frontmatter-reference.md**: Complete YAML frontmatter field specifications
  - All field descriptions with types and defaults
  - When to use each field
  - Examples and best practices
  - Validation and common errors

- **plugin-features-reference.md**: Plugin-specific command features
  - Plugin command discovery and organization
  - ${CLAUDE_PLUGIN_ROOT} environment variable usage
  - Plugin command patterns (configuration, template, multi-script)
  - Integration with plugin agents, skills, and hooks
  - Validation patterns and error handling

### Examples

Practical command examples:

- **simple-commands.md**: 10 complete command examples
  - Code review commands
  - Testing commands
  - Deployment commands
  - Documentation generators
  - Git integration commands
  - Analysis and research commands

- **plugin-commands.md**: 10 plugin-specific command examples
  - Simple plugin commands with scripts
  - Multi-script workflows
  - Template-based generation
  - Configuration-driven deployment
  - Agent and skill integration
  - Multi-component workflows
  - Validated input commands
  - Environment-aware commands

## When This Skill Triggers

Claude Code activates this skill when users:
- Ask to "create a slash command" or "add a command"
- Need to "write a custom command"
- Want to "define command arguments"
- Ask about "command frontmatter" or YAML configuration
- Need to "organize commands" or use namespacing
- Want to create commands with file references
- Ask about "bash execution in commands"
- Need command development best practices

## Progressive Disclosure

The skill uses progressive disclosure:

1. **SKILL.md** (~2,470 words): Core concepts, common patterns, and plugin features overview
2. **References** (~13,500 words total): Detailed specifications
   - frontmatter-reference.md (~1,200 words)
   - plugin-features-reference.md (~1,800 words)
   - interactive-commands.md (~2,500 words)
   - advanced-workflows.md (~1,700 words)
   - testing-strategies.md (~2,200 words)
   - documentation-patterns.md (~2,000 words)
   - marketplace-considerations.md (~2,200 words)
3. **Examples** (~6,000 words total): Complete working command examples
   - simple-commands.md
   - plugin-commands.md

Claude loads references and examples as needed based on task.

## Command Basics Quick Reference

### File Format

```markdown
---
description: Brief description
argument-hint: [arg1] [arg2]
allowed-tools: Read, Bash(git:*)
---

Command prompt content with:
- Arguments: $1, $2, or $ARGUMENTS
- Files: @path/to/file
- Bash: !`command here`
```

### Locations

- **Project**: `.claude/commands/` (shared with team)
- **Personal**: `~/.claude/commands/` (your commands)
- **Plugin**: `plugin-name/commands/` (plugin-specific)

### Key Features

**Dynamic arguments:**
- `$ARGUMENTS` - All arguments as single string
- `$1`, `$2`, `$3` - Positional arguments

**File references:**
- `@path/to/file` - Include file contents

**Bash execution:**
- `!`command`` - Execute and include output

## Frontmatter Fields Quick Reference

| Field | Purpose | Example |
|-------|---------|---------|
| `description` | Brief description for /help | `"Review code for issues"` |
| `allowed-tools` | Restrict tool access | `Read, Bash(git:*)` |
| `model` | Specify model | `sonnet`, `opus`, `haiku` |
| `argument-hint` | Document arguments | `[pr-number] [priority]` |
| `disable-model-invocation` | Manual-only command | `true` |

## Common Patterns

### Simple Review Command

```markdown
---
description: Review code for issues
---

Review this code for quality and potential bugs.
```

### Command with Arguments

```markdown
---
description: Deploy to environment
argument-hint: [environment] [version]
---

Deploy to $1 environment using version $2
```

### Command with File Reference

```markdown
---
description: Document file
argument-hint: [file-path]
---

Generate documentation for @$1
```

### Command with Bash Execution

```markdown
---
description: Show Git status
allowed-tools: Bash(git:*)
---

Current status: !`git status`
Recent commits: !`git log --oneline -5`
```

## Development Workflow

1. **Design command:**
   - Define purpose and scope
   - Determine required arguments
   - Identify needed tools

2. **Create file:**
   - Choose appropriate location
   - Create `.md` file with command name
   - Write basic prompt

3. **Add frontmatter:**
   - Start minimal (just description)
   - Add fields as needed (allowed-tools, etc.)
   - Document arguments with argument-hint

4. **Test command:**
   - Invoke with `/command-name`
   - Verify arguments work
   - Check bash execution
   - Test file references

5. **Refine:**
   - Improve prompt clarity
   - Handle edge cases
   - Add examples in comments
   - Document requirements

## Best Practices Summary

1. **Single responsibility**: One command, one clear purpose
2. **Clear descriptions**: Make discoverable in `/help`
3. **Document arguments**: Always use argument-hint
4. **Minimal tools**: Use most restrictive allowed-tools
5. **Test thoroughly**: Verify all features work
6. **Add comments**: Explain complex logic
7. **Handle errors**: Consider missing arguments/files

## Status

**Completed enhancements:**
- ✓ Plugin command patterns (${CLAUDE_PLUGIN_ROOT}, discovery, organization)
- ✓ Integration patterns (agents, skills, hooks coordination)
- ✓ Validation patterns (input, file, resource validation, error handling)

**Remaining enhancements (in progress):**
- Advanced workflows (multi-step command sequences)
- Testing strategies (how to test commands effectively)
- Documentation patterns (command documentation best practices)
- Marketplace considerations (publishing and distribution)

## Maintenance

To update this skill:
1. Keep SKILL.md focused on core fundamentals
2. Move detailed specifications to references/
3. Add new examples/ for different use cases
4. Update frontmatter when new fields added
5. Ensure imperative/infinitive form throughout
6. Test examples work with current Claude Code

## Version History

**v0.1.0** (2025-01-15):
- Initial release with basic command fundamentals
- Frontmatter field reference
- 10 simple command examples
- Ready for plugin-specific pattern additions
