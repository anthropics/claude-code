# Changelog

## 1.0.51

- Added support for native Windows (requires Git for Windows)
- Added support for Bedrock API keys through environment variable AWS_BEARER_TOKEN_BEDROCK
- Settings: /doctor can now help you identify and fix invalid setting files
- `--append-system-prompt` can now be used in interactive mode, not just --print/-p.
- Increased auto-compact warning threshold from 60% to 80%
- Fixed an issue with handling user directories with spaces for shell snapshots
- OTEL resource now includes os.type, os.version, host.arch, and wsl.version (if running on Windows Subsystem for Linux)
- Custom slash commands: Fixed user-level commands in subdirectories
- Plan mode: Fixed issue where rejected plan from sub-task would get discarded

## 1.0.48

- Fixed a bug in v1.0.45 where the app would sometimes freeze on launch
- Added progress messages to Bash tool based on the last 5 lines of command output
- Added expanding variables support for MCP server configuration
- Moved shell snapshots from /tmp to ~/.claude for more reliable Bash tool calls
- Improved IDE extension path handling when Claude Code runs in WSL
- Hooks: Added a PreCompact hook
- Vim mode: Added c, f/F, t/T

## 1.0.45

- Redesigned Search (Grep) tool with new tool input parameters and features
- Disabled IDE diffs for notebook files, fixing "Timeout waiting after 1000ms" error
- Fixed config file corruption issue by enforcing atomic writes
- Updated prompt input undo to Ctrl+\_ to avoid breaking existing Ctrl+U behavior, matching zsh's undo shortcut
- Stop Hooks: Fixed transcript path after /clear and fixed triggering when loop ends with tool call
- Custom slash commands: Restored namespacing in command names based on subdirectories. For example, .claude/commands/frontend/component.md is now /frontend:component, not /component.

## 1.0.44

- New /export command lets you quickly export a conversation for sharing
- MCP: resource_link tool results are now supported
- MCP: tool annotations and tool titles now display in /mcp view
- Changed Ctrl+Z to suspend Claude Code. Resume by running `fg`. Prompt input undo is now Ctrl+U.

## 1.0.43

- Fixed a bug where the theme selector was saving excessively
- Hooks: Added EPIPE system error handling

## 1.0.42

- Added tilde (`~`) expansion support to `/add-dir` command

## 1.0.41

- Hooks: Split Stop hook triggering into Stop and SubagentStop
- Hooks: Enabled optional timeout configuration for each command
- Hooks: Added "hook_event_name" to hook input
- Fixed a bug where MCP tools would display twice in tool list
- New tool parameters JSON for Bash tool in `tool_decision` event

## 1.0.40

- Fixed a bug causing API connection errors with UNABLE_TO_GET_ISSUER_CERT_LOCALLY if `NODE_EXTRA_CA_CERTS` was set

## 1.0.39

- New Active Time metric in OpenTelemetry logging

## 1.0.38

- Released hooks. Special thanks to community input in https://github.com/anthropics/claude-code/issues/712. Docs: https://docs.anthropic.com/en/docs/claude-code/hooks

## 1.0.37

- Remove ability to set `Proxy-Authorization` header via ANTHROPIC_AUTH_TOKEN or apiKeyHelper

## 1.0.36

- Web search now takes today's date into context
- Fixed a bug where stdio MCP servers were not terminating properly on exit

## 1.0.35

- Added support for MCP OAuth Authorization Server discovery

## 1.0.34

- Fixed a memory leak causing a MaxListenersExceededWarning message to appear

## 1.0.33

- Improved logging functionality with session ID support
- Added prompt input undo functionality (Ctrl+Z and vim 'u' command)
- Improvements to plan mode

## 1.0.32

- Updated loopback config for litellm
- Added forceLoginMethod setting to bypass login selection screen

## 1.0.31

- Fixed a bug where ~/.claude.json would get reset when file contained invalid JSON

## 1.0.30

- Custom slash commands: Run bash output, @-mention files, enable thinking with thinking keywords
- Improved file path autocomplete with filename matching
- Added timestamps in Ctrl-r mode and fixed Ctrl-c handling
- Enhanced jq regex support for complex filters with pipes and select

## 1.0.29

- Improved CJK character support in cursor navigation and rendering

## 1.0.28

