# Agent Hang & Infinite Loop Troubleshooting Guide

> **Last updated:** 2026-03-02  
> **Tracks issues:** #30014, #7122, #4002, #4744, #16752, #26346, #13315 and related

## Overview

This guide covers the cluster of issues where Claude Code agents — particularly the **Explore agent** — enter an infinite loop, freeze, or hang indefinitely. The most common trigger is a `MaxFileReadTokenExceededError` that the agent fails to recover from gracefully.

---

## How the Infinite Loop Happens

The typical failure chain:

1. Explore agent attempts to read a large file (>25,000 tokens)
2. `MaxFileReadTokenExceededError` is thrown with instructions to use `offset`/`limit` params
3. The agent **retries the same full-file read** instead of adjusting parameters
4. Steps 2–3 repeat in a tight loop (sometimes firing twice within seconds)
5. Eventually: a `Request was aborted` error fires after the loop exhausts resources or hits a network timeout
6. The terminal appears frozen; `Esc` may be unresponsive

**Confirmed in v2.1.63** (darwin/ghostty, Feedback ID: df9603c7-bb54-4f41-9f69-93de6151690d)

---

## Error Messages & Meanings

### `MaxFileReadTokenExceededError`
```
MaxFileReadTokenExceededError: File content (N tokens) exceeds maximum allowed tokens (25000).
Please use offset and limit parameters to read specific portions of the file,
or use the GrepTool to search for specific content.
```
**Meaning:** The file the agent tried to read is larger than the 25,000-token file read limit. The error itself is expected behavior — the bug is that the agent retries without adjusting instead of chunking.

**Note on the 25k limit:** This is a hardcoded tool-level cap, not the model's context window. Related feature request to raise it: #4002.

### `Error: Request was aborted.`
```
Error: Request was aborted.
  at MhR (/$bunfs/root/claude:821:96594)
```
**Meaning:** The API request was cancelled — either by a timeout, network interruption, or the loop consuming enough resources that the connection dropped. This usually appears 5–15 minutes after the `MaxFileReadTokenExceededError` loop begins.

### `BashOutput(Reading shell output) ⏿ (No content)`
**Meaning:** A different variant of the hang — the agent issued a bash command and is waiting for output that never arrives. See #13315.

---

## Prevention Strategies

### 1. Add a `.claudeignore` file

The most effective prevention. Create `.claudeignore` in your project root to exclude large files and directories from agent exploration:

```gitignore
# Build outputs and bundles (often very large)
dist/
build/
.next/
.nuxt/
out/

# Package managers
node_modules/
.pnpm-store/

# Minified and bundled files
*.min.js
*.min.css
*.bundle.js
*.bundle.css
*.chunk.js

# Lock files (large, rarely useful to read in full)
package-lock.json
yarn.lock
pnpm-lock.yaml
Composer.lock
Gemfile.lock
Pipfile.lock

# Logs and data files
*.log
*.csv
*.parquet
*.sqlite
*.db

# Binary files
*.png
*.jpg
*.jpeg
*.gif
*.pdf
*.zip
*.tar.gz

# Generated files
*.d.ts.map
*.js.map
coverage/
.nyc_output/
```

### 2. Keep large files small or split them

If a source file exceeds ~1,000 lines (~25k tokens), consider splitting it. Files that commonly trigger the error:
- Large TypeScript definition files
- Auto-generated API clients
- Monolithic component files
- Large JSON configuration files

### 3. Instruct Claude to use chunked reading

When you know you'll be working with large files, add explicit guidance in your prompt:

```
IMPORTANT: For any file larger than 500 lines, read it in chunks using
offset and limit parameters (e.g., offset=0, limit=200 first, then
offset=200, limit=200, etc.). Never attempt to read the entire file at once.
```

Or use a `CLAUDE.md` in your project root with standing instructions:

```markdown
## File Reading Rules
- Files over 500 lines: always use offset/limit to read in chunks of 200 lines
- Use GrepTool to search for specific content before reading entire files
- Never read lock files, dist/ contents, or node_modules
```

### 4. Set environment variables

```bash
# Increase max output tokens to reduce context pressure
export CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000

# Optional: disable non-essential traffic to reduce network noise
# (note: this can sometimes affect feature availability)
# export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
```

---

## Recovery Steps (When Already Stuck)

### Step 1 — Try Esc
Press `Esc` to interrupt the current operation. If the agent is in a recoverable state, this will stop it.

