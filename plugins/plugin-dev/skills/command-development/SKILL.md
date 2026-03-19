---
name: Command Development
description: This skill should be used when the user asks to "create a slash command", "add a command", "write a custom command", "define command arguments", "use command frontmatter", "organize commands", "create command with file references", "interactive command", "use AskUserQuestion in command", or needs guidance on slash command structure, YAML frontmatter fields, dynamic arguments, bash execution in commands, user interaction patterns, or command development best practices for Claude Code.
version: 0.2.0
---

# Command Development for Claude Code

## Overview

Slash commands are frequently-used prompts defined as Markdown files that Claude executes during interactive sessions. Understanding command structure, frontmatter options, and dynamic features enables creating powerful, reusable workflows.

**Key concepts:**

- Markdown file format for commands
- YAML frontmatter for configuration
- Dynamic arguments and file references
- Bash execution for context
- Command organization and namespacing

## Command Basics

### What is a Slash Command?

A slash command is a Markdown file containing a prompt that Claude executes when invoked. Commands provide:

- **Reusability**: Define once, use repeatedly
- **Consistency**: Standardize common workflows
- **Sharing**: Distribute across team or projects
- **Efficiency**: Quick access to complex prompts

### Critical: Commands are Instructions FOR Claude

**Commands are written for agent consumption, not human consumption.**

When a user invokes `/command-name`, the command content becomes Claude's instructions. Write commands as directives TO Claude about what to do, not as messages TO the user.

**Correct approach (instructions for Claude):**

```markdown
Review this code for security vulnerabilities including:
- SQL injection
- XSS attacks
- Authentication issues

Provide specific line numbers and severity ratings.
```

**Incorrect approach (messages to user):**

```markdown
This command will review your code for security issues.
You'll receive a report with vulnerability details.
```

The first example tells Claude what to do. The second tells the user what will happen but doesn't instruct Claude. Always use the first approach.

### Command Locations

**Project commands** (shared with team):

- Location: `.claude/commands/`
- Scope: Available in specific project
- Label: Shown as "(project)" in `/help`
- Use for: Team workflows, project-specific tasks

**Personal commands** (available everywhere):

- Location: `~/.claude/commands/`
- Scope: Available in all projects
- Label: Shown as "(user)" in `/help`
- Use for: Personal workflows, cross-project utilities

**Plugin commands** (bundled with plugins):

- Location: `plugin-name/commands/`
- Scope: Available when plugin installed
- Label: Shown as "(plugin-name)" in `/help`
- Use for: Plugin-specific functionality

## File Format

### Basic Structure

Commands are Markdown files with `.md` extension:

```
.claude/commands/
├── review.md           # /review command
├── test.md             # /test command
└── deploy.md           # /deploy command
```

**Simple command:**

```markdown
Review this code for security vulnerabilities including:
- SQL injection
- XSS attacks
- Authentication bypass
- Insecure data handling
```

No frontmatter needed for basic commands.

### With YAML Frontmatter

Add configuration using YAML frontmatter:

```markdown
---
description: Review code for security issues
allowed-tools: Read, Grep, Bash(git:*)
model: sonnet
---

Review this code for security vulnerabilities...
```

## YAML Frontmatter Fields

### description

**Purpose:** Brief description shown in `/help`
**Type:** String
**Default:** First line of command prompt

```yaml
---
description: Review pull request for code quality
---
```

**Best practice:** Clear, actionable description (under 60 characters)

### allowed-tools

**Purpose:** Specify which tools command can use
**Type:** String or Array
**Default:** Inherits from conversation

```yaml
---
allowed-tools: Read, Write, Edit, Bash(git:*)
---
```

**Patterns:**

- `Read, Write, Edit` - Specific tools
- `Bash(git:*)` - Bash with git commands only
- `*` - All tools (rarely needed)

**Use when:** Command requires specific tool access

### model

**Purpose:** Specify model for command execution
**Type:** String (sonnet, opus, haiku)
**Default:** Inherits from conversation

```yaml
---
model: haiku
---
```

**Use cases:**

- `haiku` - Fast, simple commands
- `sonnet` - Standard workflows
- `opus` - Complex analysis

### argument-hint

**Purpose:** Document expected arguments for autocomplete
**Type:** String
**Default:** None

```yaml
---
argument-hint: [pr-number] [priority] [assignee]
---
```

**Benefits:**

- Helps users understand command arguments
- Improves command discovery
- Documents command interface

### disable-model-invocation

**Purpose:** Prevent SlashCommand tool from programmatically calling command
**Type:** Boolean
**Default:** false

```yaml
---
disable-model-invocation: true
---
```

**Use when:** Command should only be manually invoked

## Dynamic Arguments

### Using $ARGUMENTS

Capture all arguments as single string:

```markdown
---
description: Fix issue by number
argument-hint: [issue-number]
---

Fix issue #$ARGUMENTS following our coding standards and best practices.
```

**Usage:**

```
> /fix-issue 123
> /fix-issue 456
```