- Slash commands: Fix selector display during history navigation
- Resizes images before upload to prevent API size limit errors
- Added XDG_CONFIG_HOME support to configuration directory
- Performance optimizations for memory usage
- New attributes (terminal.type, language) in OpenTelemetry logging

## 1.0.27

- Streamable HTTP MCP servers are now supported
- Remote MCP servers (SSE and HTTP) now support OAuth
- MCP resources can now be @-mentioned
- /resume slash command to switch conversations within Claude Code

## 1.0.25

- Slash commands: moved "project" and "user" prefixes to descriptions
- Slash commands: improved reliability for command discovery
- Improved support for Ghostty
- Improved web search reliability

## 1.0.24

- Improved /mcp output
- Fixed a bug where settings arrays got overwritten instead of merged

## 1.0.23

- Released TypeScript SDK: import @anthropic-ai/claude-code to get started
- Released Python SDK: pip install claude-code-sdk to get started

## 1.0.22

- SDK: Renamed `total_cost` to `total_cost_usd`

## 1.0.21

- Improved editing of files with tab-based indentation
- Fix for tool_use without matching tool_result errors
- Fixed a bug where stdio MCP server processes would linger after quitting Claude Code

## 1.0.18

- Added --add-dir CLI argument for specifying additional working directories
- Added streaming input support without require -p flag
- Improved startup performance and session storage performance
- Added CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR environment variable to freeze working directory for bash commands
- Added detailed MCP server tools display (/mcp)
- MCP authentication and permission improvements
- Added auto-reconnection for MCP SSE connections on disconnect
- Fixed issue where pasted content was lost when dialogs appeared

## 1.0.17

- We now emit messages from sub-tasks in -p mode (look for the parent_tool_use_id property)
- Fixed crashes when the VS Code diff tool is invoked multiple times quickly
- MCP server list UI improvements
- Update Claude Code process title to display "claude" instead of "node"

## 1.0.11

- Claude Code can now also be used with a Claude Pro subscription
- Added /upgrade for smoother switching to Claude Max plans
- Improved UI for authentication from API keys and Bedrock/Vertex/external auth tokens
- Improved shell configuration error handling
- Improved todo list handling during compaction

## 1.0.10

- Added markdown table support
- Improved streaming performance

## 1.0.8

- Fixed Vertex AI region fallback when using CLOUD_ML_REGION
- Increased default otel interval from 1s -> 5s
- Fixed edge cases where MCP_TIMEOUT and MCP_TOOL_TIMEOUT weren't being respected
- Fixed a regression where search tools unnecessarily asked for permissions
- Added support for triggering thinking non-English languages
- Improved compacting UI

## 1.0.7

- Renamed /allowed-tools -> /permissions
- Migrated allowedTools and ignorePatterns from .claude.json -> settings.json
- Deprecated claude config commands in favor of editing settings.json
- Fixed a bug where --dangerously-skip-permissions sometimes didn't work in --print mode
- Improved error handling for /install-github-app
- Bugfixes, UI polish, and tool reliability improvements

## 1.0.6

- Improved edit reliability for tab-indented files
- Respect CLAUDE_CONFIG_DIR everywhere
- Reduced unnecessary tool permission prompts
- Added support for symlinks in @file typeahead
- Bugfixes, UI polish, and tool reliability improvements

## 1.0.4

- Fixed a bug where MCP tool errors weren't being parsed correctly

## 1.0.1

- Added `DISABLE_INTERLEAVED_THINKING` to give users the option to opt out of interleaved thinking.
- Improved model references to show provider-specific names (Sonnet 3.7 for Bedrock, Sonnet 4 for Console)
- Updated documentation links and OAuth process descriptions

## 1.0.0

- Claude Code is now generally available
- Introducing Sonnet 4 and Opus 4 models

## 0.2.125

- Breaking change: Bedrock ARN passed to `ANTHROPIC_MODEL` or `ANTHROPIC_SMALL_FAST_MODEL` should no longer contain an escaped slash (specify `/` instead of `%2F`)
- Removed `DEBUG=true` in favor of `ANTHROPIC_LOG=debug`, to log all requests

## 0.2.117

- Breaking change: --print JSON output now returns nested message objects, for forwards-compatibility as we introduce new metadata fields
- Introduced settings.cleanupPeriodDays
- Introduced CLAUDE_CODE_API_KEY_HELPER_TTL_MS env var
- Introduced --debug mode

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
