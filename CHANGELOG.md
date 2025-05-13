# Changelog

## 0.2.108

- You can now send messages to Claude while it works to steer Claude in real-time
- Introduced BASH_DEFAULT_TIMEOUT_MS and BASH_MAX_TIMEOUT_MS env vars
- Fixed a bug where thinking was not working in -p mode
- Fixed a regression in /cost reporting
- Deprecated MCP wizard interface in favor of other MCP commands
- Lots of other bugfixes and improvements

## 0.2.107

- CLAUDE.md files can now import other files. Add @path/to/file.md to ./CLAUDE.md to load additional files on launch

## 0.2.106

- MCP SSE server configs can now specify custom headers
- Fixed a bug where MCP permission prompt didn't always show correctly

## 0.2.105

- Claude can now search the web
- Moved system & account status to /status
- Added word movement keybindings for Vim
- Improved latency for startup, todo tool, and file edits

## 0.2.102

- Improved thinking triggering reliability
- Improved @mention reliability for images and folders
- You can now paste multiple large chunks into one prompt

## 0.2.100

- Fixed a crash caused by a stack overflow error
- Made db storage optional; missing db support disables --continue and --resume

## 0.2.98

- Fixed an issue where auto-compact was running twice

## 0.2.96

- Claude Code can now also be used with a Claude Max subscription (https://claude.ai/upgrade)

## 0.2.93

- Resume conversations from where you left off from with "claude --continue" and "claude --resume"
- Claude now has access to a Todo list that helps it stay on track and be more organized

## 0.2.82

- Added support for --disallowedTools
- Renamed tools for consistency: LSTool -> LS, View -> Read, etc.

## 0.2.75

- Hit Enter to queue up additional messages while Claude is working
- Drag in or copy/paste image files directly into the prompt
- @-mention files to directly add them to context
- Run one-off MCP servers with `claude --mcp-config <path-to-file>`
- Improved performance for filename auto-complete

## 0.2.74

- Added support for refreshing dynamically generated API keys (via apiKeyHelper), with a 5 minute TTL
- Task tool can now perform writes and run bash commands

## 0.2.72

- Updated spinner to indicate tokens loaded and tool usage

## 0.2.70

- Network commands like curl are now available for Claude to use
- Claude can now run multiple web queries in parallel
- Pressing ESC once immediately interrupts Claude in Auto-accept mode

## 0.2.69

- Fixed UI glitches with improved Select component behavior
- Enhanced terminal output display with better text truncation logic

## 0.2.67

- Shared project permission rules can be saved in .claude/settings.json

## 0.2.66

- Print mode (-p) now supports streaming output via --output-format=stream-json
- Fixed issue where pasting could trigger memory or bash mode unexpectedly

## 0.2.63

- Fixed an issue where MCP tools were loaded twice, which caused tool call errors

## 0.2.61

- Navigate menus with vim-style keys (j/k) or bash/emacs shortcuts (Ctrl+n/p) for faster interaction
- Enhanced image detection for more reliable clipboard paste functionality
- Fixed an issue where ESC key could crash the conversation history selector

## 0.2.59

- Copy+paste images directly into your prompt
- Improved progress indicators for bash and fetch tools
- Bugfixes for non-interactive mode (-p)

## 0.2.54

- Quickly add to Memory by starting your message with '#'
- Press ctrl+r to see full output for long tool results
- Added support for MCP SSE transport

## 0.2.53

- New web fetch tool lets Claude view URLs that you paste in
- Fixed a bug with JPEG detection

## 0.2.50

- New MCP "project" scope now allows you to add MCP servers to .mcp.json files and commit them to your repository

## 0.2.49

- Previous MCP server scopes have been renamed: previous "project" scope is now "local" and "global" scope is now "user"

## 0.2.47

- Press Tab to auto-complete file and folder names
- Press Shift + Tab to toggle auto-accept for file edits
- Automatic conversation compaction for infinite conversation length (toggle with /config)

## 0.2.44

- Ask Claude to make a plan with thinking mode: just say 'think' or 'think harder' or even 'ultrathink'

## 0.2.41

- MCP server startup timeout can now be configured via MCP_TIMEOUT environment variable
- MCP server startup no longer blocks the app from starting up

## 0.2.37

- New /release-notes command lets you view release notes at any time
- `claude config add/remove` commands now accept multiple values separated by commas or spaces

## 0.2.36

- Import MCP servers from Claude Desktop with `claude mcp add-from-claude-desktop`
- Add MCP servers as JSON strings with `claude mcp add-json <n> <json>`

## 0.2.34

- Vim bindings for text input - enable with /vim or /config

## 0.2.32

- Interactive MCP setup wizard: Run "claude mcp add" to add MCP servers with a step-by-step interface
- Fix for some PersistentShell issues

## 0.2.31

- Custom slash commands: Markdown files in .claude/commands/ directories now appear as custom slash commands to insert prompts into your conversation
- MCP debug mode: Run with --mcp-debug flag to get more information about MCP server errors

## 0.2.30

- Added ANSI color theme for better terminal compatibility
- Fixed issue where slash command arguments weren't being sent properly
- (Mac-only) API keys are now stored in macOS Keychain

## 0.2.26

- New /approved-tools command for managing tool permissions
- Word-level diff display for improved code readability
- Fuzzy matching for slash commands

## 0.2.21

- Fuzzy matching for /commands