**Expands to:**

```
Fix issue #123 following our coding standards...
Fix issue #456 following our coding standards...
```

### Using Positional Arguments

Capture individual arguments with `$1`, `$2`, `$3`, etc.:

```markdown
---
description: Review PR with priority and assignee
argument-hint: [pr-number] [priority] [assignee]
---

Review pull request #$1 with priority level $2.
After review, assign to $3 for follow-up.
```

**Usage:**

```
> /review-pr 123 high alice
```

**Expands to:**

```
Review pull request #123 with priority level high.
After review, assign to alice for follow-up.
```

### Combining Arguments

Mix positional and remaining arguments:

```markdown
Deploy $1 to $2 environment with options: $3
```

**Usage:**

```
> /deploy api staging --force --skip-tests
```

**Expands to:**

```
Deploy api to staging environment with options: --force --skip-tests
```

## File References

### Using @ Syntax

Include file contents in command:

```markdown
---
description: Review specific file
argument-hint: [file-path]
---

Review @$1 for:
- Code quality
- Best practices
- Potential bugs
```

**Usage:**

```
> /review-file src/api/users.ts
```

**Effect:** Claude reads `src/api/users.ts` before processing command

### Multiple File References

Reference multiple files:

```markdown
Compare @src/old-version.js with @src/new-version.js

Identify:
- Breaking changes
- New features
- Bug fixes
```

### Static File References

Reference known files without arguments:

```markdown
Review @package.json and @tsconfig.json for consistency

Ensure:
- TypeScript version matches
- Dependencies are aligned
- Build configuration is correct
```

## Bash Execution in Commands

Commands can execute bash commands inline to dynamically gather context before Claude processes the command. This is useful for including repository state, environment information, or project-specific context.

**When to use:**

- Include dynamic context (git status, environment vars, etc.)
- Gather project/repository state
- Build context-aware workflows

**Implementation details:**
For complete syntax, examples, and best practices, see `references/plugin-features-reference.md` section on bash execution. The reference includes the exact syntax and multiple working examples to avoid execution issues

## Command Organization

### Flat Structure

Simple organization for small command sets:

```
.claude/commands/
├── build.md
├── test.md
├── deploy.md
├── review.md
└── docs.md
```

**Use when:** 5-15 commands, no clear categories

### Namespaced Structure

Organize commands in subdirectories:

```
.claude/commands/
├── ci/
│   ├── build.md        # /build (project:ci)
│   ├── test.md         # /test (project:ci)
│   └── lint.md         # /lint (project:ci)
├── git/
│   ├── commit.md       # /commit (project:git)
│   └── pr.md           # /pr (project:git)
└── docs/
    ├── generate.md     # /generate (project:docs)
    └── publish.md      # /publish (project:docs)
```

**Benefits:**

- Logical grouping by category
- Namespace shown in `/help`
- Easier to find related commands

**Use when:** 15+ commands, clear categories

## Best Practices

### Command Design

1. **Single responsibility:** One command, one task
2. **Clear descriptions:** Self-explanatory in `/help`
3. **Explicit dependencies:** Use `allowed-tools` when needed
4. **Document arguments:** Always provide `argument-hint`
5. **Consistent naming:** Use verb-noun pattern (review-pr, fix-issue)

### Argument Handling

1. **Validate arguments:** Check for required arguments in prompt
2. **Provide defaults:** Suggest defaults when arguments missing
3. **Document format:** Explain expected argument format
4. **Handle edge cases:** Consider missing or invalid arguments

```markdown
---
argument-hint: [pr-number]
---

$IF($1,
  Review PR #$1,
  Please provide a PR number. Usage: /review-pr [number]
)
```

### File References

1. **Explicit paths:** Use clear file paths
2. **Check existence:** Handle missing files gracefully
3. **Relative paths:** Use project-relative paths
4. **Glob support:** Consider using Glob tool for patterns

### Bash Commands

1. **Limit scope:** Use `Bash(git:*)` not `Bash(*)`
2. **Safe commands:** Avoid destructive operations
3. **Handle errors:** Consider command failures
4. **Keep fast:** Long-running commands slow invocation

### Documentation

1. **Add comments:** Explain complex logic
2. **Provide examples:** Show usage in comments
3. **List requirements:** Document dependencies
4. **Version commands:** Note breaking changes

## Common Patterns

### Review Pattern

```markdown
---
description: Review code changes
allowed-tools: Read, Bash(git:*)
---

Files changed: `git diff --name-only`

Review each file for code quality, bugs, test coverage, documentation needs.
```

### Testing Pattern

```markdown
---
description: Run tests for specific file
argument-hint: [test-file]
allowed-tools: Bash(npm:*)
---

Run tests: `npm test $1`
Analyze results and suggest fixes for failures.
```

### Workflow Pattern

```markdown
---
description: Complete PR workflow
argument-hint: [pr-number]
allowed-tools: Bash(gh:*), Read
---

PR #$1 Workflow:
1. Fetch PR: `gh pr view $1`
2. Review changes
3. Run checks
4. Approve or request changes
```

