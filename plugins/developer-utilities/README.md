# Developer Utilities Plugin

Essential developer utilities for cache cleanup, command validation, and workflow optimization in Claude Code.

## Overview

This plugin provides practical commands to solve common pain points when working with Claude Code:

- **Cache Management**: Clean up accumulated logs and caches (addresses [#11646](https://github.com/anthropics/claude-code/issues/11646))
- **Permission Examples**: Explain permission rules using your actual settings (addresses [#11655](https://github.com/anthropics/claude-code/issues/11655))
- **Command Validation**: Validate slash commands and check for errors (related to [#11632](https://github.com/anthropics/claude-code/issues/11632))
- **Skills-Aware Init**: CLAUDE.md initialization using Skills as data source (addresses [#11661](https://github.com/anthropics/claude-code/issues/11661))
- **Skills Diagnostics**: Troubleshoot why Skills aren't being discovered or invoked (addresses [#11459](https://github.com/anthropics/claude-code/issues/11459), [#9716](https://github.com/anthropics/claude-code/issues/9716), [#11322](https://github.com/anthropics/claude-code/issues/11322))
- **Plugin Updates**: Update all git-based plugins with one command (addresses [#11676](https://github.com/anthropics/claude-code/issues/11676))

## Commands

### `/clean` - Cache and Log Cleanup

Clean up accumulated Claude Code cache, logs, and temporary files to free disk space.

**What it cleans:**

*Regular clean (safe):*
- Debug logs older than 7 days
- Old proxy session files (keeps last 10)
- Temporary files
- Shell snapshots older than 7 days
- File history older than 30 days

*Deep clean (optional):*
- All project caches
- Old proxy databases (keeps latest)
- Command history

**Usage:**
```bash
/clean
```

**Real-world impact:**
- Can free 3-6GB of disk space
- Improves performance by removing accumulated data
- Safe regular clean won't affect functionality
- Deep clean requires user confirmation

**Example output:**
```
=== Claude Code Directory Breakdown ===
3.2G    ~/.claude/logs
1.5G    ~/.claude/proxy
2.1G    ~/.claude/project-caches
...
=== Regular Clean Complete ===
Freed 4.8GB
Final size: 1.7GB
```

---

### `/validate-commands` - Command Validator

Validate slash command files, check for errors, and verify they will work after restart.

**What it does:**
- Lists all available project and global commands
- Validates command file structure and frontmatter
- Checks for missing descriptions and syntax errors
- Shows recently modified commands
- Detects common configuration issues
- Provides command file template

**Usage:**
```bash
/validate-commands
```

**Use case:** Developing slash commands and ensuring they're valid before restarting Claude Code to load them.

**Note:** This command validates files only - you still need to restart Claude Code for changes to take effect. Actual hot-reload functionality requires CLI changes (see [#11632](https://github.com/anthropics/claude-code/issues/11632)).

---

### `/permission-examples` - Permission Rule Examples

Show permission examples using your actual settings and explain how allow/ask/deny rules work.

**What it teaches:**
- Permission precedence: DENY → ALLOW → ASK → Default
- Pattern matching syntax for different tools
- Common configuration examples
- Security best practices

**Usage:**
```bash
/permission-examples
```

**How it works:**
1. Checks for your actual permission files (.claude/settings.json, ~/.claude/settings.json, .claude/settings.local.json)
2. If you have permissions configured, shows YOUR settings and explains what each rule does
3. If multiple files exist, asks which one to explain
4. If no permissions configured, shows hard-coded examples
5. Points out precedence conflicts (e.g., DENY overriding ALLOW)

**Key insight - Rule precedence:**
```json
{
  "permissions": {
    "allow": ["Bash(ls:*)"],
    "deny": ["Bash(*)"]
  }
}
```
Result: **All Bash commands are denied** (deny takes precedence over allow)

---

### `/init-skills` - Skills-Aware Initialization

Initialize CLAUDE.md using Skills as a data source for project knowledge (checks for Skills before file exploration).

**What this does:** Helps you CREATE documentation (CLAUDE.md) by using existing Skills as a source of project knowledge.

**What this does NOT do:** Does not help with getting Skills to work or be discovered by Claude.

**Key difference from standard `/init`:**
1. ✅ Checks for available Skills FIRST
2. ✅ Uses Skills to gather pre-synthesized knowledge
3. ✅ Falls back to file exploration only if needed
4. ✅ More efficient context usage

**Usage:**
```bash
/init-skills
```

**Workflow:**
```
1. Check .claude/skills/ and ~/.claude/skills/
2. If Skills found → Use them for project knowledge
3. If no Skills → Fall back to manual file exploration
4. Generate comprehensive CLAUDE.md
```

**Why this approach is better:**
- More efficient use of context window
- Faster analysis (leverages pre-synthesized knowledge)
- Better alignment with Skills' intended purpose
- Still comprehensive when Skills aren't available

---

### `/diagnose-skills` - Skills Troubleshooting

Diagnose why Skills aren't being discovered or invoked by Claude Code.

**What it checks:**
- Skill directory structure (correct locations, filenames)
- SKILL.md frontmatter format (YAML validation)
- Permission configuration (deny rules blocking skills)
- Prettier formatting issues (multi-line descriptions)
- Slash command conflicts (skills interpreted as commands)
- Skill discoverability (can Claude see them?)

**Usage:**
```bash
/diagnose-skills
```

**Common issues it finds:**

1. **Prettier formatting breaks frontmatter** - Missing `|` operator on multi-line descriptions
2. **Wrong directory structure** - Files in `.claude/skills/my-skill.md` instead of `.claude/skills/my-skill/SKILL.md`
3. **Permission blocks** - Deny rules preventing access to `.claude/skills/`
4. **Slash command conflicts** - Same name used for both skill and command
5. **Missing frontmatter fields** - No `name:` or `description:` in YAML

**Output:** Detailed diagnostic with specific fixes for each problem found.

**Addresses issues:**
- [#11459](https://github.com/anthropics/claude-code/issues/11459) - Skills being interpreted as slash commands
- [#9716](https://github.com/anthropics/claude-code/issues/9716) - Skills not being discovered
- [#11322](https://github.com/anthropics/claude-code/issues/11322) - Prettier formatting breaks skills

---

### `/update-plugins` - Plugin Update Command

Update all git-based plugins in `~/.claude/plugins/` with one command.

**What it does:**
- Loops through all plugins in `~/.claude/plugins/`
- Checks which are git repositories
- Runs `git pull` in each git-based plugin
- Shows update results and errors
- Provides summary of updates

**Usage:**
```bash
/update-plugins
```

**What gets updated:**
- ✅ Official Anthropic plugins (cloned from anthropics/claude-code)
- ✅ Third-party plugins (cloned from any GitHub repo)
- ✅ Your own plugins (cloned from your repos)
- ❌ Plugins installed via marketplace (different mechanism)
- ❌ Copied plugins without .git directory

**Example output:**
```
=== Updating Plugins ===

Updating: developer-utilities/
Already up to date.

Updating: commit-commands/
Updating 5348233..a1b2c3d
Fast-forward
 commands/new-command.md | 50 ++++++++++++++++++
 1 file changed, 50 insertions(+)

=== Update Complete ===
```

**Important:** Restart Claude Code after updating for changes to take effect.

**Addresses:** [#11676](https://github.com/anthropics/claude-code/issues/11676) - Plugin update-all command

---

## Installation

### Method 1: Plugin Marketplace (Recommended)

Once published to the marketplace:

1. Open Claude Code in your project
2. Type `/plugin`
3. Select "Browse Plugins"
4. Search for "developer-utilities"
5. Click Install

**Or use direct command:**
```bash
/plugin install developer-utilities@official
```

### Method 2: From GitHub Repository

**For Global Installation:**
```bash
# Create plugins directory
mkdir -p ~/.claude/plugins

# Download the plugin
cd ~/.claude/plugins
curl -L https://github.com/anthropics/claude-code/archive/main.tar.gz | tar xz --strip=2 claude-code-main/plugins/developer-utilities

# Restart Claude Code
```

**For Project Installation:**
```bash
# Create project plugins directory
mkdir -p .claude/plugins

# Download the plugin
cd .claude/plugins
curl -L https://github.com/anthropics/claude-code/archive/main.tar.gz | tar xz --strip=2 claude-code-main/plugins/developer-utilities

# Restart Claude Code
```

### Method 3: Clone Repository (For Development)

```bash
# Clone the entire repository
git clone https://github.com/anthropics/claude-code.git

# Copy plugin to global location
mkdir -p ~/.claude/plugins
cp -r claude-code/plugins/developer-utilities ~/.claude/plugins/

# Or to project location
mkdir -p .claude/plugins
cp -r claude-code/plugins/developer-utilities .claude/plugins/

# Restart Claude Code
```

### Method 4: Local Marketplace (For Testing)

```bash
# Clone the repo
git clone https://github.com/anthropics/claude-code.git

# Add as local marketplace
cd your-project
/plugin marketplace add ../claude-code/plugins

# Install from local marketplace
/plugin install developer-utilities@local
```

### Verify Installation

After installation and restart, verify the plugin is working:

```bash
# List available commands (should show our 4 commands)
/help

# Test a command
/validate-commands
```

You should see:
- `/clean` - Cache cleanup
- `/validate-commands` - Command validator
- `/permission-examples` - Permission explainer
- `/init-skills` - Skills-aware init
- `/diagnose-skills` - Skills troubleshooting
- `/update-plugins` - Plugin updater

## Configuration

No configuration required. All commands work out of the box.

### Optional: Add to Project Settings

Add to `.claude/settings.json` for automatic loading:

```json
{
  "plugins": [
    "developer-utilities"
  ]
}
```

## Use Cases

### Scenario 1: Low Disk Space
```bash
/clean
# Frees 3-6GB typically
# Run weekly or when disk space is low
```

### Scenario 2: Understanding Your Permission Rules
```bash
/permission-examples
# See your actual permissions explained
# Understand rule precedence
# Learn pattern matching syntax
# Check for conflicts (DENY overriding ALLOW)
```

### Scenario 3: Developing New Slash Commands
```bash
# 1. Create new command file in .claude/commands/
# 2. Run /validate-commands to check for errors
# 3. Fix any validation issues
# 4. Restart Claude Code
# 5. New command is available
```

### Scenario 4: New Project Initialization
```bash
/init-skills
# Checks for Skills first (more efficient)
# Creates comprehensive CLAUDE.md
# Falls back to file exploration if needed
```

### Scenario 5: Skills Not Working
```bash
/diagnose-skills
# Checks skill structure (directories, filenames)
# Validates SKILL.md frontmatter format
# Identifies permission blocks
# Finds Prettier formatting issues
# Detects slash command conflicts
# Provides specific fixes for each problem
```

### Scenario 6: Updating Plugins
```bash
/update-plugins
# Updates all git-based plugins
# Runs git pull in each plugin directory
# Shows what was updated
# Reports any errors
# Much faster than updating each manually
```

## Troubleshooting

### Commands not showing up

1. Verify plugin is installed:
```bash
ls -la .claude/plugins/developer-utilities/
ls -la ~/.claude/plugins/developer-utilities/
```

2. Check plugin.json exists:
```bash
cat .claude/plugins/developer-utilities/.claude-plugin/plugin.json
```

3. Restart Claude Code

### Clean command reports no space freed

This usually means:
- ~/.claude directory is already clean
- Claude Code hasn't been used much yet
- Previous cleanup was recent

### Permission examples command shows no configurations

This is normal if you haven't configured any permissions yet. The command will show hard-coded examples instead. To configure permissions, use the built-in `/permissions` command or manually edit:
```bash
# Edit project permissions
cat .claude/settings.json

# Edit global permissions
cat ~/.claude/settings.json
```

## Contributing

Found a bug or have a suggestion? Please:

1. Check existing [GitHub issues](https://github.com/anthropics/claude-code/issues)
2. File a new issue with:
   - Command that's not working
   - Expected behavior
   - Actual behavior
   - Your environment (OS, Claude Code version)

## Related GitHub Issues

This plugin addresses the following community requests:

- [#11646](https://github.com/anthropics/claude-code/issues/11646) - Cache cleanup command
- [#11655](https://github.com/anthropics/claude-code/issues/11655) - Permission rule precedence documentation
- [#11632](https://github.com/anthropics/claude-code/issues/11632) - Command reload functionality
- [#11661](https://github.com/anthropics/claude-code/issues/11661) - Skills-aware initialization
- [#11459](https://github.com/anthropics/claude-code/issues/11459) - Skills being interpreted as slash commands
- [#9716](https://github.com/anthropics/claude-code/issues/9716) - Skills not being discovered
- [#11322](https://github.com/anthropics/claude-code/issues/11322) - Prettier formatting breaks skills
- [#11676](https://github.com/anthropics/claude-code/issues/11676) - Plugin update-all command

## License

Same license as Claude Code - see main repository for details.

## Changelog

### Version 1.0.0 (Initial Release)

- Added `/clean` command for cache and log cleanup
- Added `/validate-commands` for slash command validation
- Added `/permission-examples` to explain permission rules with user's actual settings
- Added `/init-skills` for skills-aware CLAUDE.md initialization
- Added `/diagnose-skills` for troubleshooting skill discovery and invocation issues
- Added `/update-plugins` for updating all git-based plugins with one command
- Comprehensive documentation and examples
- Four installation methods including plugin marketplace support
- Addresses 8 community GitHub issues
