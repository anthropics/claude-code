# Changelog

## 2.1.52

- VS Code: Fixed extension crash on Windows ("command 'claude-vscode.editor.openLast' not found")

## 2.1.51

- Added `claude remote-control` subcommand for external builds, enabling local environment serving for all users.
- Updated plugin marketplace default git timeout from 30s to 120s and added `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` to configure.
- Added support for custom npm registries and specific version pinning when installing plugins from npm sources
- BashTool now skips login shell (`-l` flag) by default when a shell snapshot is available, improving command execution performance. Previously this required setting `CLAUDE_BASH_NO_LOGIN=true`.
- Fixed a security issue where `statusLine` and `fileSuggestion` hook commands could execute without workspace trust acceptance in interactive mode.
- Tool results larger than 50K characters are now persisted to disk (previously 100K). This reduces context window usage and improves conversation longevity.
- Fixed a bug where duplicate `control_response` messages (e.g. from WebSocket reconnects) could cause API 400 errors by pushing duplicate assistant messages into the conversation.
- Added `CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDE_CODE_USER_EMAIL`, and `CLAUDE_CODE_ORGANIZATION_UUID` environment variables for SDK callers to provide account info synchronously, eliminating a race condition where early telemetry events lacked account metadata.
- Fixed slash command autocomplete crashing when a plugin's SKILL.md description is a YAML array or other non-string type
- The `/model` picker now shows human-readable labels (e.g., "Sonnet 4.5") instead of raw model IDs for pinned model versions, with an upgrade hint when a newer version is available.

## 2.1.50

- Added support for `startupTimeout` configuration for LSP servers
- Added `WorktreeCreate` and `WorktreeRemove` hook events, enabling custom VCS setup and teardown when agent worktree isolation creates or removes worktrees.
- Fixed a bug where resumed sessions could be invisible when the working directory involved symlinks, because the session storage path was resolved at different times during startup. Also fixed session data loss on SSH disconnect by flushing session data before hooks and analytics in the graceful shutdown sequence.
- Linux: Fixed native modules not loading on systems with glibc older than 2.30 (e.g., RHEL 8)
- Fixed memory leak in agent teams where completed teammate tasks were never garbage collected from session state
- Fixed `CLAUDE_CODE_SIMPLE` to fully strip down skills, session memory, custom agents, and CLAUDE.md token counting
- Fixed `/mcp reconnect` freezing the CLI when given a server name that doesn't exist
- Fixed memory leak where completed task state objects were never removed from AppState
- Added support for `isolation: worktree` in agent definitions, allowing agents to declaratively run in isolated git worktrees.
- `CLAUDE_CODE_SIMPLE` mode now also disables MCP tools, attachments, hooks, and CLAUDE.md file loading for a fully minimal experience.
- Fixed bug where MCP tools were not discovered when tool search is enabled and a prompt is passed in as a launch argument
- Improved memory usage during long sessions by clearing internal caches after compaction
- Added `claude agents` CLI command to list all configured agents
- Improved memory usage during long sessions by clearing large tool results after they have been processed
- Fixed a memory leak where LSP diagnostic data was never cleaned up after delivery, causing unbounded memory growth in long sessions
- Fixed a memory leak where completed task output was not freed from memory, reducing memory usage in long sessions with many tasks
- Improved startup performance for headless mode (`-p` flag) by deferring Yoga WASM and UI component imports
- Fixed prompt suggestion cache regression that reduced cache hit rates
- Fixed unbounded memory growth in long sessions by capping file history snapshots
- Added `CLAUDE_CODE_DISABLE_1M_CONTEXT` environment variable to disable 1M context window support
- Opus 4.6 (fast mode) now includes the full 1M context window
- VSCode: Added `/extra-usage` command support in VS Code sessions
- Fixed memory leak where TaskOutput retained recent lines after cleanup
- Fixed memory leak in CircularBuffer where cleared items were retained in the backing array
- Fixed memory leak in shell command execution where ChildProcess and AbortController references were retained after cleanup

## 2.1.49

