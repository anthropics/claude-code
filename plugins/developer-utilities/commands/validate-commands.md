---
description: Validate slash command files, check for errors, and verify they will work after restart
---

## What This Command Does

This command helps you develop and debug slash commands by:
- Validating command file structure
- Checking for common syntax errors
- Listing all available commands
- Showing which commands will work after restart

**Note on Command Reloading:**
This command cannot actually reload commands into the current session - that requires changes to the Claude Code CLI itself. See GitHub issue [#11632](https://github.com/anthropics/claude-code/issues/11632).

After validating your commands, you must restart Claude Code for changes to take effect.

## Validation Steps

### Step 1: List Available Commands

Show project commands:

```bash
find .claude/commands/ -name "*.md" -type f 2>/dev/null | sed 's|.claude/commands/||' | sed 's|.md$||' | sed 's|^|/|' | sort || echo "No project commands found"
```

Show global commands:

```bash
find ~/.claude/commands/ -name "*.md" -type f 2>/dev/null | sed 's|.*/||' | sed 's|.md$||' | sed 's|^|/|' | sort || echo "No global commands found"
```

## Step 2: Validate Command Files

Check for commands with invalid frontmatter:

```bash
find .claude/commands/ -name "*.md" -type f 2>/dev/null -exec sh -c 'file="{}"; if ! head -1 "$file" | grep -q "^---$"; then echo "❌ Missing frontmatter: $file"; fi' \;
```

```bash
find ~/.claude/commands/ -name "*.md" -type f 2>/dev/null -exec sh -c 'file="{}"; if ! head -1 "$file" | grep -q "^---$"; then echo "❌ Missing frontmatter: $file"; fi' \;
```

Check for commands missing description:

```bash
find .claude/commands/ -name "*.md" -type f 2>/dev/null -exec sh -c 'file="{}"; if ! head -10 "$file" | grep -q "description:"; then echo "⚠️  No description: $file"; fi' \;
```

```bash
find ~/.claude/commands/ -name "*.md" -type f 2>/dev/null -exec sh -c 'file="{}"; if ! head -10 "$file" | grep -q "description:"; then echo "⚠️  No description: $file"; fi' \;
```

## Step 3: Show Command Details

Count total commands:

```bash
echo "Total project commands: $(find .claude/commands/ -name "*.md" -type f 2>/dev/null | wc -l)"
```

```bash
echo "Total global commands: $(find ~/.claude/commands/ -name "*.md" -type f 2>/dev/null | wc -l)"
```

Show recently modified commands (last 7 days):

```bash
find .claude/commands/ -name "*.md" -type f -mtime -7 2>/dev/null | sed 's|.claude/commands/||' | sed 's|.md$||' | sed 's|^|Recently modified: /|' || echo "No recently modified project commands"
```

```bash
find ~/.claude/commands/ -name "*.md" -type f -mtime -7 2>/dev/null | sed 's|.*/||' | sed 's|.md$||' | sed 's|^|Recently modified: /|' || echo "No recently modified global commands"
```

## Step 4: Inspect Specific Command (Ask User)

**If the user wants to inspect a specific command, ask them which one, then:**

```bash
cat .claude/commands/COMMAND-NAME.md | head -20
```

Or for global:

```bash
cat ~/.claude/commands/COMMAND-NAME.md | head -20
```

## Step 5: Check Permissions

Verify command directories are readable:

```bash
ls -ld .claude/commands/ 2>/dev/null || echo "No project commands directory"
```

```bash
ls -ld ~/.claude/commands/ 2>/dev/null || echo "No global commands directory"
```

## Step 6: Restart Instructions

**To make new/modified commands available, you must restart Claude Code:**

**Fastest restart method:**
1. Type `exit` or press Ctrl+D in Claude Code
2. Run `claude` again in the same directory
3. Your commands will be loaded

**Alternative:**
- Close the terminal/IDE tab running Claude Code
- Open a new session

**Note:** There is currently no way to hot-reload commands without restarting. This is a limitation of the CLI that may be addressed in a future update.

## Common Issues

### Command Not Showing Up After Restart

1. **Check filename** - Must be `*.md` in `.claude/commands/` or `~/.claude/commands/`
2. **Check frontmatter** - Must start with `---` and include `description:`
3. **Check permissions** - File must be readable (644 or similar)
4. **Check syntax** - Use this command to validate before restarting

### Command Shows But Doesn't Work

1. **Check bash syntax** - Multi-line if/for/while statements don't work
2. **Use single-line commands** - Chain with `&&` or `;` if needed
3. **Test commands individually** - Run the bash blocks manually first

## Command File Template

Here's a valid command structure:

```markdown
---
description: Brief description of what this command does
---

## Your Task

Clear instructions for what Claude should do when this command runs.

## Commands to Execute

### Step 1: First Action

```\`bash
echo "Single-line commands work best"
```\`

### Step 2: Next Action

```\`bash
ls -la | grep .md
```\`

## Expected Behavior

Describe what should happen after running this command.
```

## Expected Behavior

After running this command, you will:

1. ✓ See all available commands (project and global)
2. ✓ Know which commands have validation issues
3. ✓ See recently modified commands
4. ✓ Get restart instructions
5. ✗ Commands will **NOT** be reloaded (requires restart)

**This command validates and prepares for restart - it does not actually reload commands.**
