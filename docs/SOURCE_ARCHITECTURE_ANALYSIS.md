# Claude Code — Source Code Documentation & Analysis

> **Claude Code** is Anthropic's official CLI for Claude. This document provides a comprehensive reverse-engineering analysis of its source code architecture, modules, and internal design patterns.

---

## How to Read This Document

This document is the result of a deep-dive analysis into the Claude Code source tree. It is intended for **developers and engineers** who want to understand how Claude Code works under the hood — its architecture, module boundaries, data flow, and design decisions.

**Structure:** The document is organized top-down, starting with the project overview and technology stack, then drilling into each major subsystem (tools, commands, state, services, UI). Each section is self-contained; you can jump to any section via the Table of Contents.

**Audience:** Intermediate-to-advanced developers familiar with TypeScript, React, and CLI tooling. Prior experience with AI/LLM tooling is helpful but not required.

**Scope:** This covers the source tree structure, module inventory, and architectural patterns. It does not cover runtime behavior in depth, nor does it include performance benchmarks or security audits.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [Entry Points](#4-entry-points)
5. [Core Architecture](#5-core-architecture)
6. [Tool System](#6-tool-system)
7. [Command System](#7-command-system)
8. [State Management](#8-state-management)
9. [Task System](#9-task-system)
10. [Services & Integrations](#10-services--integrations)
11. [UI Layer](#11-ui-layer)
12. [Utilities](#12-utilities)
13. [Special Modes](#13-special-modes)
14. [Plugins & Skills](#14-plugins--skills)
15. [Hooks & Extensibility](#15-hooks--extensibility)
16. [File Statistics](#16-file-statistics)
17. [Architectural Patterns](#17-architectural-patterns)

---

## 1. Project Overview

Claude Code is a feature-rich, interactive terminal application that enables AI-assisted software engineering directly from the command line. It provides:

- **Interactive REPL** for conversing with Claude about code
- **40+ tools** for file operations, shell execution, web search, and more
- **100+ slash commands** for workflows like committing, reviewing, debugging
- **Agent/task system** for parallelizing complex work across sub-agents
- **Plan mode** for designing implementation strategies before coding
- **MCP (Model Context Protocol)** integration for extensible server-side tools
- **Plugin & skill system** for user-defined extensions
- **Voice mode**, **desktop/mobile bridges**, and **remote sessions**

---

## 2. Technology Stack

| Layer          | Technology                                                   |
|----------------|--------------------------------------------------------------|
| Language       | TypeScript (`.ts` / `.tsx`)                                  |
| Runtime        | Bun (bundler, feature flags via `bun:bundle`)                |
| UI Framework   | React + [Ink](https://github.com/vadimdemedes/ink) (terminal React renderer) |
| API Client     | `@anthropic-ai/sdk` (Anthropic SDK)                          |
| MCP            | `@modelcontextprotocol/sdk`                                  |
| CLI Framework  | `@commander-js/extra-typings`                                |
| Validation     | Zod v4                                                       |
| Styling        | Chalk (terminal colors)                                      |
| State          | Zustand-style store + React Context                          |

---

## 3. Directory Structure

```text
claude-code-analysis/
└── src/                          # All source code (single top-level directory)
    ├── main.tsx                  # Primary bootstrap & initialization
    ├── QueryEngine.ts            # Conversation loop orchestrator
    ├── Tool.ts                   # Tool type definitions & interfaces
    ├── Task.ts                   # Task type definitions & lifecycle
    ├── commands.ts               # Command registry
    ├── tools.ts                  # Tool registry & factory
    ├── context.ts                # System/user context builder
    ├── query.ts                  # Query context preparation
    ├── setup.ts                  # Setup phase orchestration
    ├── history.ts                # Chat session history
    ├── cost-tracker.ts           # Token usage & pricing
    ├── ink.ts                    # Ink rendering wrapper
    ├── replLauncher.tsx          # REPL React component launcher
    ├── tasks.ts                  # Task execution manager
    │
    ├── commands/                 # 101 command modules (slash commands)
    ├── tools/                    # 41 tool implementations
    ├── services/                 # Core services (API, MCP, analytics, etc.)
    ├── components/               # React/Ink UI components (130+ files)
    ├── utils/                    # Utility functions (300+ files)
    ├── state/                    # Application state management
    ├── types/                    # TypeScript type definitions
    ├── hooks/                    # React hooks
    ├── schemas/                  # Zod validation schemas
    ├── tasks/                    # Task type implementations
    ├── entrypoints/              # Entry point definitions (CLI, SDK, MCP)
    ├── bootstrap/                # Application startup & global state
    ├── screens/                  # Full-screen UI layouts
    ├── plugins/                  # Plugin system (bundled plugins)
    ├── skills/                   # Custom skill system (bundled skills)
    ├── memdir/                   # Memory directory auto-discovery
    ├── constants/                # Application constants
    ├── migrations/               # Data/schema migrations
    ├── ink/                      # Ink terminal customizations
    ├── keybindings/              # Keyboard binding system
    ├── context/                  # React contexts (mailbox, notifications)
    ├── query/                    # Query processing modules
    ├── outputStyles/             # Output formatting styles
    ├── vim/                      # Vim mode integration
    ├── voice/                    # Voice input/output
    ├── native-ts/                # Native TypeScript bindings
    ├── assistant/                # Kairos (assistant) mode
    ├── bridge/                   # Bridge mode (always-on remote)
    ├── buddy/                    # Buddy/teammate system
    ├── coordinator/              # Multi-agent coordination
    ├── remote/                   # Remote session handling
    ├── server/                   # Server implementation
    ├── cli/                      # CLI argument parsing
    └── upstreamproxy/            # Upstream proxy setup
```

---

## 4. Entry Points

### Primary Entry: `src/main.tsx`

The main bootstrap file (~1,400 lines). Performs:

1. **Startup profiling** via `startupProfiler.ts`
2. **MDM (Mobile Device Management)** raw read prefetch
3. **Keychain prefetch** (macOS OAuth + API key reads in parallel)
4. **Feature flag initialization** via Bun's `feature()` for dead code elimination
5. **CLI argument parsing** via Commander.js
6. **Authentication** (API key, OAuth, AWS Bedrock, GCP Vertex, Azure)
7. **GrowthBook** initialization (A/B testing & feature flags)
8. **Policy limits** and **remote managed settings** loading
9. **Tool, command, skill, and MCP server** registration
10. **REPL launch** via `replLauncher.tsx`

### Other Entry Points (`src/entrypoints/`)

| File                | Purpose                                      |
|---------------------|----------------------------------------------|
| `cli.tsx`           | CLI entry point with React/Ink UI rendering  |
| `init.ts`           | Bootstrap initialization, version checks     |
| `mcp.ts`            | Model Context Protocol integration           |
| `agentSdkTypes.ts`  | Type definitions for the Agent SDK           |
| `sandboxTypes.ts`   | Sandbox execution environment types          |
| `sdk/`              | SDK-related implementations                  |

### Setup Phase: `src/setup.ts`

Orchestrates:
- Node.js version validation
- Worktree initialization
- Session & permission mode setup
- Git root detection
- UDS messaging server startup

---

## 5. Core Architecture

### 5.1 Query Engine (`src/QueryEngine.ts`)

The heart of the application (~46KB). Manages the conversation loop between user and Claude:

- **Message management** — maintains conversation history with user, assistant, system, and tool messages
- **Streaming** — real-time token streaming with tool use execution
- **Auto-compaction** — automatically compresses context when approaching window limits
- **Prompt caching** — optimizes repeated context through cache-aware strategies
- **Retry logic** — handles API errors, rate limits, and overload with backoff
- **Usage tracking** — counts tokens (input/output/cache read/write) and costs
- **Tool orchestration** — dispatches tool calls, collects results, manages permissions

### 5.2 Context Builder (`src/context.ts`, `src/query.ts`)

Prepares the system prompt and user context:

- Discovers and merges `CLAUDE.md` files (project, user, global)
- Builds system context (OS, shell, platform, git status)
- Integrates user context (permissions, working directories)
- Caches context for performance across queries

### 5.3 Cost Tracking (`src/cost-tracker.ts`)

Tracks per-session costs:
- Token counting by model (input, output, cache read/write)
- USD cost calculation via pricing tables
- Session duration tracking
- Web search request counting
- File change metrics

---

## 6. Tool System

### Architecture (`src/Tool.ts`, `src/tools.ts`)

Each tool is a self-contained module with:
- **JSON Schema** input validation
- **Permission model** (ask/allow/deny modes)
- **Progress tracking** types
- **Error handling** and user prompting

### Complete Tool Inventory (41 tools)

#### File Operations
| Tool              | Purpose                                    |
|-------------------|--------------------------------------------|
| `FileReadTool`    | Read file contents with line ranges        |
| `FileWriteTool`   | Create or overwrite files                  |
| `FileEditTool`    | Exact string replacement edits             |
| `GlobTool`        | Pattern-based file matching                |
| `GrepTool`        | Content search with regex (ripgrep-based)  |

#### Code Execution
| Tool              | Purpose                                    |
|-------------------|--------------------------------------------|
| `BashTool`        | Execute shell commands with timeout        |
| `PowerShellTool`  | Execute PowerShell commands (Windows)      |
| `REPLTool`        | Execute Python code (internal only)        |
| `NotebookEditTool`| Jupyter notebook cell operations           |

#### Web & Search
| Tool              | Purpose                                    |
|-------------------|--------------------------------------------|
| `WebFetchTool`    | Fetch and parse web content                |
| `WebSearchTool`   | Search the internet                        |
| `ToolSearchTool`  | Search available deferred tools            |

#### Agent & Task Management
| Tool              | Purpose                                    |
|-------------------|--------------------------------------------|
| `AgentTool`       | Spawn sub-agents for parallel work         |
| `TaskCreateTool`  | Create new background tasks                |
| `TaskGetTool`     | Retrieve task status and results           |
| `TaskUpdateTool`  | Update task status or description          |
| `TaskListTool`    | List all tasks and their states            |
| `TaskStopTool`    | Kill a running task                        |
| `TaskOutputTool`  | Stream/read task output                    |
| `SendMessageTool` | Send messages to running agents            |

#### Planning & Workflow
| Tool              | Purpose                                    |
|-------------------|--------------------------------------------|
| `EnterPlanModeTool` | Enter read-only planning mode            |
| `ExitPlanModeTool`  | Exit planning mode with approval         |
| `EnterWorktreeTool` | Create isolated git worktree             |
| `ExitWorktreeTool`  | Return from worktree with changes        |

#### MCP (Model Context Protocol)
| Tool              | Purpose                                    |
|-------------------|--------------------------------------------|
| `MCPTool`         | Call tools on MCP servers                  |
| `McpAuthTool`     | Authenticate with MCP servers              |
| `ListMcpResourcesTool` | List MCP server resources             |
| `ReadMcpResourceTool`  | Read specific MCP resources            |

#### Configuration & System
| Tool              | Purpose                                    |
|-------------------|--------------------------------------------|
| `ConfigTool`      | Read/modify settings                       |
| `SkillTool`       | Execute user-defined skills                |
| `AskUserQuestionTool` | Prompt user for input/clarification    |
| `BriefTool`       | Generate session briefs                    |
| `TodoWriteTool`   | Manage todo lists                          |
| `SleepTool`       | Pause execution for a duration             |

#### Team & Remote
| Tool              | Purpose                                    |
|-------------------|--------------------------------------------|
| `TeamCreateTool`  | Create agent teams                         |
| `TeamDeleteTool`  | Delete agent teams                         |
| `RemoteTriggerTool` | Trigger remote task execution            |
| `ScheduleCronTool`  | Schedule recurring tasks                 |
| `LSPTool`         | Language Server Protocol integration       |

#### Internal
| Tool              | Purpose                                    |
|-------------------|--------------------------------------------|
| `SyntheticOutputTool` | Synthetic output for structured responses |

---

## 7. Command System

### Registry (`src/commands.ts`)

Commands are modular directories under `src/commands/`, each containing an `index.ts` (or similar) that exports a `Command` definition with name, description, handler, and optional aliases.

### Complete Command Inventory (101 modules)

#### Git & Version Control
`commit`, `commit-push-pr`, `diff`, `branch`, `review`, `autofix-pr`, `pr_comments`, `teleport`, `rewind`, `tag`

#### Session & History
`session`, `resume`, `clear`, `compact`, `export`, `share`, `summary`, `context`

#### Configuration & Settings
`config`, `permissions`, `privacy-settings`, `theme`, `color`, `keybindings`, `vim`, `output-style`, `statusline`, `env`

#### Agent & Task Management
`agents`, `tasks`, `brief`

#### File & Code Operations
`files`, `add-dir`, `diff`, `debug-tool-call`, `copy`

#### Development & Debugging
`doctor`, `heapdump`, `perf-issue`, `stats`, `bughunter`, `ctx_viz`, `ant-trace`

#### Authentication
`login`, `logout`, `oauth-refresh`

#### Extensions & Plugins
`mcp`, `plugin`, `reload-plugins`, `skills`

#### Workspace
`plan`, `sandbox-toggle`, `init`

#### Information & Help
`help`, `version`, `cost`, `usage`, `extra-usage`, `release-notes`, `status`, `insights`

#### Platform Integration
`desktop`, `mobile`, `chrome`, `ide`, `install`, `install-github-app`, `install-slack-app`

#### Memory & Knowledge
`memory`, `good-claude`

#### Model & Performance
`model`, `effort`, `fast`, `thinkback`, `thinkback-play`, `advisor`

#### Special Operations
`bridge`, `voice`, `remote-setup`, `remote-env`, `stickers`, `feedback`, `onboarding`, `passes`, `ultraplan`, `rename`, `exit`

---

## 8. State Management

### Store Architecture (`src/state/`)

| File              | Purpose                                        |
|-------------------|------------------------------------------------|
| `AppState.tsx`    | React Context provider with `useAppState(selector)` hook |
| `AppStateStore.ts`| Central state shape definition                 |
| `store.ts`        | Zustand-style store implementation             |

### Key State Fields

```typescript
{
  settings: UserSettings           // User configuration from settings.json
  mainLoopModel: string            // Active Claude model
  messages: Message[]              // Conversation history
  tasks: TaskState[]               // Running/completed tasks
  toolPermissionContext: {         // Permission rules per tool
    rules: PermissionRule[]
    bypassMode: 'auto' | 'block' | 'ask'
    denialTracking: DenialTrackingState
  }
  kairosEnabled: boolean           // Assistant mode flag
  remoteConnectionStatus: Status   // Remote session connectivity
  replBridgeEnabled: boolean       // Always-on bridge (CCR) state
  speculationState: Cache          // Inline speculation cache/preview
}
```

---

## 9. Task System

### Task Types (`src/Task.ts`)

| Type                  | Description                                     |
|-----------------------|-------------------------------------------------|
| `local_bash`          | Local shell command execution                    |
| `local_agent`         | Local sub-agent (spawned via AgentTool)           |
| `remote_agent`        | Remote agent execution                           |
| `in_process_teammate` | In-process teammate (shared memory space)        |
| `local_workflow`      | Local multi-step workflow                        |
| `monitor_mcp`         | MCP server monitoring task                       |
| `dream`               | Auto-dream background task                       |

### Task Lifecycle

```text
pending -> running -> completed
                   -> failed
                   -> killed
```

### Task State Shape

```typescript
{
  id: string           // Unique ID with type prefix (e.g., "b-xxx" for bash)
  type: TaskType
  status: TaskStatus
  description: string
  startTime: number
  endTime?: number
  outputFile: string   // Disk-persisted output
  outputOffset: number // Current read position
  notified: boolean    // Whether completion was reported
}
```

---

## 10. Services & Integrations

### 10.1 API Client (`src/services/api/`)

| File                        | Purpose                                      |
|-----------------------------|----------------------------------------------|
| `client.ts`                 | Anthropic SDK client with multi-provider support |
| `claude.ts`                 | Message streaming & tool use handling        |
| `bootstrap.ts`              | Bootstrap data fetching on startup           |
| `usage.ts`                  | Token usage recording                        |
| `errors.ts` / `errorUtils.ts` | Error classification and handling         |
| `logging.ts`                | API request/response logging                 |
| `withRetry.ts`              | Exponential backoff retry logic              |
| `filesApi.ts`               | File upload/download                         |
| `sessionIngress.ts`         | Remote session bridging                      |
| `grove.ts`                  | Grove integration                            |
| `referral.ts`               | Referral/passes system                       |

**Supported Providers:**
- Anthropic Direct API
- AWS Bedrock
- Google Cloud Vertex AI
- Azure Foundry

### 10.2 MCP Integration (`src/services/mcp/`)

| File                    | Purpose                                        |
|-------------------------|------------------------------------------------|
| `client.ts`             | MCP client implementation                      |
| `types.ts`              | Server definitions & connection types          |
| `config.ts`             | Configuration loading & validation             |
| `auth.ts`               | OAuth/authentication for MCP servers           |
| `officialRegistry.ts`   | Official MCP server registry                   |
| `InProcessTransport.ts` | In-process MCP transport                       |
| `normalization.ts`      | URL/config normalization                       |
| `elicitationHandler.ts` | User prompting via MCP                         |

### 10.3 Analytics & Telemetry (`src/services/analytics/`)

| File                        | Purpose                                    |
|-----------------------------|--------------------------------------------|
| `index.ts`                  | Event logging API                          |
| `growthbook.ts`             | Feature flagging & A/B testing             |
| `sink.ts`                   | Analytics sink configuration               |
| `datadog.ts`                | Datadog integration                        |
| `firstPartyEventLogger.ts`  | First-party analytics                      |
| `metadata.ts`               | Event metadata enrichment                  |

### 10.4 Context Compaction (`src/services/compact/`)

| File                       | Purpose                                     |
|----------------------------|---------------------------------------------|
| `compact.ts`               | Full context window compaction              |
| `autoCompact.ts`           | Automatic compaction triggers               |
| `microCompact.ts`          | Selective message pruning                   |
| `compactWarning.ts`        | User warnings about compaction              |
| `sessionMemoryCompact.ts`  | Memory persistence across compaction        |

### 10.5 Other Services

| Directory/File                | Purpose                                   |
|-------------------------------|-------------------------------------------|
| `SessionMemory/`              | Session memory persistence & transcripts  |
| `MagicDocs/`                  | Intelligent documentation generation      |
| `AgentSummary/`               | Agent execution summaries                 |
| `PromptSuggestion/`           | Suggested follow-up prompts               |
| `extractMemories/`            | Learning extraction from conversations    |
| `plugins/`                    | Plugin lifecycle management               |
| `oauth/`                      | OAuth client flows                        |
| `lsp/`                        | Language Server Protocol client            |
| `remoteManagedSettings/`      | Remote configuration sync                 |
| `settingsSync/`               | Settings synchronization                  |
| `teamMemorySync/`             | Team memory synchronization               |
| `policyLimits/`               | Rate limiting & quotas                    |
| `autoDream/`                  | Auto-dream background features            |
| `tips/`                       | Contextual tips system                    |
| `toolUseSummary/`             | Tool usage analytics                      |
| `voice.ts` / `voiceStreamSTT.ts` | Voice input handling                  |

---

## 11. UI Layer

### Framework

The UI is built with **React** rendered to the terminal via **Ink**. Components use standard React patterns (hooks, context, props) but render to terminal ANSI output instead of DOM.

### Core Application Components

| Component          | File                          | Purpose                       |
|--------------------|-------------------------------|-------------------------------|
| `App`              | `components/App.tsx`          | Root application component    |
| `REPL`             | `screens/REPL.tsx`            | Main REPL screen              |
| `Messages`         | `components/Messages.tsx`     | Conversation message list     |
| `PromptInput`      | `components/PromptInput/`     | User input with autocomplete  |
| `StatusLine`       | `components/StatusLine.tsx`   | Bottom status bar             |

### Component Categories

#### Message Display
`Message.tsx`, `MessageRow.tsx`, `MessageResponse.tsx`, `MessageModel.tsx`, `MessageTimestamp.tsx`, `MessageSelector.tsx`, `messages/` (subdirectory for specialized message types)

#### Dialog & Modal Components
`TrustDialog/`, `AutoModeOptInDialog.tsx`, `BypassPermissionsModeDialog.tsx`, `CostThresholdDialog.tsx`, `BridgeDialog.tsx`, `ExportDialog.tsx`, `InvalidConfigDialog.tsx`, `InvalidSettingsDialog.tsx`, `ManagedSettingsSecurityDialog/`, `IdeAutoConnectDialog.tsx`, `IdleReturnDialog.tsx`, `WorktreeExitDialog.tsx`, `RemoteEnvironmentDialog.tsx`

#### Code Display
`HighlightedCode/`, `StructuredDiff/`, `FileEditToolDiff.tsx`

#### Settings & Configuration
`Settings/`, `ThemePicker.tsx`, `OutputStylePicker.tsx`, `ModelPicker.tsx`, `LanguagePicker.tsx`

#### Task & Agent UI
`tasks/`, `teams/`, `agents/`, `CoordinatorAgentStatus.tsx`, `TaskListV2.tsx`, `TeammateViewHeader.tsx`

#### Navigation & Search
`GlobalSearchDialog.tsx`, `HistorySearchDialog.tsx`, `QuickOpenDialog.tsx`, `SearchBox.tsx`

#### Design System
`design-system/`, `Spinner/`, `CustomSelect/`, `LogoV2/`, `HelpV2/`

#### Permissions
`permissions/` (role-based access dialogs and prompts)

---

## 12. Utilities

The `src/utils/` directory contains **300+ files** providing low-level functionality. Key categories:

### Git & Version Control
| File/Dir        | Purpose                                        |
|-----------------|------------------------------------------------|
| `git.ts`        | Git command wrappers                           |
| `git/`          | Extended git utilities                         |
| `gitDiff.ts`    | Diff generation and parsing                    |
| `gitSettings.ts`| Git instruction toggles                        |
| `github/`       | GitHub API helpers                             |
| `worktree.ts`   | Git worktree automation                        |

### Shell & Process
| File/Dir        | Purpose                                        |
|-----------------|------------------------------------------------|
| `Shell.ts`      | Shell execution wrapper                        |
| `shell/`        | Shell configuration and helpers                |
| `bash/`         | Bash-specific utilities                        |
| `powershell/`   | PowerShell utilities                           |
| `execFileNoThrow.ts` | Safe process spawning                     |
| `process.ts`    | Process management                             |

### Authentication & Security
| File/Dir        | Purpose                                        |
|-----------------|------------------------------------------------|
| `auth.ts`       | API key, OAuth, AWS/GCP credential management  |
| `secureStorage/`| Keychain integration (macOS)                   |
| `permissions/`  | Permission rules, filesystem sandboxing        |
| `crypto.ts`     | Cryptographic utilities                        |
| `sandbox/`      | Sandbox environment                            |

### Configuration
| File/Dir        | Purpose                                        |
|-----------------|------------------------------------------------|
| `config.ts`     | `.claude/config.json` management               |
| `settings/`     | `settings.json` validation & application       |
| `env.ts`        | Static environment variables                   |
| `envDynamic.ts` | Dynamic environment detection                  |
| `envUtils.ts`   | Environment variable parsing                   |
| `managedEnv.ts` | Managed environment configuration              |

### File System
| File/Dir        | Purpose                                        |
|-----------------|------------------------------------------------|
| `claudemd.ts`   | CLAUDE.md auto-discovery and parsing           |
| `fileStateCache.ts` | File change tracking                       |
| `fileHistory.ts`| File snapshots for undo                        |
| `filePersistence/` | Persistent file storage                     |
| `glob.ts`       | Glob pattern matching                          |
| `ripgrep.ts`    | Ripgrep integration                            |

### AI & Model
| File/Dir        | Purpose                                        |
|-----------------|------------------------------------------------|
| `model/`        | Model selection & context window management    |
| `modelCost.ts`  | Token pricing tables                           |
| `thinking.ts`   | Extended thinking mode configuration           |
| `effort.ts`     | Task effort level management                   |
| `fastMode.ts`   | Speed optimization mode                        |
| `advisor.ts`    | AI advisor integration                         |
| `tokens.ts`     | Token counting and estimation                  |

### Agent & Swarm
| File/Dir        | Purpose                                        |
|-----------------|------------------------------------------------|
| `swarm/`        | Multi-agent swarm coordination                 |
| `teammate.ts`   | Teammate/agent mode utilities                  |
| `forkedAgent.ts`| Forked agent process management                |
| `agentContext.ts`| Agent execution context                       |

### Performance & Diagnostics
| File/Dir        | Purpose                                        |
|-----------------|------------------------------------------------|
| `startupProfiler.ts` | Startup performance monitoring            |
| `headlessProfiler.ts`| Runtime profiling                          |
| `fpsTracker.ts` | Frame rate metrics                             |
| `diagLogs.ts`   | Diagnostic logging (PII-free)                  |
| `debug.ts`      | Debug utilities                                |

### UI Helpers
| File/Dir        | Purpose                                        |
|-----------------|------------------------------------------------|
| `theme.ts`      | Theme management                               |
| `renderOptions.ts` | Ink rendering configuration                 |
| `format.ts`     | Number/duration formatting                     |
| `markdown.ts`   | Markdown processing                            |
| `cliHighlight.ts` | Syntax highlighting for CLI                  |

---

## 13. Special Modes

### 13.1 Bridge Mode (`src/bridge/`)
Always-on connection to Claude.ai via WebSocket-based session ingress. Enables persistent background sessions and remote access.

### 13.2 Kairos / Assistant Mode (`src/assistant/`)
Enterprise assistant features:
- Background task handling
- Push notifications
- GitHub webhook subscriptions
- Remote task monitoring
- Feature-gated via `KAIROS` flag

### 13.3 Coordinator Mode (`src/coordinator/`)
Multi-agent orchestration:
- Task panel management
- Agent interaction coordination
- Feature-gated via `COORDINATOR_MODE` flag

### 13.4 Voice Mode (`src/voice/`)
Voice input/output support:
- Speech-to-Text (STT) integration
- Text-to-speech
- Voice transcription
- Voice keyterms detection

### 13.5 Plan Mode
Read-only mode for designing implementation strategies:
- Creates plan files in `.claude/plans/`
- Restricts tools to read-only operations
- Requires explicit user approval before execution
- Managed by `EnterPlanModeTool` / `ExitPlanModeTool`

### 13.6 Worktree Mode
Git worktree isolation for safe experimentation:
- Creates temporary git worktrees
- Supports tmux session management
- Temporary branch creation
- Changes can be merged or discarded

### 13.7 Vim Mode (`src/vim/`)
Vim keybinding integration for the terminal input.

---

## 14. Plugins & Skills

### Plugin System (`src/plugins/`)

- **Bundled plugins** in `plugins/bundled/` (keyboard shortcuts, themes, etc.)
- Plugin lifecycle management via `PluginInstallationManager`
- CLI commands for plugin management
- Hot-reload support via `reload-plugins` command

### Skill System (`src/skills/`)

- **Bundled skills** in `skills/bundled/` (commit, review, simplify, etc.)
- Skills are named prompts that can be invoked via `/skill-name`
- Skill discovery and execution engine
- Change detection for live updates

---

## 15. Hooks & Extensibility

### Hook Schema (`src/schemas/hooks.ts`)

Defined via Zod validation:
- `HookEvent` — pre-/post-execution lifecycle hooks
- `PromptRequest` / `PromptResponse` — user prompting protocol
- Sync and async hook response schemas
- Permission decision hooks

### React Hooks (`src/hooks/`)

| Hook                | Purpose                                    |
|---------------------|--------------------------------------------|
| `useSettings`       | Settings change detection                  |
| `useTerminalSize`   | Terminal dimension tracking                |
| `useExitOnCtrlC`    | Signal handling                            |
| `useBlink`          | Cursor blinking animation                  |
| `useDoublePress`    | Double-keypress detection                  |
| `useCanUseTool`     | Tool permission validation                 |

### Utility Hooks (`src/utils/hooks/`)

Additional hooks for shell config, permission state, and tool behavior.

---

## 16. File Statistics

| Category                    | Count   |
|-----------------------------|---------|
| **Total TypeScript files**  | 1,884   |
| **Command modules**         | 101     |
| **Tool implementations**    | 41      |
| **UI components**           | 130+    |
| **Utility files**           | 300+    |
| **Service modules**         | 35+     |
| **Top-level source files**  | 18      |
| **Entry points**            | 6       |
| **Subdirectories in `src/`**| 37      |

---

## 17. Architectural Patterns

### Lazy Loading & Dead Code Elimination
Conditional imports via `require()` gated by Bun's `feature()` flags. This enables tree-shaking of entire subsystems (e.g., `KAIROS`, `COORDINATOR_MODE`) at bundle time.

```typescript
const assistantModule = feature('KAIROS')
  ? require('./assistant/index.js')
  : null;
```

### Tool-Based Execution Model
Every interaction with the external world goes through a registered `Tool`. Tools have:
- Declarative JSON Schema inputs
- Permission checks before execution
- Progress reporting during execution
- Structured result output

### Command Pattern
Slash commands are modular directories, each exporting a `Command` object. The registry in `commands.ts` aggregates them with optional feature-gate conditions.

### Message-Driven Architecture
The conversation is a sequence of typed messages (`UserMessage`, `AssistantMessage`, `SystemMessage`, `ProgressMessage`, etc.) managed by the `QueryEngine`. Tool results are injected as `ToolResultBlockParam` messages.

### Context Compaction
When conversation context approaches the model's window limit, the system automatically compacts older messages while preserving essential context. Multiple strategies are available: full compaction, micro-compaction (selective pruning), and session memory persistence.

### Permission-First Security
Every tool execution passes through a permission check. Modes include:
- **Ask** — prompt user for each action
- **Auto-allow** — allow with trust rules
- **Deny** — block specific operations
- **Filesystem sandboxing** — restrict file access to project directories

### React Terminal UI
The entire UI is a React component tree rendered via Ink. This enables:
- Declarative UI updates
- Component composition and reuse
- State-driven rendering
- Hooks for terminal-specific behaviors (cursor, resize, keyboard)

---

---

## Contributing

Contributions are welcome! If you've discovered additional architectural details, found inaccuracies, or want to expand coverage of a specific subsystem:

1. **Fork** this repository
2. **Create a branch** for your changes (`git checkout -b fix/tool-system-details`)
3. **Submit a pull request** with a clear description of what you added or corrected

Please keep contributions factual and technically precise. This is a reference document — speculation should be clearly marked as such.

---

> **Disclaimer:** This is an unofficial, independent analysis. Claude Code is a product of [Anthropic](https://www.anthropic.com/). All trademarks belong to their respective owners.

*Generated on 2025-03-31. Based on analysis of the Claude Code source tree.*
