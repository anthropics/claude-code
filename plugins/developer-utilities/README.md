# Developer Utilities Plugin

Essential developer utilities for cache cleanup, command validation, session management, and workflow optimization in Claude Code.

## Overview

This plugin provides practical commands to solve common pain points when working with Claude Code:

- **Cache Management**: Clean up accumulated logs and caches (addresses [#11646](https://github.com/anthropics/claude-code/issues/11646))
- **Session Management**: List and label sessions for better organization (addresses [#3605](https://github.com/anthropics/claude-code/issues/3605))
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

### `/list-sessions` - Session List with Labels

List Claude Code sessions with context, labels, and activity timeline to help identify and resume the right session.

**What it shows:**
- Session IDs (for use with `claude --resume`)
- User-defined labels (set with `/label-session`)
- Project paths
- First and last activity timestamps
- Total interaction count
- First user message (as context)

**Usage:**
```bash
/list-sessions
```

**Example output:**
```
=== Claude Code Sessions (Most Recent First) ===

Session: 7ee51d83-6cdd-444e-a074-865dee92bd18
  Label: Developer utilities plugin work
  Project: /home/adam/Code/claude-code
  Started: 2025-11-16 15:37
  Last Activity: 2025-11-16 15:45
  Interactions: 24
  First Message: Is there a way to fix this? would this be a good ca...

Session: fccea55b-62b9-447d-ac21-76c04e32aece
  Label: Testing developer-utilities plugin
  Project: /home/adam/Code/claude-code
  Started: 2025-11-15 16:22
  Last Activity: 2025-11-15 17:10
  Interactions: 18
  First Message: Review the developer-utilities plugin...
```

**How it works:**
- Parses `~/.claude/history.jsonl` to group sessions by ID
- Displays user labels from `~/.claude/session-labels.json`
- Shows 20 most recent sessions
- Read-only (safe to run anytime)

**Use case:** Finding the right session to resume when you have many active projects or need to continue work from days ago.

**Addresses:** [#3605](https://github.com/anthropics/claude-code/issues/3605) - Session visualization and identification

---

### `/label-session` - Add Session Labels

Add or update a user-friendly label for a Claude Code session to make it easier to identify later.

**What it does:**
- Validates session ID format
- Stores label in `~/.claude/session-labels.json`
- Preserves all existing labels
- Tracks creation and update timestamps

**Usage:**
```bash
/label-session <session-id> <label>
```

**Examples:**
```bash
# Label a session
/label-session 7ee51d83-6cdd-444e-a074-865dee92bd18 "Developer utilities plugin"

# Update an existing label
/label-session fccea55b-62b9-447d-ac21-76c04e32aece "Fix auth bug - completed"
```

**How to find session IDs:**
1. Run `/list-sessions` to see all sessions with their IDs
2. Copy the session ID you want to label
3. Run `/label-session <session-id> <your-label>`

**Important notes:**
- This is a **workaround** - we cannot modify Claude Code's internal session database
- Labels are stored separately in `~/.claude/session-labels.json`
- Labels appear in `/list-sessions` output
- Non-destructive (doesn't affect Claude Code's core functionality)

**File format** (`~/.claude/session-labels.json`):
```json
{
  "session-id-here": {
    "label": "User-friendly name",
    "created": "2025-11-16T15:45:00Z",
    "updated": "2025-11-16T16:20:00Z"
  }
}
```

**Addresses:** [#3605](https://github.com/anthropics/claude-code/issues/3605) - Session renaming feature request

---

## Standalone Utilities

### `claude-resume` - Interactive Session Picker (Standalone Script)

**Note:** This is a **standalone script**, not a slash command. It lives in `~/bin/` and is run from your terminal outside of Claude Code.

Interactive session picker with fuzzy search, label management, and session resumption.

**What it does:**
- Shows interactive table of recent sessions with labels
- Fuzzy search/filter by label, project, or date
- Edit labels inline (Ctrl+E)
- Delete labels inline (Ctrl+D)
- Resume selected session
- Retry if session not found

**Installation:**
```bash
# Copy script to ~/bin
cp scripts/claude-resume ~/bin/claude-resume
chmod +x ~/bin/claude-resume
```

**Requirements:**
- `fzf` (fuzzy finder): `sudo apt install fzf`
- `jq` (JSON processor): `sudo apt install jq`

**Usage:**
```bash
# Run from terminal (NOT inside Claude Code)
claude-resume
```

**Interface:**
```
SESSION / LABEL                                      | PROJECT              | LAST ACTIVE  | MSGS
──────────────────────────────────────────────────── | ──────────────────── | ──────────── | ────
Developer utilities plugin work                      | claude-code          | 11/16 15:45  |  24
Testing authentication fix                           | my-app               | 11/15 17:10  |  18
/list-sessions                                       | Code                 | 11/14 09:30  |   2
```

**Keybindings:**
- **Enter** - Resume selected session
- **Ctrl+E** - Edit label for selected session
- **Ctrl+D** - Delete label for selected session
- **Ctrl+C** - Cancel and exit
- **Type to search** - Fuzzy filter results

**How it works with `/label-session`:**
1. Inside Claude Code: Run `/label-session <id> "My Label"` → Writes to `~/.claude/session-labels.json`
2. From terminal: Run `claude-resume` → Reads from `~/.claude/session-labels.json` and shows labels
3. Select session and resume with Enter, or edit label with Ctrl+E

**Features:**
- Shows labels created with `/label-session`
- Falls back to first message if no label
- Handles sessions with only slash commands
- Sanitizes label input (removes control characters, newlines)
- Auto-retry on failed resume
- Strips whitespace and quotes from session IDs

**Location:** `plugins/developer-utilities/scripts/claude-resume` (source)

**Why it's separate from slash commands:**
- Runs outside Claude Code (terminal launcher)
- Uses `fzf` for interactive UI
- Launches new Claude Code instances
- Symlinked to `~/bin/` for easy access

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

## Development Workflow

### Adding New Commands to This Plugin

**CRITICAL:** When developing new commands in this repository, you must **sync changes to the installed plugin** before they'll be visible in Claude Code.

**The Problem:**
- Commands in `plugins/developer-utilities/commands/` are NOT automatically loaded
- Claude Code only reads from `~/.claude/plugins/developer-utilities/commands/`
- Local development changes won't appear until copied to the installed location

**The Solution:**

After creating or modifying command files in this repository:

```bash
# Step 1: Copy updated commands to installed plugin
cp plugins/developer-utilities/commands/*.md ~/.claude/plugins/developer-utilities/commands/

# Step 2: Verify the copy succeeded
ls -l ~/.claude/plugins/developer-utilities/commands/

# Step 3: Restart Claude Code
exit
claude

# Step 4: Verify commands appear
# Type / and look for your new commands
```

**Quick Development Workflow:**

1. Edit command files in `plugins/developer-utilities/commands/`
2. Run sync script:
   ```bash
   # Sync all commands
   cp plugins/developer-utilities/commands/*.md ~/.claude/plugins/developer-utilities/commands/
   ```
3. Restart Claude Code to load changes
4. Test your commands
5. Repeat until working

**Why This Happens:**

Claude Code's plugin discovery works like this:
- Checks `~/.claude/plugins/` (global plugins)
- Checks `.claude/plugins/` (project plugins)
- Does NOT check repository source directories like `plugins/`

When you're developing a plugin IN the claude-code repository, you're working in the source directory, not the installed directory.

**Alternative: Symlink for Active Development**

For active development, create a symlink instead of copying:

```bash
# Remove installed version
rm -rf ~/.claude/plugins/developer-utilities

# Symlink to development version
ln -s /home/adam/Code/claude-code/plugins/developer-utilities ~/.claude/plugins/developer-utilities

# Now changes are immediately visible (still need to restart Claude Code)
```

**Warning:** If using symlinks, be careful not to commit broken commands - they'll immediately affect your Claude Code installation.

## Troubleshooting

### Commands not showing up

**Most Common Cause:** Commands were modified in the repository but not synced to `~/.claude/plugins/`

1. Verify plugin is installed:
```bash
ls -la .claude/plugins/developer-utilities/
ls -la ~/.claude/plugins/developer-utilities/
```

2. Check command timestamps (are they recent?):
```bash
ls -l ~/.claude/plugins/developer-utilities/commands/
```

3. Sync commands from repository:
```bash
cp plugins/developer-utilities/commands/*.md ~/.claude/plugins/developer-utilities/commands/
```

4. Check plugin.json exists:
```bash
cat ~/.claude/plugins/developer-utilities/.claude-plugin/plugin.json
```

5. Restart Claude Code

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