### Step 2 — If Esc is unresponsive
Keyboard input can freeze during agent hangs (confirmed in #4744). If `Esc` does nothing after 10–15 seconds:

**macOS/Linux:**
```bash
# In a new terminal window:
Ctrl+C
# Or force kill:
kill $(pgrep -f claude)
```

**Windows:**
```powershell
# Ctrl+C first; if unresponsive:
Get-Process claude | Stop-Process -Force
```

### Step 3 — Resume the session
```bash
claude -r
```
This restores your previous session context. Claude will have the conversation history up to before the hang.

### Step 4 — Identify the problematic file
After resuming, ask Claude to identify what file it was trying to read:
```
What file were you trying to read when you got stuck? Can you check its
size first using `wc -l filename` before attempting to read it?
```

### Step 5 — Add the file to `.claudeignore` or instruct chunked reading
Once you know the problematic file, either:
- Add it to `.claudeignore` if it doesn't need to be read
- Or explicitly instruct: `"Read large-file.ts in chunks of 150 lines starting at offset 0"`

---

## Platform-Specific Notes

### macOS (darwin)
- This is the most commonly reported platform for the Explore agent hang
- Ghostty terminal confirmed affected (#30014)
- iTerm2 and VS Code integrated terminal also affected
- `Ctrl+C` reliably kills the process when `Esc` fails

### Linux
- Similar behavior to macOS
- WSL users: the claude process is visible as a Linux process; `kill $(pgrep -f claude)` works

### Windows
- The `Request was aborted` error may manifest differently
- Use Task Manager or `Get-Process claude | Stop-Process` if terminal is frozen
- PowerShell preferred over Command Prompt for recovery commands

---

## Version Notes

| Version | Status |
|---------|--------|
| v2.1.63 | Bug confirmed: `MaxFileReadTokenExceededError` retry loop in Explore agent |
| v2.1.64 | Partial fix: "Fixed unintended access to the recursive agent tool" (see CHANGELOG). `MaxFileReadTokenExceededError` loop may persist. |

> If you're on v2.1.63, upgrading to the latest version is recommended:
> ```bash
> # macOS/Linux
> curl -fsSL https://claude.ai/install.sh | bash
> # Homebrew
> brew upgrade --cask claude-code
> # Windows
> irm https://claude.ai/install.ps1 | iex
> ```

---

## Root Cause (For Anthropic Team)

The fundamental bug is in the Explore agent's error recovery logic:

**Current behavior:**
```
read_file(path) -> MaxFileReadTokenExceededError -> retry read_file(path) [loop]
```

**Expected behavior:**
```
read_file(path) -> MaxFileReadTokenExceededError -> read_file(path, offset=0, limit=200) [chunked]
```

Fixes needed:
1. **Automatic chunked fallback** when `MaxFileReadTokenExceededError` is thrown — automatically retry with `offset=0, limit=200` (or configurable chunk size)
2. **Retry cap** — maximum N retries on the same file before surfacing an error and stopping (see #16752)
3. **User-visible interrupt** — when the error loop is detected, surface a warning so the user can intervene rather than silently spinning
4. **Responsive Esc during hangs** — keyboard input should remain active even when a sub-agent is stuck (#4744)

---

## Related Issues

| Issue | Description | Status |
|-------|-------------|--------|
| [#30014](https://github.com/anthropics/claude-code/issues/30014) | Explore agent infinite loop — MaxFileReadTokenExceededError on macOS | Open |
| [#7122](https://github.com/anthropics/claude-code/issues/7122) | Claude stuck in infinite loop reading files | Open |
| [#4002](https://github.com/anthropics/claude-code/issues/4002) | MaxFileReadTokenExceededError — hardcoded 25k limit feature request | Open |
| [#4744](https://github.com/anthropics/claude-code/issues/4744) | Agent execution timeout: persistent hanging, frozen keyboard | Open |
| [#16752](https://github.com/anthropics/claude-code/issues/16752) | Agent warmup mode: infinite retry loop, no backoff or max retry | Open |
| [#26346](https://github.com/anthropics/claude-code/issues/26346) | Claude enters infinite loop of redundant file modifications | Open |
| [#13315](https://github.com/anthropics/claude-code/issues/13315) | Infinite loop with empty Bash consuming tokens | Open |
| [#3681](https://github.com/anthropics/claude-code/issues/3681) | Infinite read operation hang during file processing | Open |

---

_Community-contributed guide. See the [docs/](.) directory for more troubleshooting guides. For the Remote Control hang guide, see [remote-control-troubleshooting.md](./remote-control-troubleshooting.md)._