## Troubleshooting

**Command not appearing:**

- Check file is in correct directory
- Verify `.md` extension present
- Ensure valid Markdown format
- Restart Claude Code

**Arguments not working:**

- Verify `$1`, `$2` syntax correct
- Check `argument-hint` matches usage
- Ensure no extra spaces

**Bash execution failing:**

- Check `allowed-tools` includes Bash
- Verify command syntax in backticks
- Test command in terminal first
- Check for required permissions

**File references not working:**

- Verify `@` syntax correct
- Check file path is valid
- Ensure Read tool allowed
- Use absolute or project-relative paths

## Plugin-Specific Features

### CLAUDE_PLUGIN_ROOT Variable

Plugin commands have access to `${CLAUDE_PLUGIN_ROOT}`, an environment variable that resolves to the plugin's absolute path.

**Purpose:**

- Reference plugin files portably
- Execute plugin scripts
- Load plugin configuration
- Access plugin templates

**Basic usage:**

```markdown
---
description: Analyze using plugin script
allowed-tools: Bash(node:*)
---

Run analysis: `node ${CLAUDE_PLUGIN_ROOT}/scripts/analyze.js $1`

Review results and report findings.
```

**Common patterns:**

```markdown
# Execute plugin script
`bash ${CLAUDE_PLUGIN_ROOT}/scripts/script.sh`

# Load plugin configuration
@${CLAUDE_PLUGIN_ROOT}/config/settings.json

# Use plugin template
@${CLAUDE_PLUGIN_ROOT}/templates/report.md

# Access plugin resources
@${CLAUDE_PLUGIN_ROOT}/docs/reference.md
```

**Why use it:**

- Works across all installations
- Portable between systems
- No hardcoded paths needed
- Essential for multi-file plugins

### Plugin Command Organization

Plugin commands discovered automatically from `commands/` directory:

```
plugin-name/
├── commands/
│   ├── foo.md              # /foo (plugin:plugin-name)
│   ├── bar.md              # /bar (plugin:plugin-name)
│   └── utils/
│       └── helper.md       # /helper (plugin:plugin-name:utils)
└── plugin.json
```

**Namespace benefits:**

- Logical command grouping
- Shown in `/help` output
- Avoid name conflicts
- Organize related commands

**Naming conventions:**

- Use descriptive action names
- Avoid generic names (test, run)
- Consider plugin-specific prefix
- Use hyphens for multi-word names

### Plugin Command Patterns

**Configuration-based pattern:**

```markdown
---
description: Deploy using plugin configuration
argument-hint: [environment]
allowed-tools: Read, Bash(*)
---

Load configuration: @${CLAUDE_PLUGIN_ROOT}/config/$1-deploy.json

Deploy to $1 using configuration settings.
Monitor deployment and report status.
```

**Template-based pattern:**

```markdown
---
description: Generate docs from template
argument-hint: [component]
---

Template: @${CLAUDE_PLUGIN_ROOT}/templates/docs.md

Generate documentation for $1 following template structure.
```

**Multi-script pattern:**

```markdown
---
description: Complete build workflow
allowed-tools: Bash(*)
---

Build: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/build.sh`
Test: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/test.sh`
Package: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/package.sh`

Review outputs and report workflow status.
```

**See `references/plugin-features-reference.md` for detailed patterns.**

## Integration with Plugin Components

Commands integrate with other plugin components for powerful workflows:

- **Agents**: Launch plugin agents for complex tasks (agent must exist in `plugin/agents/`)
- **Skills**: Leverage plugin skills for specialized knowledge (mention skill name to trigger)
- **Hooks**: Coordinate with hooks that execute on tool events
- **Multi-component**: Combine agents, skills, and scripts in phased workflows

**See `references/plugin-integration.md` for detailed patterns and examples.**

## Validation Patterns

Commands should validate inputs and resources before processing:

- **Argument validation**: Check required arguments match expected values
- **File existence**: Verify files exist before processing
- **Plugin resources**: Validate scripts and configs are present
- **Error handling**: Capture failures and provide helpful messages

**Best practices:** Validate early, provide helpful errors, suggest corrections.

**See `references/plugin-integration.md` for validation examples.**

---

## Additional Resources

For detailed frontmatter field specifications, see `references/frontmatter-reference.md`.
For plugin-specific features and patterns, see `references/plugin-features-reference.md`.
For plugin integration and validation patterns, see `references/plugin-integration.md`.
For interactive user input patterns using AskUserQuestion, see `references/interactive-commands.md`.
For multi-step command sequences and state management, see `references/advanced-workflows.md`.
For self-documenting command patterns and maintenance docs, see `references/documentation-patterns.md`.
For testing approaches from syntax validation to user acceptance, see `references/testing-strategies.md`.
For distribution guidelines and quality standards, see `references/marketplace-considerations.md`.
For command pattern examples, see `examples/` directory.
