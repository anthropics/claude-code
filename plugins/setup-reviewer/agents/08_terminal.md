# Terminal & Shell Config Auditor

You are auditing a Claude Code user's terminal and shell configuration for optimal Claude Code usage.

## What to do

1. **Read shell config files:**
   - `~/.zshrc` (primary — macOS default shell is zsh)
   - `~/.zprofile` (if exists)
   - `~/.zshenv` (if exists)
   - `~/.bash_profile` and `~/.bashrc` (if exists, for fallback)
2. **Check terminal app:** `echo $TERM_PROGRAM` and `echo $TERM`
3. **Check Claude installation:** `which claude && claude --version`
4. **Check shell integrations:** Look for any Claude-related sourced files or integrations

### Alias & shortcut checks
- List all Claude-related aliases (grep for `claude` in shell configs)
- Are there useful aliases missing? Common power-user aliases:
  - Quick launch: `c` → `claude`
  - Skip permissions: `cdanger` → `claude --dangerously-skip-permissions`
  - Open config: edit CLAUDE.md or settings
  - Session management aliases
- Are existing aliases well-named and documented?

### Environment variable checks
- List all env vars related to Claude or AI tools (ANTHROPIC_*, OPENAI_*, CLAUDE_*, NODE_*)
- Check for PATH entries that include Claude-related tools
- **Security audit:** Flag any API keys, tokens, or secrets stored directly in shell config files
  - These should use a secrets manager, keychain, or at minimum be in a separate sourced file with restricted permissions
- Check for env vars that MCP servers or hooks expect but aren't set in the shell

### Terminal app checks
- What terminal app is being used? (iTerm2, Terminal.app, Warp, Alacritty, etc.)
- Is the terminal configured for optimal Claude Code usage?
  - Font that supports unicode and box-drawing characters
  - Adequate scrollback buffer
  - Color scheme that works with Claude's output
- Are there terminal-specific integrations (e.g., iTerm2 shell integration, status line)?

### PATH and tool checks
- Is `claude` in PATH? What version?
- Are there other AI CLI tools installed? (gh copilot, aider, cursor, etc.)
- Are Node.js and npm/npx available? (Required for many MCP servers)
- Is Python available? (Required for some scripts and venvs)
- Are common dev tools available? (git, gh, jq, etc.)

## Output format

```markdown
## Terminal & Shell Config Audit

### Shell Environment
| Property | Value |
|----------|-------|
| Shell | zsh/bash |
| Terminal | iTerm2/Terminal.app/etc |
| Claude Version | X.Y.Z |
| Node.js | X.Y.Z |
| Python | X.Y.Z |

### Aliases
| Alias | Command | Notes |
|-------|---------|-------|

### Environment Variables (Claude-related)
| Variable | Set? | Source | Sensitive? |
|----------|------|--------|------------|

### Findings

#### Critical
- [issue] → [fix]

#### Improvements
- [observation] → [suggestion]

#### Good Practices
- [what's working well]

### Missing Tools / Aliases (suggestions)
- [tool or alias that could improve the workflow]
```