- Improved MCP OAuth authentication with step-up auth support and discovery caching, reducing redundant network requests during server connections
- Added `--worktree` (`-w`) flag to start Claude in an isolated git worktree
- Subagents support `isolation: "worktree"` for working in a temporary git worktree
- Added Ctrl+F keybinding to kill background agents (two-press confirmation)
- Agent definitions support `background: true` to always run as a background task
- Plugins can ship `settings.json` for default configuration
- Fixed file-not-found errors to suggest corrected paths when the model drops the repo folder
- Fixed Ctrl+C and ESC being silently ignored when background agents are running and the main thread is idle. Pressing twice within 3 seconds now kills all background agents.
- Fixed prompt suggestion cache regression that reduced cache hit rates.
- Fixed `plugin enable` and `plugin disable` to auto-detect the correct scope when `--scope` is not specified, instead of always defaulting to user scope
- Simple mode (`CLAUDE_CODE_SIMPLE`) now includes the file edit tool in addition to the Bash tool, allowing direct file editing in simple mode.
- Permission suggestions are now populated when safety checks trigger an ask response, enabling SDK consumers to display permission options
- Sonnet 4.5 with 1M context is being removed from the Max plan in favor of our frontier Sonnet 4.6 model, which now has 1M context. Please switch in /model.
- Fixed verbose mode not updating thinking block display when toggled via `/config` — memo comparators now correctly detect verbose changes
- Fixed unbounded WASM memory growth during long sessions by periodically resetting the tree-sitter parser
- Fixed potential rendering issues caused by stale yoga layout references
- Improved performance in non-interactive mode (`-p`) by skipping unnecessary API calls during startup
- Improved performance by caching authentication failures for HTTP and SSE MCP servers, avoiding repeated connection attempts to servers requiring auth
- Fixed unbounded memory growth during long-running sessions caused by Yoga WASM linear memory never shrinking
- SDK model info now includes `supportsEffort`, `supportedEffortLevels`, and `supportsAdaptiveThinking` fields so consumers can discover model capabilities.
- Added `ConfigChange` hook event that fires when configuration files change during a session, enabling enterprise security auditing and optional blocking of settings changes.
- Improved startup performance by caching MCP auth failures to avoid redundant connection attempts
- Improved startup performance by reducing HTTP calls for analytics token counting
- Improved startup performance by batching MCP tool token counting into a single API call
- Fixed `disableAllHooks` setting to respect managed settings hierarchy — non-managed settings can no longer disable managed hooks set by policy (#26637)
- Fixed `--resume` session picker showing raw XML tags for sessions that start with commands like `/clear`. Now correctly falls through to the session ID fallback.
- Improved permission prompts for path safety and working directory blocks to show the reason for the restriction instead of a bare prompt with no context

## 2.1.47

- Fixed FileWriteTool line counting to preserve intentional trailing blank lines instead of stripping them with `trimEnd()`.
- Fixed Windows terminal rendering bugs caused by `os.EOL` (`\r\n`) in display code — line counts now show correct values instead of always showing 1 on Windows.
- Improved VS Code plan preview: auto-updates as Claude iterates, enables commenting only when the plan is ready for review, and keeps the preview open when rejecting so Claude can revise.
- Fixed a bug where bold and colored text in markdown output could shift to the wrong characters on Windows due to `\r\n` line endings.
- Fixed compaction failing when conversation contains many PDF documents by stripping document blocks alongside images before sending to the compaction API (anthropics/claude-code#26188)
- Improved memory usage in long-running sessions by releasing API stream buffers, agent context, and skill state after use
- Improved startup performance by deferring SessionStart hook execution, reducing time-to-interactive by ~500ms.
- Fixed an issue where bash tool output was silently discarded on Windows when using MSYS2 or Cygwin shells.
- Improved performance of `@` file mentions - file suggestions now appear faster by pre-warming the index on startup and using session-based caching with background refresh.
- Improved memory usage by trimming agent task message history after tasks complete
- Improved memory usage during long agent sessions by eliminating O(n²) message accumulation in progress updates
- Fixed the bash permission classifier to validate that returned match descriptions correspond to actual input rules, preventing hallucinated descriptions from incorrectly granting permissions
- Fixed user-defined agents only loading one file on NFS/FUSE filesystems that report zero inodes (anthropics/claude-code#26044)
- Fixed plugin agent skills silently failing to load when referenced by bare name instead of fully-qualified plugin name (anthropics/claude-code#25834)
- Search patterns in collapsed tool results are now displayed in quotes for clarity
- Windows: Fixed CWD tracking temp files never being cleaned up, causing them to accumulate indefinitely (anthropics/claude-code#17600)
- Use `ctrl+f` to kill all background agents instead of double-pressing ESC. Background agents now continue running when you press ESC to cancel the main thread, giving you more control over agent lifecycle.
- Fixed API 400 errors ("thinking blocks cannot be modified") that occurred in sessions with concurrent agents, caused by interleaved streaming content blocks preventing proper message merging.
- Simplified teammate navigation to use only Shift+Down (with wrapping) instead of both Shift+Up and Shift+Down.
- Fixed an issue where a single file write/edit error would abort all other parallel file write/edit operations. Independent file mutations now complete even when a sibling fails.
- Added `last_assistant_message` field to Stop and SubagentStop hook inputs, providing the final assistant response text so hooks can access it without parsing transcript files.
- Fixed custom session titles set via `/rename` being lost after resuming a conversation (anthropics/claude-code#23610)
- Fixed collapsed read/search hint text overflowing on narrow terminals by truncating from the start.
- Fixed an issue where bash commands with backslash-newline continuation lines (e.g., long commands split across multiple lines with `\`) would produce spurious empty arguments, potentially breaking command execution.
- Fixed built-in slash commands (`/help`, `/model`, `/compact`, etc.) being hidden from the autocomplete dropdown when many user skills are installed (anthropics/claude-code#22020)
- Fixed MCP servers not appearing in the MCP Management Dialog after deferred loading
- Fixed session name persisting in status bar after `/clear` command (anthropics/claude-code#26082)
- Fixed crash when a skill's `name` or `description` in SKILL.md frontmatter is a bare number (e.g., `name: 3000`) — the value is now properly coerced to a string (anthropics/claude-code#25837)
- Fixed /resume silently dropping sessions when the first message exceeds 16KB or uses array-format content (anthropics/claude-code#25721)
- Added `chat:newline` keybinding action for configurable multi-line input (anthropics/claude-code#26075)
- Added `added_dirs` to the statusline JSON `workspace` section, exposing directories added via `/add-dir` to external scripts (anthropics/claude-code#26096)
- Fixed `claude doctor` misclassifying mise and asdf-managed installations as native installs (anthropics/claude-code#26033)
- Fixed zsh heredoc failing with "read-only file system" error in sandboxed commands (anthropics/claude-code#25990)
- Fixed agent progress indicator showing inflated tool use count (anthropics/claude-code#26023)
- Fixed image pasting not working on WSL2 systems where Windows copies images as BMP format (anthropics/claude-code#25935)
- Fixed background agent results returning raw transcript data instead of the agent's final answer (anthropics/claude-code#26012)
- Fixed Warp terminal incorrectly prompting for Shift+Enter setup when it supports it natively (anthropics/claude-code#25957)
- Fixed CJK wide characters causing misaligned timestamps and layout elements in the TUI (anthropics/claude-code#26084)
- Fixed custom agent `model` field in `.claude/agents/*.md` being ignored when spawning team teammates (anthropics/claude-code#26064)
- Fixed plan mode being lost after context compaction, causing the model to switch from planning to implementation mode (anthropics/claude-code#26061)
- Fixed `alwaysThinkingEnabled: true` in settings.json not enabling thinking mode on Bedrock and Vertex providers (anthropics/claude-code#26074)
- Fixed `tool_decision` OTel telemetry event not being emitted in headless/SDK mode (anthropics/claude-code#26059)
- Fixed session name being lost after context compaction — renamed sessions now preserve their custom title through compaction (anthropics/claude-code#26121)
- Increased initial session count in resume picker from 10 to 50 for faster session discovery (anthropics/claude-code#26123)
- Windows: fixed worktree session matching when drive letter casing differs (anthropics/claude-code#26123)
- Fixed `/resume <session-id>` failing to find sessions whose first message exceeds 16KB (anthropics/claude-code#25920)
- Fixed "Always allow" on multiline bash commands creating invalid permission patterns that corrupt settings (anthropics/claude-code#25909)
- Fixed React crash (error #31) when a skill's `argument-hint` in SKILL.md frontmatter uses YAML sequence syntax (e.g., `[topic: foo | bar]`) — the value is now properly coerced to a string (anthropics/claude-code#25826)
- Fixed crash when using `/fork` on sessions that used web search — null entries in search results from transcript deserialization are now handled gracefully (anthropics/claude-code#25811)
- Fixed read-only git commands triggering FSEvents file watcher loops on macOS by adding --no-optional-locks flag (anthropics/claude-code#25750)
- Fixed custom agents and skills not being discovered when running from a git worktree — project-level `.claude/agents/` and `.claude/skills/` from the main repository are now included (anthropics/claude-code#25816)
- Fixed non-interactive subcommands like `claude doctor` and `claude plugin validate` being blocked inside nested Claude sessions (anthropics/claude-code#25803)
- Windows: Fixed the same CLAUDE.md file being loaded twice when drive letter casing differs between paths (anthropics/claude-code#25756)
- Fixed inline code spans in markdown being incorrectly parsed as bash commands (anthropics/claude-code#25792)
- Fixed teammate spinners not respecting custom spinnerVerbs from settings (anthropics/claude-code#25748)
- Fixed shell commands permanently failing after a command deletes its own working directory (anthropics/claude-code#26136)
- Fixed hooks (PreToolUse, PostToolUse) silently failing to execute on Windows by using Git Bash instead of cmd.exe (anthropics/claude-code#25981)
- Fixed LSP `findReferences` and other location-based operations returning results from gitignored files (e.g., `node_modules/`, `venv/`) (anthropics/claude-code#26051)
- Moved config backup files from home directory root to `~/.claude/backups/` to reduce home directory clutter (anthropics/claude-code#26130)
- Fixed sessions with large first prompts (>16KB) disappearing from the /resume list (anthropics/claude-code#26140)
- Fixed shell functions with double-underscore prefixes (e.g., `__git_ps1`) not being preserved across shell sessions (anthropics/claude-code#25824)
- Fixed spinner showing "0 tokens" counter before any tokens have been received (anthropics/claude-code#26105)
- VSCode: Fixed conversation messages appearing dimmed while the AskUserQuestion dialog is open (anthropics/claude-code#26078)
- Fixed background tasks failing in git worktrees due to remote URL resolution reading from worktree-specific gitdir instead of the main repository config (anthropics/claude-code#26065)
- Fixed Right Alt key leaving visible `[25~` escape sequence residue in the input field on Windows/Git Bash terminals (anthropics/claude-code#25943)
- The `/rename` command now updates the terminal tab title by default (anthropics/claude-code#25789)
- Fixed Edit tool silently corrupting Unicode curly quotes (\u201c\u201d \u2018\u2019) by replacing them with straight quotes when making edits (anthropics/claude-code#26141)
- Fixed OSC 8 hyperlinks only being clickable on the first line when link text wraps across multiple terminal lines.

## 2.1.46

- Fixed orphaned CC processes after terminal disconnect on macOS
- Added support for using claude.ai MCP connectors in Claude Code

## 2.1.45

- Added support for Claude Sonnet 4.6
- Added support for reading `enabledPlugins` and `extraKnownMarketplaces` from `--add-dir` directories
- Added `spinnerTipsOverride` setting to customize spinner tips — configure `tips` with an array of custom tip strings, and optionally set `excludeDefault: true` to show only your custom tips instead of the built-in ones
- Added `SDKRateLimitInfo` and `SDKRateLimitEvent` types to the SDK, enabling consumers to receive rate limit status updates including utilization, reset times, and overage information
- Fixed Agent Teams teammates failing on Bedrock, Vertex, and Foundry by propagating API provider environment variables to tmux-spawned processes (anthropics/claude-code#23561)
- Fixed sandbox "operation not permitted" errors when writing temporary files on macOS by using the correct per-user temp directory (anthropics/claude-code#21654)
- Fixed Task tool (backgrounded agents) crashing with a `ReferenceError` on completion (anthropics/claude-code#22087)
- Fixed autocomplete suggestions not being accepted on Enter when images are pasted in the input
- Fixed skills invoked by subagents incorrectly appearing in main session context after compaction
- Fixed excessive `.claude.json.backup` files accumulating on every startup
- Fixed plugin-provided commands, agents, and hooks not being available immediately after installation without requiring a restart
- Improved startup performance by removing eager loading of session history for stats caching
- Improved memory usage for shell commands that produce large output — RSS no longer grows unboundedly with command output size
- Improved collapsed read/search groups to show the current file or search pattern being processed beneath the summary line while active
- [VSCode] Improved permission destination choice (project/user/session) to persist across sessions

## 2.1.44

- Fixed ENAMETOOLONG errors for deeply-nested directory paths
- Fixed auth refresh errors

## 2.1.43

- Fixed AWS auth refresh hanging indefinitely by adding a 3-minute timeout
- Fixed spurious warnings for non-agent markdown files in `.claude/agents/` directory
- Fixed structured-outputs beta header being sent unconditionally on Vertex/Bedrock

## 2.1.42

- Improved startup performance by deferring Zod schema construction
- Improved prompt cache hit rates by moving date out of system prompt
- Added one-time Opus 4.6 effort callout for eligible users
- Fixed /resume showing interrupt messages as session titles
- Fixed image dimension limit errors to suggest /compact

## 2.1.41

- Added guard against launching Claude Code inside another Claude Code session
- Fixed Agent Teams using wrong model identifier for Bedrock, Vertex, and Foundry customers
- Fixed a crash when MCP tools return image content during streaming
- Fixed /resume session previews showing raw XML tags instead of readable command names
- Improved model error messages for Bedrock/Vertex/Foundry users with fallback suggestions
- Fixed plugin browse showing misleading "Space to Toggle" hint for already-installed plugins
- Fixed hook blocking errors (exit code 2) not showing stderr to the user
- Added `speed` attribute to OTel events and trace spans for fast mode visibility
- Added `claude auth login`, `claude auth status`, and `claude auth logout` CLI subcommands
- Added Windows ARM64 (win32-arm64) native binary support
- Improved `/rename` to auto-generate session name from conversation context when called without arguments
- Improved narrow terminal layout for prompt footer
- Fixed file resolution failing for @-mentions with anchor fragments (e.g., `@README.md#installation`)
- Fixed FileReadTool blocking the process on FIFOs, `/dev/stdin`, and large files
- Fixed background task notifications not being delivered in streaming Agent SDK mode
- Fixed cursor jumping to end on each keystroke in classifier rule input
- Fixed markdown link display text being dropped for raw URL
- Fixed auto-compact failure error notifications being shown to users
- Fixed permission wait time being included in subagent elapsed time display
- Fixed proactive ticks firing while in plan mode
- Fixed clear stale permission rules when settings change on disk
- Fixed hook blocking errors showing stderr content in UI

## 2.1.39

- Improved terminal rendering performance
- Fixed fatal errors being swallowed instead of displayed
- Fixed process hanging after session close
- Fixed character loss at terminal screen boundary
- Fixed blank lines in verbose transcript view

## 2.1.38

- Fixed VS Code terminal scroll-to-top regression introduced in 2.1.37
- Fixed Tab key queueing slash commands instead of autocompleting
- Fixed bash permission matching for commands using environment variable wrappers
- Fixed text between tool uses disappearing when not using streaming
- Fixed duplicate sessions when resuming in VS Code extension
- Improved heredoc delimiter parsing to prevent command smuggling
- Blocked writes to `.claude/skills` directory in sandbox mode

## 2.1.37

- Fixed an issue where /fast was not immediately available after enabling /extra-usage

## 2.1.36

- Fast mode is now available for Opus 4.6. Learn more at https://code.claude.com/docs/en/fast-mode

## 2.1.34

- Fixed a crash when agent teams setting changed between renders
- Fixed a bug where commands excluded from sandboxing (via `sandbox.excludedCommands` or `dangerouslyDisableSandbox`) could bypass the Bash ask permission rule when `autoAllowBashIfSandboxed` was enabled

## 2.1.33

- Fixed agent teammate sessions in tmux to send and receive messages
- Fixed warnings about agent teams not being available on your current plan
- Added `TeammateIdle` and `TaskCompleted` hook events for multi-agent workflows
- Added support for restricting which sub-agents can be spawned via `Task(agent_type)` syntax in agent "tools" frontmatter
- Added `memory` frontmatter field support for agents, enabling persistent memory with `user`, `project`, or `local` scope
- Added plugin name to skill descriptions and `/skills` menu for better discoverability
- Fixed an issue where submitting a new message while the model was in extended thinking would interrupt the thinking phase
- Fixed an API error that could occur when aborting mid-stream, where whitespace text combined with a thinking block would bypass normalization and produce an invalid request
- Fixed API proxy compatibility issue where 404 errors on streaming endpoints no longer triggered non-streaming fallback
- Fixed an issue where proxy settings configured via `settings.json` environment variables were not applied to WebFetch and other HTTP requests on the Node.js build
- Fixed `/resume` session picker showing raw XML markup instead of clean titles for sessions started with slash commands
- Improved error messages for API connection failures — now shows specific cause (e.g., ECONNREFUSED, SSL errors) instead of generic "Connection error"
- Errors from invalid managed settings are now surfaced
- VSCode: Added support for remote sessions, allowing OAuth users to browse and resume sessions from claude.ai
- VSCode: Added git branch and message count to the session picker, with support for searching by branch name
- VSCode: Fixed scroll-to-bottom under-scrolling on initial session load and session switch

## 2.1.32

- Claude Opus 4.6 is now available!
- Added research preview agent teams feature for multi-agent collaboration (token-intensive feature, requires setting CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)
- Claude now automatically records and recalls memories as it works
- Added "Summarize from here" to the message selector, allowing partial conversation summarization.
- Skills defined in `.claude/skills/` within additional directories (`--add-dir`) are now loaded automatically.
- Fixed `@` file completion showing incorrect relative paths when running from a subdirectory
- Updated --resume to re-use --agent value specified in previous conversation by default.
- Fixed: Bash tool no longer throws "Bad substitution" errors when heredocs contain JavaScript template literals like `${index + 1}`, which previously interrupted tool execution
- Skill character budget now scales with context window (2% of context), so users with larger context windows can see more skill descriptions without truncation
- Fixed Thai/Lao spacing vowels (สระ า, ำ) not rendering correctly in the input field
- VSCode: Fixed slash commands incorrectly being executed when pressing Enter with preceding text in the input field
- VSCode: Added spinner when loading past conversations list

## 2.1.31

- Added session resume hint on exit, showing how to continue your conversation later
- Added support for full-width (zenkaku) space input from Japanese IME in checkbox selection
- Fixed PDF too large errors permanently locking up sessions, requiring users to start a new conversation
- Fixed bash commands incorrectly reporting failure with "Read-only file system" errors when sandbox mode was enabled
- Fixed a crash that made sessions unusable after entering plan mode when project config in `~/.claude.json` was missing default fields
- Fixed `temperatureOverride` being silently ignored in the streaming API path, causing all streaming requests to use the default temperature (1) regardless of the configured override
- Fixed LSP shutdown/exit compatibility with strict language servers that reject null params
- Improved system prompts to more clearly guide the model toward using dedicated tools (Read, Edit, Glob, Grep) instead of bash equivalents (`cat`, `sed`, `grep`, `find`), reducing unnecessary bash command usage
- Improved PDF and request size error messages to show actual limits (100 pages, 20MB)
- Reduced layout jitter in the terminal when the spinner appears and disappears during streaming
- Removed misleading Anthropic API pricing from model selector for third-party provider (Bedrock, Vertex, Foundry) users

## 2.1.30

- Added `pages` parameter to the Read tool for PDFs, allowing specific page ranges to be read (e.g., `pages: "1-5"`). Large PDFs (>10 pages) now return a lightweight reference when `@` mentioned instead of being inlined into context.
- Added pre-configured OAuth client credentials for MCP servers that don't support Dynamic Client Registration (e.g., Slack). Use `--client-id` and `--client-secret` with `claude mcp add`.
- Added `/debug` for Claude to help troubleshoot the current session
- Added support for additional `git log` and `git show` flags in read-only mode (e.g., `--topo-order`, `--cherry-pick`, `--format`, `--raw`)
- Added token count, tool uses, and duration metrics to Task tool results
- Added reduced motion mode to the config
- Fixed phantom "(no content)" text blocks appearing in API conversation history, reducing token waste and potential model confusion
- Fixed prompt cache not correctly invalidating when tool descriptions or input schemas changed, only when tool names changed
- Fixed 400 errors that could occur after running `/login` when the conversation contained thinking blocks
- Fixed a hang when resuming sessions with corrupted transcript files containing `parentUuid` cycles
- Fixed rate limit message showing incorrect "/upgrade" suggestion for Max 20x users when extra-usage is unavailable
- Fixed permission dialogs stealing focus while actively typing
- Fixed subagents not being able to access SDK-provided MCP tools because they were not synced to the shared application state
- Fixed a regression where Windows users with a `.bashrc` file could not run bash commands
- Improved memory usage for `--resume` (68% reduction for users with many sessions) by replacing the session index with lightweight stat-based loading and progressive enrichment
- Improved `TaskStop` tool to display the stopped command/task description in the result line instead of a generic "Task stopped" message
- Changed `/model` to execute immediately instead of being queued
- [VSCode] Added multiline input support to the "Other" text input in question dialogs (use Shift+Enter for new lines)
- [VSCode] Fixed duplicate sessions appearing in the session list when starting a new conversation

## 2.1.29

- Fixed startup performance issues when resuming sessions that have `saved_hook_context`

## 2.1.27

- Added tool call failures and denials to debug logs
- Fixed context management validation error for gateway users, ensuring `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` avoids the error
- Added `--from-pr` flag to resume sessions linked to a specific GitHub PR number or URL
- Sessions are now automatically linked to PRs when created via `gh pr create`
- Fixed /context command not displaying colored output
- Fixed status bar duplicating background task indicator when PR status was shown
- Windows: Fixed bash command execution failing for users with `.bashrc` files
- Windows: Fixed console windows flashing when spawning child processes
- VSCode: Fixed OAuth token expiration causing 401 errors after extended sessions

## 2.1.25

- Fixed beta header validation error for gateway users on Bedrock and Vertex, ensuring `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` avoids the error

## 2.1.23

- Added customizable spinner verbs setting (`spinnerVerbs`)
- Fixed mTLS and proxy connectivity for users behind corporate proxies or using client certificates
- Fixed per-user temp directory isolation to prevent permission conflicts on shared systems
- Fixed a race condition that could cause 400 errors when prompt caching scope was enabled
- Fixed pending async hooks not being cancelled when headless streaming sessions ended
- Fixed tab completion not updating the input field when accepting a suggestion
- Fixed ripgrep search timeouts silently returning empty results instead of reporting errors
- Improved terminal rendering performance with optimized screen data layout
- Changed Bash commands to show timeout duration alongside elapsed time
- Changed merged pull requests to show a purple status indicator in the prompt footer
- [IDE] Fixed model options displaying incorrect region strings for Bedrock users in headless mode

## 2.1.22

- Fixed structured outputs for non-interactive (-p) mode

## 2.1.21

- Added support for full-width (zenkaku) number input from Japanese IME in option selection prompts
- Fixed shell completion cache files being truncated on exit
- Fixed API errors when resuming sessions that were interrupted during tool execution
- Fixed auto-compact triggering too early on models with large output token limits
- Fixed task IDs potentially being reused after deletion
- Fixed file search not working in VS Code extension on Windows
- Improved read/search progress indicators to show "Reading…" while in progress and "Read" when complete
- Improved Claude to prefer file operation tools (Read, Edit, Write) over bash equivalents (cat, sed, awk)
- [VSCode] Added automatic Python virtual environment activation, ensuring `python` and `pip` commands use the correct interpreter (configurable via `claudeCode.usePythonEnvironment` setting)
- [VSCode] Fixed message action buttons having incorrect background colors

## 2.1.20

- Added arrow key history navigation in vim normal mode when cursor cannot move further
- Added external editor shortcut (Ctrl+G) to the help menu for better discoverability
- Added PR review status indicator to the prompt footer, showing the current branch's PR state (approved, changes requested, pending, or draft) as a colored dot with a clickable link
- Added support for loading `CLAUDE.md` files from additional directories specified via `--add-dir` flag (requires setting `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`)
- Added ability to delete tasks via the `TaskUpdate` tool
- Fixed session compaction issues that could cause resume to load full history instead of the compact summary
- Fixed agents sometimes ignoring user messages sent while actively working on a task
- Fixed wide character (emoji, CJK) rendering artifacts where trailing columns were not cleared when replaced by narrower characters
- Fixed JSON parsing errors when MCP tool responses contain special Unicode characters
- Fixed up/down arrow keys in multi-line and wrapped text input to prioritize cursor movement over history navigation
- Fixed draft prompt being lost when pressing UP arrow to navigate command history
- Fixed ghost text flickering when typing slash commands mid-input
- Fixed marketplace source removal not properly deleting settings
- Fixed duplicate output in some commands like `/context`
- Fixed task list sometimes showing outside the main conversation view
- Fixed syntax highlighting for diffs occurring within multiline constructs like Python docstrings
- Fixed crashes when cancelling tool use
- Improved `/sandbox` command UI to show dependency status with installation instructions when dependencies are missing
- Improved thinking status text with a subtle shimmer animation
- Improved task list to dynamically adjust visible items based on terminal height
- Improved fork conversation hint to show how to resume the original session
- Changed collapsed read/search groups to show present tense ("Reading", "Searching for") while in progress, and past tense ("Read", "Searched for") when complete
- Changed `ToolSearch` results to appear as a brief notification instead of inline in the conversation
- Changed the `/commit-push-pr` skill to automatically post PR URLs to Slack channels when configured via MCP tools
- Changed the `/copy` command to be available to all users
- Changed background agents to prompt for tool permissions before launching
- Changed permission rules like `Bash(*)` to be accepted and treated as equivalent to `Bash`
- Changed config backups to be timestamped and rotated (keeping 5 most recent) to prevent data loss

## 2.1.19

- Added env var `CLAUDE_CODE_ENABLE_TASKS`, set to `false` to keep the old system temporarily
- Added shorthand `$0`, `$1`, etc. for accessing individual arguments in custom commands
- Fixed crashes on processors without AVX instruction support
- Fixed dangling Claude Code processes when terminal is closed by catching EIO errors from `process.exit()` and using SIGKILL as fallback
- Fixed `/rename` and `/tag` not updating the correct session when resuming from a different directory (e.g., git worktrees)
- Fixed resuming sessions by custom title not working when run from a different directory
- Fixed pasted text content being lost when using prompt stash (Ctrl+S) and restore
- Fixed agent list displaying "Sonnet (default)" instead of "Inherit (default)" for agents without an explicit model setting
- Fixed backgrounded hook commands not returning early, potentially causing the session to wait on a process that was intentionally backgrounded
- Fixed file write preview omitting empty lines
- Changed skills without additional permissions or hooks to be allowed without requiring approval
- Changed indexed argument syntax from `$ARGUMENTS.0` to `$ARGUMENTS[0]` (bracket syntax)
- [SDK] Added replay of `queued_command` attachment messages as `SDKUserMessageReplay` events when `replayUserMessages` is enabled
- [VSCode] Enabled session forking and rewind functionality for all users

## 2.1.18

- Added customizable keyboard shortcuts. Configure keybindings per context, create chord sequences, and personalize your workflow. Run `/keybindings` to get started. Learn more at https://code.claude.com/docs/en/keybindings

## 2.1.17

- Fixed crashes on processors without AVX instruction support

## 2.1.16

- Added new task management system, including new capabilities like dependency tracking
- [VSCode] Added native plugin management support
- [VSCode] Added ability for OAuth users to browse and resume remote Claude sessions from the Sessions dialog
- Fixed out-of-memory crashes when resuming sessions with heavy subagent usage
- Fixed an issue where the "context remaining" warning was not hidden after running `/compact`
- Fixed session titles on the resume screen not respecting the user's language setting
- [IDE] Fixed a race condition on Windows where the Claude Code sidebar view container would not appear on start

## 2.1.15

- Added deprecation notification for npm installations - run `claude install` or see https://docs.anthropic.com/en/docs/claude-code/getting-started for more options
- Improved UI rendering performance with React Compiler
- Fixed the "Context left until auto-compact" warning not disappearing after running `/compact`
- Fixed MCP stdio server timeout not killing child process, which could cause UI freezes

## 2.1.14

- Added history-based autocomplete in bash mode (`!`) - type a partial command and press Tab to complete from your bash command history
- Added search to installed plugins list - type to filter by name or description
- Added support for pinning plugins to specific git commit SHAs, allowing marketplace entries to install exact versions
- Fixed a regression where the context window blocking limit was calculated too aggressively, blocking users at ~65% context usage instead of the intended ~98%
- Fixed memory issues that could cause crashes when running parallel subagents
- Fixed memory leak in long-running sessions where stream resources were not cleaned up after shell commands completed
- Fixed `@` symbol incorrectly triggering file autocomplete suggestions in bash mode
- Fixed `@`-mention menu folder click behavior to navigate into directories instead of selecting them
- Fixed `/feedback` command generating invalid GitHub issue URLs when description is very long
- Fixed `/context` command to show the same token count and percentage as the status line in verbose mode
- Fixed an issue where `/config`, `/context`, `/model`, and `/todos` command overlays could close unexpectedly
- Fixed slash command autocomplete selecting wrong command when typing similar commands (e.g., `/context` vs `/compact`)
- Fixed inconsistent back navigation in plugin marketplace when only one marketplace is configured
- Fixed iTerm2 progress bar not clearing properly on exit, preventing lingering indicators and bell sounds
- Improved backspace to delete pasted text as a single token instead of one character at a time
- [VSCode] Added `/usage` command to display current plan usage

## 2.1.12

- Fixed message rendering bug

## 2.1.11

- Fixed excessive MCP connection requests for HTTP/SSE transports

## 2.1.10

- Added new `Setup` hook event that can be triggered via `--init`, `--init-only`, or `--maintenance` CLI flags for repository setup and maintenance operations
- Added keyboard shortcut 'c' to copy OAuth URL when browser doesn't open automatically during login
- Fixed a crash when running bash commands containing heredocs with JavaScript template literals like `${index + 1}`
- Improved startup to capture keystrokes typed before the REPL is fully ready
- Improved file suggestions to show as removable attachments instead of inserting text when accepted
- [VSCode] Added install count display to plugin listings
- [VSCode] Added trust warning when installing plugins

## 2.1.9

- Added `auto:N` syntax for configuring the MCP tool search auto-enable threshold, where N is the context window percentage (0-100)
- Added `plansDirectory` setting to customize where plan files are stored
- Added external editor support (Ctrl+G) in AskUserQuestion "Other" input field
- Added session URL attribution to commits and PRs created from web sessions
- Added support for `PreToolUse` hooks to return `additionalContext` to the model
- Added `${CLAUDE_SESSION_ID}` string substitution for skills to access the current session ID
- Fixed long sessions with parallel tool calls failing with an API error about orphan tool_result blocks
- Fixed MCP server reconnection hanging when cached connection promise never resolves
- Fixed Ctrl+Z suspend not working in terminals using Kitty keyboard protocol (Ghostty, iTerm2, kitty, WezTerm)

## 2.1.7

- Added `showTurnDuration` setting to hide turn duration messages (e.g., "Cooked for 1m 6s")
- Added ability to provide feedback when accepting permission prompts
- Added inline display of agent's final response in task notifications, making it easier to see results without reading the full transcript file
- Fixed security vulnerability where wildcard permission rules could match compound commands containing shell operators
- Fixed false "file modified" errors on Windows when cloud sync tools, antivirus scanners, or Git touch file timestamps without changing content
- Fixed orphaned tool_result errors when sibling tools fail during streaming execution
- Fixed context window blocking limit being calculated using the full context window instead of the effective context window (which reserves space for max output tokens)
- Fixed spinner briefly flashing when running local slash commands like `/model` or `/theme`
- Fixed terminal title animation jitter by using fixed-width braille characters
- Fixed plugins with git submodules not being fully initialized when installed
- Fixed bash commands failing on Windows when temp directory paths contained characters like `t` or `n` that were misinterpreted as escape sequences
- Improved typing responsiveness by reducing memory allocation overhead in terminal rendering
- Enabled MCP tool search auto mode by default for all users. When MCP tool descriptions exceed 10% of the context window, they are automatically deferred and discovered via the MCPSearch tool instead of being loaded upfront. This reduces context usage for users with many MCP tools configured. Users can disable this by adding `MCPSearch` to `disallowedTools` in their settings.
- Changed OAuth and API Console URLs from console.anthropic.com to platform.claude.com
- [VSCode] Fixed `claudeProcessWrapper` setting passing the wrapper path instead of the Claude binary path

## 2.1.6

- Added search functionality to `/config` command for quickly filtering settings
- Added Updates section to `/doctor` showing auto-update channel and available npm versions (stable/latest)
- Added date range filtering to `/stats` command - press `r` to cycle between Last 7 days, Last 30 days, and All time
- Added automatic discovery of skills from nested `.claude/skills` directories when working with files in subdirectories
- Added `context_window.used_percentage` and `context_window.remaining_percentage` fields to status line input for easier context window display
- Added an error display when the editor fails during Ctrl+G
- Fixed permission bypass via shell line continuation that could allow blocked commands to execute
- Fixed false "File has been unexpectedly modified" errors when file watchers touch files without changing content
- Fixed text styling (bold, colors) getting progressively misaligned in multi-line responses
- Fixed the feedback panel closing unexpectedly when typing 'n' in the description field
- Fixed rate limit warning appearing at low usage after weekly reset (now requires 70% usage)
- Fixed rate limit options menu incorrectly auto-opening when resuming a previous session
- Fixed numpad keys outputting escape sequences instead of characters in Kitty keyboard protocol terminals
- Fixed Option+Return not inserting newlines in Kitty keyboard protocol terminals
- Fixed corrupted config backup files accumulating in the home directory (now only one backup is created per config file)
- Fixed `mcp list` and `mcp get` commands leaving orphaned MCP server processes
- Fixed visual artifacts in ink2 mode when nodes become hidden via `display:none`
- Improved the external CLAUDE.md imports approval dialog to show which files are being imported and from where
- Improved the `/tasks` dialog to go directly to task details when there's only one background task running
- Improved @ autocomplete with icons for different suggestion types and single-line formatting
- Updated "Help improve Claude" setting fetch to refresh OAuth and retry when it fails due to a stale OAuth token
- Changed task notification display to cap at 3 lines with overflow summary when multiple background tasks complete simultaneously
- Changed terminal title to "Claude Code" on startup for better window identification
- Removed ability to @-mention MCP servers to enable/disable - use `/mcp enable <name>` instead
- [VSCode] Fixed usage indicator not updating after manual compact

## 2.1.5

- Added `CLAUDE_CODE_TMPDIR` environment variable to override the temp directory used for internal temp files, useful for environments with custom temp directory requirements

## 2.1.4

- Added `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` environment variable to disable all background task functionality including auto-backgrounding and the Ctrl+B shortcut
- Fixed "Help improve Claude" setting fetch to refresh OAuth and retry when it fails due to a stale OAuth token

## 2.1.3

- Merged slash commands and skills, simplifying the mental model with no change in behavior
- Added release channel (`stable` or `latest`) toggle to `/config`
- Added detection and warnings for unreachable permission rules, with warnings in `/doctor` and after saving rules that include the source of each rule and actionable fix guidance
- Fixed plan files persisting across `/clear` commands, now ensuring a fresh plan file is used after clearing a conversation
- Fixed false skill duplicate detection on filesystems with large inodes (e.g., ExFAT) by using 64-bit precision for inode values
- Fixed mismatch between background task count in status bar and items shown in tasks dialog
- Fixed sub-agents using the wrong model during conversation compaction
- Fixed web search in sub-agents using incorrect model
- Fixed trust dialog acceptance when running from the home directory not enabling trust-requiring features like hooks during the session
- Improved terminal rendering stability by preventing uncontrolled writes from corrupting cursor state
- Improved slash command suggestion readability by truncating long descriptions to 2 lines
- Changed tool hook execution timeout from 60 seconds to 10 minutes
- [VSCode] Added clickable destination selector for permission requests, allowing you to choose where settings are saved (this project, all projects, shared with team, or session only)

## 2.1.2

- Added source path metadata to images dragged onto the terminal, helping Claude understand where images originated
- Added clickable hyperlinks for file paths in tool output in terminals that support OSC 8 (like iTerm)
- Added support for Windows Package Manager (winget) installations with automatic detection and update instructions
- Added Shift+Tab keyboard shortcut in plan mode to quickly select "auto-accept edits" option
- Added `FORCE_AUTOUPDATE_PLUGINS` environment variable to allow plugin autoupdate even when the main auto-updater is disabled
- Added `agent_type` to SessionStart hook input, populated if `--agent` is specified
- Fixed a command injection vulnerability in bash command processing where malformed input could execute arbitrary commands
- Fixed a memory leak where tree-sitter parse trees were not being freed, causing WASM memory to grow unbounded over long sessions
- Fixed binary files (images, PDFs, etc.) being accidentally included in memory when using `@include` directives in CLAUDE.md files
- Fixed updates incorrectly claiming another installation is in progress
- Fixed crash when socket files exist in watched directories (defense-in-depth for EOPNOTSUPP errors)
- Fixed remote session URL and teleport being broken when using `/tasks` command
- Fixed MCP tool names being exposed in analytics events by sanitizing user-specific server configurations
- Improved Option-as-Meta hint on macOS to show terminal-specific instructions for native CSIu terminals like iTerm2, Kitty, and WezTerm
- Improved error message when pasting images over SSH to suggest using `scp` instead of the unhelpful clipboard shortcut hint
- Improved permission explainer to not flag routine dev workflows (git fetch/rebase, npm install, tests, PRs) as medium risk
- Changed large bash command outputs to be saved to disk instead of truncated, allowing Claude to read the full content
- Changed large tool outputs to be persisted to disk instead of truncated, providing full output access via file references
- Changed `/plugins` installed tab to unify plugins and MCPs with scope-based grouping
- Deprecated Windows managed settings path `C:\ProgramData\ClaudeCode\managed-settings.json` - administrators should migrate to `C:\Program Files\ClaudeCode\managed-settings.json`
- [SDK] Changed minimum zod peer dependency to ^4.0.0
- [VSCode] Fixed usage display not updating after manual compact

## 2.1.0

- Added automatic skill hot-reload - skills created or modified in `~/.claude/skills` or `.claude/skills` are now immediately available without restarting the session
- Added support for running skills and slash commands in a forked sub-agent context using `context: fork` in skill frontmatter
- Added support for `agent` field in skills to specify agent type for execution
- Added `language` setting to configure Claude's response language (e.g., language: "japanese")
- Changed Shift+Enter to work out of the box in iTerm2, WezTerm, Ghostty, and Kitty without modifying terminal configs
- Added `respectGitignore` support in `settings.json` for per-project control over @-mention file picker behavior
- Added `IS_DEMO` environment variable to hide email and organization from the UI, useful for streaming or recording sessions
- Fixed security issue where sensitive data (OAuth tokens, API keys, passwords) could be exposed in debug logs
- Fixed files and skills not being properly discovered when resuming sessions with `-c` or `--resume`
- Fixed pasted content being lost when replaying prompts from history using up arrow or Ctrl+R search
- Fixed Esc key with queued prompts to only move them to input without canceling the running task
- Reduced permission prompts for complex bash commands
- Fixed command search to prioritize exact and prefix matches on command names over fuzzy matches in descriptions
- Fixed PreToolUse hooks to allow `updatedInput` when returning `ask` permission decision, enabling hooks to act as middleware while still requesting user consent
- Fixed plugin path resolution for file-based marketplace sources
- Fixed LSP tool being incorrectly enabled when no LSP servers were configured
- Fixed background tasks failing with "git repository not found" error for repositories with dots in their names
- Fixed Claude in Chrome support for WSL environments
- Fixed Windows native installer silently failing when executable creation fails
- Improved CLI help output to display options and subcommands in alphabetical order for easier navigation
- Added wildcard pattern matching for Bash tool permissions using `*` at any position in rules (e.g., `Bash(npm *)`, `Bash(* install)`, `Bash(git * main)`)
- Added unified Ctrl+B backgrounding for both bash commands and agents - pressing Ctrl+B now backgrounds all running foreground tasks simultaneously
- Added support for MCP `list_changed` notifications, allowing MCP servers to dynamically update their available tools, prompts, and resources without requiring reconnection
- Added `/teleport` and `/remote-env` slash commands for claude.ai subscribers, allowing them to resume and configure remote sessions
- Added support for disabling specific agents using `Task(AgentName)` syntax in settings.json permissions or the `--disallowedTools` CLI flag
- Added hooks support to agent frontmatter, allowing agents to define PreToolUse, PostToolUse, and Stop hooks scoped to the agent's lifecycle
- Added hooks support for skill and slash command frontmatter
- Added new Vim motions: `;` and `,` to repeat f/F/t/T motions, `y` operator for yank with `yy`/`Y`, `p`/`P` for paste, text objects (`iw`, `aw`, `iW`, `aW`, `i"`, `a"`, `i'`, `a'`, `i(`, `a(`, `i[`, `a[`, `i{`, `a{`), `>>` and `<<` for indent/dedent, and `J` to join lines
- Added `/plan` command shortcut to enable plan mode directly from the prompt
- Added slash command autocomplete support when `/` appears anywhere in input, not just at the beginning
- Added `--tools` flag support in interactive mode to restrict which built-in tools Claude can use during interactive sessions
- Added `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` environment variable to override the default file read token limit
- Added support for `once: true` config for hooks
- Added support for YAML-style lists in frontmatter `allowed-tools` field for cleaner skill declarations
- Added support for prompt and agent hook types from plugins (previously only command hooks were supported)
- Added Cmd+V support for image paste in iTerm2 (maps to Ctrl+V)
- Added left/right arrow key navigation for cycling through tabs in dialogs
- Added real-time thinking block display in Ctrl+O transcript mode
- Added filepath to full output in background bash task details dialog
- Added Skills as a separate category in the context visualization
- Fixed OAuth token refresh not triggering when server reports token expired but local expiration check disagrees
- Fixed session persistence getting stuck after transient server errors by recovering from 409 conflicts when the entry was actually stored
- Fixed session resume failures caused by orphaned tool results during concurrent tool execution
- Fixed a race condition where stale OAuth tokens could be read from the keychain cache during concurrent token refresh attempts
- Fixed AWS Bedrock subagents not inheriting EU/APAC cross-region inference model configuration, causing 403 errors when IAM permissions are scoped to specific regions
- Fixed API context overflow when background tasks produce large output by truncating to 30K chars with file path reference
- Fixed a hang when reading FIFO files by skipping symlink resolution for special file types
- Fixed terminal keyboard mode not being reset on exit in Ghostty, iTerm2, Kitty, and WezTerm
- Fixed Alt+B and Alt+F (word navigation) not working in iTerm2, Ghostty, Kitty, and WezTerm
- Fixed `${CLAUDE_PLUGIN_ROOT}` not being substituted in plugin `allowed-tools` frontmatter, which caused tools to incorrectly require approval
- Fixed files created by the Write tool using hardcoded 0o600 permissions instead of respecting the system umask
- Fixed commands with `$()` command substitution failing with parse errors
- Fixed multi-line bash commands with backslash continuations being incorrectly split and flagged for permissions
- Fixed bash command prefix extraction to correctly identify subcommands after global options (e.g., `git -C /path log` now correctly matches `Bash(git log:*)` rules)
- Fixed slash commands passed as CLI arguments (e.g., `claude /context`) not being executed properly
- Fixed pressing Enter after Tab-completing a slash command selecting a different command instead of submitting the completed one
- Fixed slash command argument hint flickering and inconsistent display when typing commands with arguments
- Fixed Claude sometimes redundantly invoking the Skill tool when running slash commands directly
- Fixed skill token estimates in `/context` to accurately reflect frontmatter-only loading
- Fixed subagents sometimes not inheriting the parent's model by default
- Fixed model picker showing incorrect selection for Bedrock/Vertex users using `--model haiku`
- Fixed duplicate Bash commands appearing in permission request option labels
- Fixed noisy output when background tasks complete - now shows clean completion message instead of raw output
- Fixed background task completion notifications to appear proactively with bullet point
- Fixed forked slash commands showing "AbortError" instead of "Interrupted" message when cancelled
- Fixed cursor disappearing after dismissing permission dialogs
- Fixed `/hooks` menu selecting wrong hook type when scrolling to a different option
- Fixed images in queued prompts showing as "[object Object]" when pressing Esc to cancel
- Fixed images being silently dropped when queueing messages while backgrounding a task
- Fixed large pasted images failing with "Image was too large" error
- Fixed extra blank lines in multiline prompts containing CJK characters (Japanese, Chinese, Korean)
- Fixed ultrathink keyword highlighting being applied to wrong characters when user prompt text wraps to multiple lines
- Fixed collapsed "Reading X files…" indicator incorrectly switching to past tense when thinking blocks appear mid-stream
- Fixed Bash read commands (like `ls` and `cat`) not being counted in collapsed read/search groups, causing groups to incorrectly show "Read 0 files"
- Fixed spinner token counter to properly accumulate tokens from subagents during execution
- Fixed memory leak in git diff parsing where sliced strings retained large parent strings
- Fixed race condition where LSP tool could return "no server available" during startup
- Fixed feedback submission hanging indefinitely when network requests timeout
- Fixed search mode in plugin discovery and log selector views exiting when pressing up arrow
- Fixed hook success message showing trailing colon when hook has no output
- Multiple optimizations to improve startup performance
- Improved terminal rendering performance when using native installer or Bun, especially for text with emoji, ANSI codes, and Unicode characters
- Improved performance when reading Jupyter notebooks with many cells
- Improved reliability for piped input like `cat refactor.md | claude`
- Improved reliability for AskQuestion tool
- Improved sed in-place edit commands to render as file edits with diff preview
- Improved Claude to automatically continue when response is cut off due to output token limit, instead of showing an error message
- Improved compaction reliability
- Improved subagents (Task tool) to continue working after permission denial, allowing them to try alternative approaches
- Improved skills to show progress while executing, displaying tool uses as they happen
- Improved skills from `/skills/` directories to be visible in the slash command menu by default (opt-out with `user-invocable: false` in frontmatter)
- Improved skill suggestions to prioritize recently and frequently used skills
- Improved spinner feedback when waiting for the first response token
- Improved token count display in spinner to include tokens from background agents
- Improved incremental output for async agents to give the main thread more control and visibility
- Improved permission prompt UX with Tab hint moved to footer, cleaner Yes/No input labels with contextual placeholders
- Improved the Claude in Chrome notification with shortened help text and persistent display until dismissed
- Improved macOS screenshot paste reliability with TIFF format support
- Improved `/stats` output
- Updated Atlassian MCP integration to use a more reliable default configuration (streamable HTTP)
- Changed "Interrupted" message color from red to grey for a less alarming appearance
- Removed permission prompt when entering plan mode - users can now enter plan mode without approval
- Removed underline styling from image reference links
- [SDK] Changed minimum zod peer dependency to ^4.0.0
- [VSCode] Added currently selected model name to the context menu
- [VSCode] Added descriptive labels on auto-accept permission button (e.g., "Yes, allow npm for this project" instead of "Yes, and don't ask again")
- [VSCode] Fixed paragraph breaks not rendering in markdown content
- [VSCode] Fixed scrolling in the extension inadvertently scrolling the parent iframe
- [Windows] Fixed issue with improper rendering

## 2.0.76

- Fixed issue with macOS code-sign warning when using Claude in Chrome integration

## 2.0.75

- Minor bugfixes

## 2.0.74

- Added LSP (Language Server Protocol) tool for code intelligence features like go-to-definition, find references, and hover documentation
- Added `/terminal-setup` support for Kitty, Alacritty, Zed, and Warp terminals
- Added ctrl+t shortcut in `/theme` to toggle syntax highlighting on/off
- Added syntax highlighting info to theme picker
- Added guidance for macOS users when Alt shortcuts fail due to terminal configuration
- Fixed skill `allowed-tools` not being applied to tools invoked by the skill
- Fixed Opus 4.5 tip incorrectly showing when user was already using Opus
- Fixed a potential crash when syntax highlighting isn't initialized correctly
- Fixed visual bug in `/plugins discover` where list selection indicator showed while search box was focused
- Fixed macOS keyboard shortcuts to display 'opt' instead of 'alt'
- Improved `/context` command visualization with grouped skills and agents by source, slash commands, and sorted token count
- [Windows] Fixed issue with improper rendering
- [VSCode] Added gift tag pictogram for year-end promotion message

## 2.0.73

- Added clickable `[Image #N]` links that open attached images in the default viewer
- Added alt-y yank-pop to cycle through kill ring history after ctrl-y yank
- Added search filtering to the plugin discover screen (type to filter by name, description, or marketplace)
- Added support for custom session IDs when forking sessions with `--session-id` combined with `--resume` or `--continue` and `--fork-session`
- Fixed slow input history cycling and race condition that could overwrite text after message submission
- Improved `/theme` command to open theme picker directly
- Improved theme picker UI
- Improved search UX across resume session, permissions, and plugins screens with a unified SearchBox component
- [VSCode] Added tab icon badges showing pending permissions (blue) and unread completions (orange)

## 2.0.72

- Added Claude in Chrome (Beta) feature that works with the Chrome extension (https://claude.ai/chrome) to let you control your browser directly from Claude Code
- Reduced terminal flickering
- Added scannable QR code to mobile app tip for quick app downloads
- Added loading indicator when resuming conversations for better feedback
- Fixed `/context` command not respecting custom system prompts in non-interactive mode
- Fixed order of consecutive Ctrl+K lines when pasting with Ctrl+Y
- Improved @ mention file suggestion speed (~3× faster in git repositories)
- Improved file suggestion performance in repos with `.ignore` or `.rgignore` files
- Improved settings validation errors to be more prominent
- Changed thinking toggle from Tab to Alt+T to avoid accidental triggers

## 2.0.71

- Added /config toggle to enable/disable prompt suggestions
- Added `/settings` as an alias for the `/config` command
- Fixed @ file reference suggestions incorrectly triggering when cursor is in the middle of a path
- Fixed MCP servers from `.mcp.json` not loading when using `--dangerously-skip-permissions`
- Fixed permission rules incorrectly rejecting valid bash commands containing shell glob patterns (e.g., `ls *.txt`, `for f in *.png`)
- Bedrock: Environment variable `ANTHROPIC_BEDROCK_BASE_URL` is now respected for token counting and inference profile listing
- New syntax highlighting engine for native build

## 2.0.70

- Added Enter key to accept and submit prompt suggestions immediately (tab still accepts for editing)
- Added wildcard syntax `mcp__server__*` for MCP tool permissions to allow or deny all tools from a server
- Added auto-update toggle for plugin marketplaces, allowing per-marketplace control over automatic updates
- Added `current_usage` field to status line input, enabling accurate context window percentage calculations
- Fixed input being cleared when processing queued commands while the user was typing
- Fixed prompt suggestions replacing typed input when pressing Tab
- Fixed diff view not updating when terminal is resized
- Improved memory usage by 3x for large conversations
- Improved resolution of stats screenshots copied to clipboard (Ctrl+S) for crisper images
- Removed # shortcut for quick memory entry (tell Claude to edit your CLAUDE.md instead)
- Fix thinking mode toggle in /config not persisting correctly
- Improve UI for file creation permission dialog

## 2.0.69

- Minor bugfixes

## 2.0.68

- Fixed IME (Input Method Editor) support for languages like Chinese, Japanese, and Korean by correctly positioning the composition window at the cursor
- Fixed a bug where disallowed MCP tools were visible to the model
- Fixed an issue where steering messages could be lost while a subagent is working
- Fixed Option+Arrow word navigation treating entire CJK (Chinese, Japanese, Korean) text sequences as a single word instead of navigating by word boundaries
- Improved plan mode exit UX: show simplified yes/no dialog when exiting with empty or missing plan instead of throwing an error
- Add support for enterprise managed settings. Contact your Anthropic account team to enable this feature.

## 2.0.67

- Thinking mode is now enabled by default for Opus 4.5
- Thinking mode configuration has moved to /config
- Added search functionality to `/permissions` command with `/` keyboard shortcut for filtering rules by tool name
- Show reason why autoupdater is disabled in `/doctor`
- Fixed false "Another process is currently updating Claude" error when running `claude update` while another instance is already on the latest version
- Fixed MCP servers from `.mcp.json` being stuck in pending state when running in non-interactive mode (`-p` flag or piped input)
- Fixed scroll position resetting after deleting a permission rule in `/permissions`
- Fixed word deletion (opt+delete) and word navigation (opt+arrow) not working correctly with non-Latin text such as Cyrillic, Greek, Arabic, Hebrew, Thai, and Chinese
- Fixed `claude install --force` not bypassing stale lock files
- Fixed consecutive @~/ file references in CLAUDE.md being incorrectly parsed due to markdown strikethrough interference
- Windows: Fixed plugin MCP servers failing due to colons in log directory paths

## 2.0.65

- Added ability to switch models while writing a prompt using alt+p (linux, windows), option+p (macos).
- Added context window information to status line input
- Added `fileSuggestion` setting for custom `@` file search commands
- Added `CLAUDE_CODE_SHELL` environment variable to override automatic shell detection (useful when login shell differs from actual working shell)
- Fixed prompt not being saved to history when aborting a query with Escape
- Fixed Read tool image handling to identify format from bytes instead of file extension

## 2.0.64

- Made auto-compacting instant
- Agents and bash commands can run asynchronously and send messages to wake up the main agent
- /stats now provides users with interesting CC stats, such as favorite model, usage graph, usage streak
- Added named session support: use `/rename` to name sessions, `/resume <name>` in REPL or `claude --resume <name>` from the terminal to resume them
- Added support for .claude/rules/`.  See https://code.claude.com/docs/en/memory for details.
- Added image dimension metadata when images are resized, enabling accurate coordinate mappings for large images
- Fixed auto-loading .env when using native installer
- Fixed `--system-prompt` being ignored when using `--continue` or `--resume` flags
- Improved `/resume` screen with grouped forked sessions and keyboard shortcuts for preview (P) and rename (R)
- VSCode: Added copy-to-clipboard button on code blocks and bash tool inputs
- VSCode: Fixed extension not working on Windows ARM64 by falling back to x64 binary via emulation
- Bedrock: Improve efficiency of token counting
- Bedrock: Add support for `aws login` AWS Management Console credentials
- Unshipped AgentOutputTool and BashOutputTool, in favor of a new unified TaskOutputTool

## 2.0.62

- Added "(Recommended)" indicator for multiple-choice questions, with the recommended option moved to the top of the list
- Added `attribution` setting to customize commit and PR bylines (deprecates `includeCoAuthoredBy`)
- Fixed duplicate slash commands appearing when ~/.claude is symlinked to a project directory
- Fixed slash command selection not working when multiple commands share the same name
- Fixed an issue where skill files inside symlinked skill directories could become circular symlinks
- Fixed running versions getting removed because lock file incorrectly going stale
- Fixed IDE diff tab not closing when rejecting file changes

## 2.0.61

- Reverted VSCode support for multiple terminal clients due to responsiveness issues.

## 2.0.60

- Added background agent support. Agents run in the background while you work
- Added --disable-slash-commands CLI flag to disable all slash commands
- Added model name to "Co-Authored-By" commit messages
- Enabled "/mcp enable [server-name]" or "/mcp disable [server-name]" to quickly toggle all servers
- Updated Fetch to skip summarization for pre-approved websites
- VSCode: Added support for multiple terminal clients connecting to the IDE server simultaneously

## 2.0.59

- Added --agent CLI flag to override the agent setting for the current session
- Added `agent` setting to configure main thread with a specific agent's system prompt, tool restrictions, and model
- VS Code: Fixed .claude.json config file being read from incorrect location

## 2.0.58

- Pro users now have access to Opus 4.5 as part of their subscription!
- Fixed timer duration showing "11m 60s" instead of "12m 0s"
- Windows: Managed settings now prefer `C:\Program Files\ClaudeCode` if it exists. Support for `C:\ProgramData\ClaudeCode` will be removed in a future version.

## 2.0.57

- Added feedback input when rejecting plans, allowing users to tell Claude what to change
- VSCode: Added streaming message support for real-time response display

## 2.0.56

- Added setting to enable/disable terminal progress bar (OSC 9;4)
- VSCode Extension: Added support for VS Code's secondary sidebar (VS Code 1.97+), allowing Claude Code to be displayed in the right sidebar while keeping the file explorer on the left. Requires setting sidebar as Preferred Location in the config.

## 2.0.55

- Fixed proxy DNS resolution being forced on by default. Now opt-in via `CLAUDE_CODE_PROXY_RESOLVES_HOSTS=true` environment variable
- Fixed keyboard navigation becoming unresponsive when holding down arrow keys in memory location selector
- Improved AskUserQuestion tool to auto-submit single-select questions on the last question, eliminating the extra review screen for simple question flows
- Improved fuzzy matching for `@` file suggestions with faster, more accurate results

## 2.0.54

- Hooks: Enable PermissionRequest hooks to process 'always allow' suggestions and apply permission updates
- Fix issue with excessive iTerm notifications

## 2.0.52

- Fixed duplicate message display when starting Claude with a command line argument
- Fixed `/usage` command progress bars to fill up as usage increases (instead of showing remaining percentage)
- Fixed image pasting not working on Linux systems running Wayland (now falls back to wl-paste when xclip is unavailable)
- Permit some uses of `$!` in bash commands

## 2.0.51

- Added Opus 4.5! https://www.anthropic.com/news/claude-opus-4-5
- Introducing Claude Code for Desktop: https://claude.com/download
- To give you room to try out our new model, we've updated usage limits for Claude Code users. See the Claude Opus 4.5 blog for full details
- Pro users can now purchase extra usage for access to Opus 4.5 in Claude Code
- Plan Mode now builds more precise plans and executes more thoroughly
- Usage limit notifications now easier to understand
- Switched `/usage` back to "% used"
- Fixed handling of thinking errors
- Fixed performance regression

## 2.0.50

- Fixed bug preventing calling MCP tools that have nested references in their input schemas
- Silenced a noisy but harmless error during upgrades
- Improved ultrathink text display
- Improved clarity of 5-hour session limit warning message

## 2.0.49

- Added readline-style ctrl-y for pasting deleted text
- Improved clarity of usage limit warning message
- Fixed handling of subagent permissions

## 2.0.47

- Improved error messages and validation for `claude --teleport`
- Improved error handling in `/usage`
- Fixed race condition with history entry not getting logged at exit
- Fixed Vertex AI configuration not being applied from `settings.json`

## 2.0.46

- Fixed image files being reported with incorrect media type when format cannot be detected from metadata

## 2.0.45

- Added support for Microsoft Foundry! See https://code.claude.com/docs/en/azure-ai-foundry
- Added `PermissionRequest` hook to automatically approve or deny tool permission requests with custom logic
- Send background tasks to Claude Code on the web by starting a message with `&`

## 2.0.43

- Added `permissionMode` field for custom agents
- Added `tool_use_id` field to `PreToolUseHookInput` and `PostToolUseHookInput` types
- Added skills frontmatter field to declare skills to auto-load for subagents
- Added the `SubagentStart` hook event
- Fixed nested `CLAUDE.md` files not loading when @-mentioning files
- Fixed duplicate rendering of some messages in the UI
- Fixed some visual flickers
- Fixed NotebookEdit tool inserting cells at incorrect positions when cell IDs matched the pattern `cell-N`

## 2.0.42

- Added `agent_id` and `agent_transcript_path` fields to `SubagentStop` hooks.

## 2.0.41

- Added `model` parameter to prompt-based stop hooks, allowing users to specify a custom model for hook evaluation
- Fixed slash commands from user settings being loaded twice, which could cause rendering issues
- Fixed incorrect labeling of user settings vs project settings in command descriptions
- Fixed crash when plugin command hooks timeout during execution
- Fixed: Bedrock users no longer see duplicate Opus entries in the /model picker when using `--model haiku`
- Fixed broken security documentation links in trust dialogs and onboarding
- Fixed issue where pressing ESC to close the diff modal would also interrupt the model
- ctrl-r history search landing on a slash command no longer cancels the search
- SDK: Support custom timeouts for hooks
- Allow more safe git commands to run without approval
- Plugins: Added support for sharing and installing output styles
- Teleporting a session from web will automatically set the upstream branch

## 2.0.37

- Fixed how idleness is computed for notifications
- Hooks: Added matcher values for Notification hook events
- Output Styles: Added `keep-coding-instructions` option to frontmatter

## 2.0.36

- Fixed: DISABLE_AUTOUPDATER environment variable now properly disables package manager update notifications
- Fixed queued messages being incorrectly executed as bash commands
- Fixed input being lost when typing while a queued message is processed

## 2.0.35

- Improve fuzzy search results when searching commands
- Improved VS Code extension to respect `chat.fontSize` and `chat.fontFamily` settings throughout the entire UI, and apply font changes immediately without requiring reload
- Added `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY` environment variable to automatically exit SDK mode after a specified idle duration, useful for automated workflows and scripts
- Migrated `ignorePatterns` from project config to deny permissions in the localSettings.
- Fixed menu navigation getting stuck on items with empty string or other falsy values (e.g., in the `/hooks` menu)

## 2.0.34

- VSCode Extension: Added setting to configure the initial permission mode for new conversations
- Improved file path suggestion performance with native Rust-based fuzzy finder
- Fixed infinite token refresh loop that caused MCP servers with OAuth (e.g., Slack) to hang during connection
- Fixed memory crash when reading or writing large files (especially base64-encoded images)

## 2.0.33

- Native binary installs now launch quicker.
- Fixed `claude doctor` incorrectly detecting Homebrew vs npm-global installations by properly resolving symlinks
- Fixed `claude mcp serve` exposing tools with incompatible outputSchemas

## 2.0.32

- Un-deprecate output styles based on community feedback
- Added `companyAnnouncements` setting for displaying announcements on startup
- Fixed hook progress messages not updating correctly during PostToolUse hook execution

## 2.0.31

- Windows: native installation uses shift+tab as shortcut for mode switching, instead of alt+m
- Vertex: add support for Web Search on supported models
- VSCode: Adding the respectGitIgnore configuration to include .gitignored files in file searches (defaults to true)
- Fixed a bug with subagents and MCP servers related to "Tool names must be unique" error
- Fixed issue causing `/compact` to fail with `prompt_too_long` by making it respect existing compact boundaries
- Fixed plugin uninstall not removing plugins

## 2.0.30

- Added helpful hint to run `security unlock-keychain` when encountering API key errors on macOS with locked keychain
- Added `allowUnsandboxedCommands` sandbox setting to disable the dangerouslyDisableSandbox escape hatch at policy level
- Added `disallowedTools` field to custom agent definitions for explicit tool blocking
- Added prompt-based stop hooks
- VSCode: Added respectGitIgnore configuration to include .gitignored files in file searches (defaults to true)
- Enabled SSE MCP servers on native build
- Deprecated output styles. Review options in `/output-style` and use --system-prompt-file, --system-prompt, --append-system-prompt, CLAUDE.md, or plugins instead
- Removed support for custom ripgrep configuration, resolving an issue where Search returns no results and config discovery fails
- Fixed Explore agent creating unwanted .md investigation files during codebase exploration
- Fixed a bug where `/context` would sometimes fail with "max_tokens must be greater than thinking.budget_tokens" error message
- Fixed `--mcp-config` flag to correctly override file-based MCP configurations
- Fixed bug that saved session permissions to local settings
- Fixed MCP tools not being available to sub-agents
- Fixed hooks and plugins not executing when using --dangerously-skip-permissions flag
- Fixed delay when navigating through typeahead suggestions with arrow keys
- VSCode: Restored selection indicator in input footer showing current file or code selection status

## 2.0.28

- Plan mode: introduced new Plan subagent
- Subagents: claude can now choose to resume subagents
- Subagents: claude can dynamically choose the model used by its subagents
- SDK: added --max-budget-usd flag
- Discovery of custom slash commands, subagents, and output styles no longer respects .gitignore
- Stop `/terminal-setup` from adding backslash to `Shift + Enter` in VS Code
- Add branch and tag support for git-based plugins and marketplaces using fragment syntax (e.g., `owner/repo#branch`)
- Fixed a bug where macOS permission prompts would show up upon initial launch when launching from home directory
- Various other bug fixes

## 2.0.27

- New UI for permission prompts
- Added current branch filtering and search to session resume screen for easier navigation
- Fixed directory @-mention causing "No assistant message found" error
- VSCode Extension: Add config setting to include .gitignored files in file searches
- VSCode Extension: Bug fixes for unrelated 'Warmup' conversations, and configuration/settings occasionally being reset to defaults

## 2.0.25

- Removed legacy SDK entrypoint. Please migrate to @anthropic-ai/claude-agent-sdk for future SDK updates: https://platform.claude.com/docs/en/agent-sdk/migration-guide

## 2.0.24

- Fixed a bug where project-level skills were not loading when --setting-sources 'project' was specified
- Claude Code Web: Support for Web -> CLI teleport
- Sandbox: Releasing a sandbox mode for the BashTool on Linux & Mac
- Bedrock: Display awsAuthRefresh output when auth is required

## 2.0.22

- Fixed content layout shift when scrolling through slash commands
- IDE: Add toggle to enable/disable thinking.
- Fix bug causing duplicate permission prompts with parallel tool calls
- Add support for enterprise managed MCP allowlist and denylist

## 2.0.21

- Support MCP `structuredContent` field in tool responses
- Added an interactive question tool
- Claude will now ask you questions more often in plan mode
- Added Haiku 4.5 as a model option for Pro users
- Fixed an issue where queued commands don't have access to previous messages' output

## 2.0.20

- Added support for Claude Skills

## 2.0.19

- Auto-background long-running bash commands instead of killing them. Customize with BASH_DEFAULT_TIMEOUT_MS
- Fixed a bug where Haiku was unnecessarily called in print mode

## 2.0.17

- Added Haiku 4.5 to model selector!
- Haiku 4.5 automatically uses Sonnet in plan mode, and Haiku for execution (i.e. SonnetPlan by default)
- 3P (Bedrock and Vertex) are not automatically upgraded yet. Manual upgrading can be done through setting `ANTHROPIC_DEFAULT_HAIKU_MODEL`
- Introducing the Explore subagent. Powered by Haiku it'll search through your codebase efficiently to save context!
- OTEL: support HTTP_PROXY and HTTPS_PROXY
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` now disables release notes fetching

## 2.0.15

- Fixed bug with resuming where previously created files needed to be read again before writing
- Fixed bug with `-p` mode where @-mentioned files needed to be read again before writing

## 2.0.14

- Fix @-mentioning MCP servers to toggle them on/off
- Improve permission checks for bash with inline env vars
- Fix ultrathink + thinking toggle
- Reduce unnecessary logins
- Document --system-prompt
- Several improvements to rendering
- Plugins UI polish

## 2.0.13

- Fixed `/plugin` not working on native build

## 2.0.12

- **Plugin System Released**: Extend Claude Code with custom commands, agents, hooks, and MCP servers from marketplaces
- `/plugin install`, `/plugin enable/disable`, `/plugin marketplace` commands for plugin management
- Repository-level plugin configuration via `extraKnownMarketplaces` for team collaboration
- `/plugin validate` command for validating plugin structure and configuration
- Plugin announcement blog post at https://www.anthropic.com/news/claude-code-plugins
- Plugin documentation available at https://code.claude.com/docs/en/plugins
- Comprehensive error messages and diagnostics via `/doctor` command
- Avoid flickering in `/model` selector
- Improvements to `/help`
- Avoid mentioning hooks in `/resume` summaries
- Changes to the "verbose" setting in `/config` now persist across sessions

## 2.0.11

- Reduced system prompt size by 1.4k tokens
- IDE: Fixed keyboard shortcuts and focus issues for smoother interaction
- Fixed Opus fallback rate limit errors appearing incorrectly
- Fixed /add-dir command selecting wrong default tab

## 2.0.10

- Rewrote terminal renderer for buttery smooth UI
- Enable/disable MCP servers by @mentioning, or in /mcp
- Added tab completion for shell commands in bash mode
- PreToolUse hooks can now modify tool inputs
- Press Ctrl-G to edit your prompt in your system's configured text editor
- Fixes for bash permission checks with environment variables in the command

## 2.0.9

- Fix regression where bash backgrounding stopped working

## 2.0.8

- Update Bedrock default Sonnet model to `global.anthropic.claude-sonnet-4-5-20250929-v1:0`
- IDE: Add drag-and-drop support for files and folders in chat
- /context: Fix counting for thinking blocks
- Improve message rendering for users with light themes on dark terminals
- Remove deprecated .claude.json allowedTools, ignorePatterns, env, and todoFeatureEnabled config options (instead, configure these in your settings.json)

## 2.0.5

- IDE: Fix IME unintended message submission with Enter and Tab
- IDE: Add "Open in Terminal" link in login screen
- Fix unhandled OAuth expiration 401 API errors
- SDK: Added SDKUserMessageReplay.isReplay to prevent duplicate messages

## 2.0.1

- Skip Sonnet 4.5 default model setting change for Bedrock and Vertex
- Various bug fixes and presentation improvements

## 2.0.0

- New native VS Code extension
- Fresh coat of paint throughout the whole app
- /rewind a conversation to undo code changes
- /usage command to see plan limits
- Tab to toggle thinking (sticky across sessions)
- Ctrl-R to search history
- Unshipped claude config command
- Hooks: Reduced PostToolUse 'tool_use' ids were found without 'tool_result' blocks errors
- SDK: The Claude Code SDK is now the Claude Agent SDK
- Add subagents dynamically with `--agents` flag

## 1.0.126

- Enable /context command for Bedrock and Vertex
- Add mTLS support for HTTP-based OpenTelemetry exporters

## 1.0.124

- Set `CLAUDE_BASH_NO_LOGIN` environment variable to 1 or true to to skip login shell for BashTool
- Fix Bedrock and Vertex environment variables evaluating all strings as truthy
- No longer inform Claude of the list of allowed tools when permission is denied
- Fixed security vulnerability in Bash tool permission checks
- Improved VSCode extension performance for large files

## 1.0.123

- Bash permission rules now support output redirections when matching (e.g., `Bash(python:*)` matches `python script.py > output.txt`)
- Fixed thinking mode triggering on negation phrases like "don't think"
- Fixed rendering performance degradation during token streaming
- Added SlashCommand tool, which enables Claude to invoke your slash commands. https://code.claude.com/docs/en/slash-commands#SlashCommand-tool
- Enhanced BashTool environment snapshot logging
- Fixed a bug where resuming a conversation in headless mode would sometimes enable thinking unnecessarily
- Migrated --debug logging to a file, to enable easy tailing & filtering

## 1.0.120

- Fix input lag during typing, especially noticeable with large prompts
- Improved VSCode extension command registry and sessions dialog user experience
- Enhanced sessions dialog responsiveness and visual feedback
- Fixed IDE compatibility issue by removing worktree support check
- Fixed security vulnerability where Bash tool permission checks could be bypassed using prefix matching

## 1.0.119

- Fix Windows issue where process visually freezes on entering interactive mode
- Support dynamic headers for MCP servers via headersHelper configuration
- Fix thinking mode not working in headless sessions
- Fix slash commands now properly update allowed tools instead of replacing them

## 1.0.117

- Add Ctrl-R history search to recall previous commands like bash/zsh
- Fix input lag while typing, especially on Windows
- Add sed command to auto-allowed commands in acceptEdits mode
- Fix Windows PATH comparison to be case-insensitive for drive letters
- Add permissions management hint to /add-dir output

## 1.0.115

- Improve thinking mode display with enhanced visual effects
- Type /t to temporarily disable thinking mode in your prompt
- Improve path validation for glob and grep tools
- Show condensed output for post-tool hooks to reduce visual clutter
- Fix visual feedback when loading state completes
- Improve UI consistency for permission request dialogs

## 1.0.113

- Deprecated piped input in interactive mode
- Move Ctrl+R keybinding for toggling transcript to Ctrl+O

## 1.0.112

- Transcript mode (Ctrl+R): Added the model used to generate each assistant message
- Addressed issue where some Claude Max users were incorrectly recognized as Claude Pro users
- Hooks: Added systemMessage support for SessionEnd hooks
- Added `spinnerTipsEnabled` setting to disable spinner tips
- IDE: Various improvements and bug fixes

## 1.0.111

- /model now validates provided model names
- Fixed Bash tool crashes caused by malformed shell syntax parsing

## 1.0.110

- /terminal-setup command now supports WezTerm
- MCP: OAuth tokens now proactively refresh before expiration
- Fixed reliability issues with background Bash processes

## 1.0.109

- SDK: Added partial message streaming support via `--include-partial-messages` CLI flag

## 1.0.106

- Windows: Fixed path permission matching to consistently use POSIX format (e.g., `Read(//c/Users/...)`)

## 1.0.97

- Settings: /doctor now validates permission rule syntax and suggests corrections

## 1.0.94

- Vertex: add support for global endpoints for supported models
- /memory command now allows direct editing of all imported memory files
- SDK: Add custom tools as callbacks
- Added /todos command to list current todo items

## 1.0.93

- Windows: Add alt + v shortcut for pasting images from clipboard
- Support NO_PROXY environment variable to bypass proxy for specified hostnames and IPs

## 1.0.90

- Settings file changes take effect immediately - no restart required

## 1.0.88

- Fixed issue causing "OAuth authentication is currently not supported"
- Status line input now includes `exceeds_200k_tokens`
- Fixed incorrect usage tracking in /cost.
- Introduced `ANTHROPIC_DEFAULT_SONNET_MODEL` and `ANTHROPIC_DEFAULT_OPUS_MODEL` for controlling model aliases opusplan, opus, and sonnet.
- Bedrock: Updated default Sonnet model to Sonnet 4

## 1.0.86

- Added /context to help users self-serve debug context issues
- SDK: Added UUID support for all SDK messages
- SDK: Added `--replay-user-messages` to replay user messages back to stdout

## 1.0.85

- Status line input now includes session cost info
- Hooks: Introduced SessionEnd hook

## 1.0.84

- Fix tool_use/tool_result id mismatch error when network is unstable
- Fix Claude sometimes ignoring real-time steering when wrapping up a task
- @-mention: Add ~/.claude/\* files to suggestions for easier agent, output style, and slash command editing
- Use built-in ripgrep by default; to opt out of this behavior, set USE_BUILTIN_RIPGREP=0

## 1.0.83

- @-mention: Support files with spaces in path
- New shimmering spinner

## 1.0.82

- SDK: Add request cancellation support
- SDK: New additionalDirectories option to search custom paths, improved slash command processing
- Settings: Validation prevents invalid fields in .claude/settings.json files
- MCP: Improve tool name consistency
- Bash: Fix crash when Claude tries to automatically read large files

## 1.0.81

- Released output styles, including new built-in educational output styles "Explanatory" and "Learning". Docs: https://code.claude.com/docs/en/output-styles
- Agents: Fix custom agent loading when agent files are unparsable

## 1.0.80

- UI improvements: Fix text contrast for custom subagent colors and spinner rendering issues

## 1.0.77

- Bash tool: Fix heredoc and multiline string escaping, improve stderr redirection handling
- SDK: Add session support and permission denial tracking
- Fix token limit errors in conversation summarization
- Opus Plan Mode: New setting in `/model` to run Opus only in plan mode, Sonnet otherwise

## 1.0.73

- MCP: Support multiple config files with `--mcp-config file1.json file2.json`
- MCP: Press Esc to cancel OAuth authentication flows
- Bash: Improved command validation and reduced false security warnings
- UI: Enhanced spinner animations and status line visual hierarchy
- Linux: Added support for Alpine and musl-based distributions (requires separate ripgrep installation)

## 1.0.72

- Ask permissions: have Claude Code always ask for confirmation to use specific tools with /permissions

## 1.0.71

- Background commands: (Ctrl-b) to run any Bash command in the background so Claude can keep working (great for dev servers, tailing logs, etc.)
- Customizable status line: add your terminal prompt to Claude Code with /statusline

## 1.0.70

- Performance: Optimized message rendering for better performance with large contexts
- Windows: Fixed native file search, ripgrep, and subagent functionality
- Added support for @-mentions in slash command arguments

## 1.0.69

- Upgraded Opus to version 4.1

## 1.0.68

- Fix incorrect model names being used for certain commands like `/pr-comments`
- Windows: improve permissions checks for allow / deny tools and project trust. This may create a new project entry in `.claude.json` - manually merge the history field if desired.
- Windows: improve sub-process spawning to eliminate "No such file or directory" when running commands like pnpm
- Enhanced /doctor command with CLAUDE.md and MCP tool context for self-serve debugging
- SDK: Added canUseTool callback support for tool confirmation
- Added `disableAllHooks` setting
- Improved file suggestions performance in large repos

## 1.0.65

- IDE: Fixed connection stability issues and error handling for diagnostics
- Windows: Fixed shell environment setup for users without .bashrc files

## 1.0.64

- Agents: Added model customization support - you can now specify which model an agent should use
- Agents: Fixed unintended access to the recursive agent tool
- Hooks: Added systemMessage field to hook JSON output for displaying warnings and context
- SDK: Fixed user input tracking across multi-turn conversations
- Added hidden files to file search and @-mention suggestions

## 1.0.63

- Windows: Fixed file search, @agent mentions, and custom slash commands functionality

## 1.0.62

- Added @-mention support with typeahead for custom agents. @<your-custom-agent> to invoke it
- Hooks: Added SessionStart hook for new session initialization
- /add-dir command now supports typeahead for directory paths
- Improved network connectivity check reliability

## 1.0.61

- Transcript mode (Ctrl+R): Changed Esc to exit transcript mode rather than interrupt
- Settings: Added `--settings` flag to load settings from a JSON file
- Settings: Fixed resolution of settings files paths that are symlinks
- OTEL: Fixed reporting of wrong organization after authentication changes
- Slash commands: Fixed permissions checking for allowed-tools with Bash
- IDE: Added support for pasting images in VSCode MacOS using ⌘+V
- IDE: Added `CLAUDE_CODE_AUTO_CONNECT_IDE=false` for disabling IDE auto-connection
- Added `CLAUDE_CODE_SHELL_PREFIX` for wrapping Claude and user-provided shell commands run by Claude Code

## 1.0.60

- You can now create custom subagents for specialized tasks! Run /agents to get started

## 1.0.59

- SDK: Added tool confirmation support with canUseTool callback
- SDK: Allow specifying env for spawned process
- Hooks: Exposed PermissionDecision to hooks (including "ask")
- Hooks: UserPromptSubmit now supports additionalContext in advanced JSON output
- Fixed issue where some Max users that specified Opus would still see fallback to Sonnet

## 1.0.58

- Added support for reading PDFs
- MCP: Improved server health status display in 'claude mcp list'
- Hooks: Added CLAUDE_PROJECT_DIR env var for hook commands

## 1.0.57

- Added support for specifying a model in slash commands
- Improved permission messages to help Claude understand allowed tools
- Fix: Remove trailing newlines from bash output in terminal wrapping

## 1.0.56

- Windows: Enabled shift+tab for mode switching on versions of Node.js that support terminal VT mode
- Fixes for WSL IDE detection
- Fix an issue causing awsRefreshHelper changes to .aws directory not to be picked up

## 1.0.55

- Clarified knowledge cutoff for Opus 4 and Sonnet 4 models
- Windows: fixed Ctrl+Z crash
- SDK: Added ability to capture error logging
- Add --system-prompt-file option to override system prompt in print mode

## 1.0.54

- Hooks: Added UserPromptSubmit hook and the current working directory to hook inputs
- Custom slash commands: Added argument-hint to frontmatter
- Windows: OAuth uses port 45454 and properly constructs browser URL
- Windows: mode switching now uses alt + m, and plan mode renders properly
- Shell: Switch to in-memory shell snapshot to fix file-related errors

## 1.0.53

- Updated @-mention file truncation from 100 lines to 2000 lines
- Add helper script settings for AWS token refresh: awsAuthRefresh (for foreground operations like aws sso login) and awsCredentialExport (for background operation with STS-like response).

## 1.0.52

- Added support for MCP server instructions

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

- Released hooks. Special thanks to community input in https://github.com/anthropics/claude-code/issues/712. Docs: https://code.claude.com/docs/en/hooks

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
