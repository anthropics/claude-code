# Developer Utilities Plugin

Essential developer utilities for cache cleanup, command validation, permissions, skills diagnostics, and plugin management in Claude Code.

## Overview

This plugin provides practical commands to solve common pain points when working with Claude Code:

- **Cache Management**: Clean up accumulated logs and caches (addresses [#11646](https://github.com/anthropics/claude-code/issues/11646))
- **Permission Examples**: Explain permission rules using your actual settings (addresses [#11655](https://github.com/anthropics/claude-code/issues/11655))
- **Command Validation**: Validate slash commands and check for errors (related to [#11632](https://github.com/anthropics/claude-code/issues/11632))
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
- Official Anthropic plugins (cloned from anthropics/claude-code)
- Third-party plugins (cloned from any GitHub repo)
- Your own plugins (cloned from your repos)

**What is NOT updated:**
- Plugins installed via marketplace (different mechanism)
- Copied plugins without .git directory

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
mkdir -p ~/.claude/plugins
cd ~/.claude/plugins
curl -L https://github.com/anthropics/claude-code/archive/main.tar.gz | tar xz --strip=2 claude-code-main/plugins/developer-utilities
```

**For Project Installation:**
```bash
mkdir -p .claude/plugins
cd .claude/plugins
curl -L https://github.com/anthropics/claude-code/archive/main.tar.gz | tar xz --strip=2 claude-code-main/plugins/developer-utilities
```

### Method 3: Clone Repository (For Development)

```bash
git clone https://github.com/anthropics/claude-code.git
mkdir -p ~/.claude/plugins
cp -r claude-code/plugins/developer-utilities ~/.claude/plugins/
```

### Verify Installation

After installation and restart, verify the plugin is working:

```bash
# Test a command
/validate-commands
```

You should see:
- `/clean` - Cache cleanup
- `/validate-commands` - Command validator
- `/permission-examples` - Permission explainer
- `/diagnose-skills` - Skills troubleshooting
- `/update-plugins` - Plugin updater

## Troubleshooting

### Commands not showing up

1. Verify plugin is installed:
```bash
ls -la ~/.claude/plugins/developer-utilities/
```

2. Check plugin.json exists:
```bash
cat ~/.claude/plugins/developer-utilities/.claude-plugin/plugin.json
```

3. Restart Claude Code

### Clean command reports no space freed

This usually means:
- ~/.claude directory is already clean
- Claude Code hasn't been used much yet
- Previous cleanup was recent

### Permission examples command shows no configurations

This is normal if you haven't configured any permissions yet. The command will show hard-coded examples instead.

## Related GitHub Issues

This plugin addresses the following community requests:

- [#11646](https://github.com/anthropics/claude-code/issues/11646) - Cache cleanup command
- [#11655](https://github.com/anthropics/claude-code/issues/11655) - Permission rule precedence documentation
- [#11632](https://github.com/anthropics/claude-code/issues/11632) - Command reload functionality
- [#11459](https://github.com/anthropics/claude-code/issues/11459) - Skills being interpreted as slash commands
- [#9716](https://github.com/anthropics/claude-code/issues/9716) - Skills not being discovered
- [#11322](https://github.com/anthropics/claude-code/issues/11322) - Prettier formatting breaks skills
- [#11676](https://github.com/anthropics/claude-code/issues/11676) - Plugin update-all command

## License

Same license as Claude Code - see main repository for details.

## Changelog

### Version 2.0.0

- **Removed** `/init-skills`, `/label-session`, `/list-sessions`, and `claude-resume` — superseded by native Claude Code features (`/init`, `claude --name`, `claude --resume`)
- Focused plugin on 5 unique utilities not available natively

### Version 1.0.0 (Initial Release)

- Added `/clean` command for cache and log cleanup
- Added `/validate-commands` for slash command validation
- Added `/permission-examples` to explain permission rules with user's actual settings
- Added `/diagnose-skills` for troubleshooting skill discovery and invocation issues
- Added `/update-plugins` for updating all git-based plugins with one command
