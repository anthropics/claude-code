# Comprehensive Codebase Documentation

**Scope:** Full codebase analysis, architecture deep-dive, use cases, and MCP explanation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Technologies & Frameworks](#3-technologies--frameworks)
4. [Architecture Deep-Dive](#4-architecture-deep-dive)
   - 4.1 [CLI Core Pipeline](#41-cli-core-pipeline)
   - 4.2 [Query Engine](#42-query-engine-the-heart-of-the-system)
   - 4.3 [Tool System](#43-tool-system)
   - 4.4 [Command System](#44-command-system)
   - 4.5 [Service Layer](#45-service-layer)
   - 4.6 [State Management](#46-state-management)
   - 4.7 [Terminal UI (React + Ink)](#47-terminal-ui-react--ink)
   - 4.8 [Bridge (IDE Integration)](#48-bridge-ide-integration)
   - 4.9 [Permission System](#49-permission-system)
   - 4.10 [Memory System](#410-memory-system)
   - 4.11 [Session & Persistence](#411-session--persistence)
5. [Web Application](#5-web-application)
6. [MCP Server](#6-mcp-server)
7. [Data Models & Schemas](#7-data-models--schemas)
8. [Configuration Files](#8-configuration-files)
9. [Key Data Flows](#9-key-data-flows)
10. [What Are MCPs? (Model Context Protocol)](#10-what-are-mcps-model-context-protocol)
11. [Potential Use Cases & Applications](#11-potential-use-cases--applications)
12. [Notable Implementation Details](#12-notable-implementation-details)
13. [Local Setup Guide](#13-local-setup-guide)
14. [The /buddy Command — Companion System](#14-the-buddy-command--companion-system)
15. [Known Issues & Bug Fixes — Token Burn Optimizations](#15-known-issues--bug-fixes--token-burn-optimizations)
16. [Known Issues & Bug Fixes — General Bugs](#16-known-issues--bug-fixes--general-bugs)

---

## 1. Project Overview

**Claude Code** is Anthropic's official AI-powered developer assistant — a full-featured CLI tool, web interface, and extensible agent framework built around the Claude family of large language models.

At its core, it is an interactive terminal application that:

- Holds multi-turn conversations with Claude LLMs
- Executes "tools" on the user's behalf (read/write files, run shell commands, search the web, browse code, call external APIs)
- Maintains persistent memory across sessions
- Integrates with IDEs (VS Code, JetBrains) via a bridge layer
- Exposes its own capabilities as an MCP server for other AI agents to consume
- Provides a Next.js web frontend for browser-based interaction

The codebase is **512,000+ lines of TypeScript**, spread across **2,200+ files** in **372 directories** — a production-grade, enterprise-ready AI agent platform.

---

## 2. Repository Structure

```
claude-code/                         ← Repository root
│
├── src/                             ← CLI core (~512K lines TypeScript)
│   ├── entrypoints/                 ← Application entry points
│   │   ├── cli.tsx                  ← Main CLI entry (session orchestration)
│   │   ├── init.ts                  ← Config, OAuth, telemetry init
│   │   ├── mcp.ts                   ← MCP server mode entry
│   │   └── sdk/                     ← Agent SDK (programmatic embedding)
│   │
│   ├── commands/                    ← ~100 slash commands (/commit, /review, etc.)
│   ├── tools/                       ← ~40 agent tools (Bash, FileEdit, Grep, etc.)
│   ├── services/                    ← Service layer (MCP, OAuth, LSP, Memory, etc.)
│   ├── components/                  ← React/Ink terminal UI components (~140)
│   ├── screens/                     ← Full-screen UI modes
│   │   ├── REPL.tsx                 ← Main interactive REPL screen
│   │   ├── Doctor.tsx               ← Environment diagnostics (/doctor)
│   │   └── ResumeConversation.tsx   ← Session restore (/resume)
│   ├── hooks/                       ← React hooks (~80 hooks)
│   ├── types/                       ← TypeScript type definitions
│   ├── state/                       ← Global AppState + change observers
│   ├── constants/                   ← Prompts, XML tags, query sources
│   ├── utils/                       ← Config, theme, permissions utilities
│   ├── context/                     ← React context providers
│   ├── coordinator/                 ← Multi-agent coordination
│   ├── bridge/                      ← IDE integration layer
│   ├── async/                       ← Async utility primitives
│   ├── schemas/                     ← Zod validation schemas
│   └── migrations/                  ← Config format migration handlers
│
├── web/                             ← Next.js web application
│   ├── app/                         ← App router (pages + API routes)
│   │   ├── page.tsx                 ← Main chat page
│   │   ├── share/[shareId]/         ← Shared conversation view
│   │   └── api/                     ← API routes (chat, files, export, share)
│   ├── components/                  ← React web UI components
│   │   └── ui/                      ← UI primitives (Button, Input, etc.)
│   ├── lib/                         ← Web utilities
│   │   ├── store.ts                 ← Zustand state store
│   │   ├── types.ts                 ← Web-specific type definitions
│   │   ├── api/client.ts            ← API client with retry/abort
│   │   └── collaboration/           ← Real-time multi-user features
│   └── public/                      ← Static assets
│
├── mcp-server/                      ← Standalone MCP server
│   └── src/
│       ├── index.ts                 ← STDIO transport entry
│       ├── http.ts                  ← HTTP/SSE transport (Express)
│       └── server.ts                ← Shared server definition
│
├── docs/                            ← Architecture documentation
│   ├── architecture.md              ← Deep dive into system design
│   ├── tools.md                     ← Full tool catalog
│   ├── commands.md                  ← Full command catalog
│   ├── subsystems.md                ← Subsystem guide
│   ├── bridge.md                    ← IDE bridge documentation
│   └── exploration-guide.md        ← How to explore the repo
│
├── docker/                          ← Docker configuration
│   └── docker-compose.yml           ← Services definition
├── Dockerfile                       ← Container image for web + CLI
├── mcp-server/Dockerfile            ← Container for MCP server
├── scripts/                         ← Build and utility scripts
├── prompts/                         ← Prompt templates
├── server.json                      ← MCP server manifest
├── vercel.json                      ← Vercel deployment config
├── package.json                     ← Root package (Bun workspace)
├── tsconfig.json                    ← TypeScript config
├── biome.json                       ← Linter/formatter config
└── agent.md                         ← Agent operating guide
```

---

## 3. Technologies & Frameworks

### Runtime & Language

| Technology     | Version | Role                                                            |
| -------------- | ------- | --------------------------------------------------------------- |
| **Bun**        | 1.1.0+  | JavaScript runtime AND package manager (replaces Node.js + npm) |
| **TypeScript** | 5.7     | Primary language — strict types throughout                      |
| **React**      | 19      | UI library (used both for terminal via Ink AND web frontend)    |
| **Ink**        | —       | React renderer targeting the terminal instead of DOM            |

### AI & LLM Integration

| Technology                    | Version | Role                                                          |
| ----------------------------- | ------- | ------------------------------------------------------------- |
| **@anthropic-ai/sdk**         | 0.39    | Official Anthropic API client — streaming, tool use, messages |
| **@modelcontextprotocol/sdk** | 1.12.1  | MCP protocol client + server implementation                   |

### CLI & Terminal

| Technology       | Version | Role                                             |
| ---------------- | ------- | ------------------------------------------------ |
| **Commander.js** | 13.1    | CLI argument/flag parsing                        |
| **xterm.js**     | 5.5     | Terminal emulation (used in web and bridge)      |
| **node-pty**     | 1.1     | Pseudo-terminal (PTY) support for shell sessions |
| **chalk**        | 5.4     | Terminal color formatting                        |
| **execa**        | 9.5     | Shell command execution                          |

### Build & Tooling

| Technology        | Version | Role                                            |
| ----------------- | ------- | ----------------------------------------------- |
| **esbuild**       | 0.25    | Ultra-fast bundler for CLI distribution         |
| **Biome**         | 1.9     | Linter + formatter (replaces ESLint + Prettier) |
| **OpenTelemetry** | —       | Distributed tracing and observability           |
| **GrowthBook**    | 1.4     | Feature flags and A/B testing                   |

### Web Stack

| Technology        | Version | Role                                  |
| ----------------- | ------- | ------------------------------------- |
| **Next.js**       | 14.2    | React meta-framework for web frontend |
| **Zustand**       | 4.5     | Lightweight global state management   |
| **SWR**           | 2.2     | Data fetching with caching            |
| **Tailwind CSS**  | 3.4     | Utility-first CSS framework           |
| **Radix UI**      | 1.1–2.1 | Accessible headless UI components     |
| **Framer Motion** | 11      | Animation library                     |
| **Shiki**         | 1.10    | Syntax highlighting for code blocks   |

### Validation & Data

| Technology  | Version | Role                                                 |
| ----------- | ------- | ---------------------------------------------------- |
| **Zod**     | 3.24    | Runtime schema validation (all inputs/outputs typed) |
| **yaml**    | 2.6     | YAML config parsing                                  |
| **diff**    | 7       | Text diffing (used in FileEdit tool)                 |
| **fuse.js** | 7       | Fuzzy search                                         |

### Networking

| Technology | Version | Role                      |
| ---------- | ------- | ------------------------- |
| **axios**  | 1.7     | HTTP client               |
| **ws**     | 8.18    | WebSocket support         |
| **undici** | 7.3     | Fast fetch implementation |

---

## 4. Architecture Deep-Dive

### 4.1 CLI Core Pipeline

The request lifecycle flows through a clean pipeline:

```
User types a message or command
         │
         ▼
   CLI Entry (cli.tsx)
   ├─ Parse flags (Commander.js)
   ├─ Detect slash commands (/commit, /review, ...)
   ├─ Load session + memory
   └─ Spawn daemon worker if needed
         │
         ▼
   Query Engine (QueryEngine.ts)
   ├─ Build system prompt + conversation history
   ├─ Inject tool definitions
   └─ POST to Anthropic API (streaming)
         │
         ▼
   LLM Streaming Response
   ├─ text blocks → rendered to terminal
   ├─ thinking blocks → internal reasoning (extended thinking mode)
   └─ tool_use blocks → trigger tool execution
         │
         ▼
   Tool Execution Loop
   ├─ Permission check
   ├─ Tool invocation
   ├─ Progress updates → UI
   └─ Result fed back to LLM as tool_result
         │
         ▼
   (loop until stop_reason = "end_turn")
         │
         ▼
   Terminal UI Render (React + Ink)
   ├─ Message stream rendered in real-time
   ├─ Tool use/result blocks formatted
   └─ Spinner, progress bars, diffs, syntax highlighting
```

---

### 4.2 Query Engine — The Heart of the System

**File:** `src/QueryEngine.ts` (~1,297 lines)

The Query Engine is the core stateful controller for all LLM interactions. It manages:

- **Streaming**: Receives streaming responses from Anthropic API and emits events
- **Tool Call Loops**: When LLM emits `tool_use` blocks, it executes tools and feeds results back in subsequent messages until `end_turn`
- **Thinking Mode**: Extended thinking with configurable token budgets for deep reasoning
- **Retry Logic**: Automatic exponential backoff on API errors, rate limits, and transient failures
- **Token Counting**: Tracks input/output tokens consumed per turn and across the session for cost reporting
- **Context Management**: Maintains conversation history, filters redundant messages, enforces context window limits
- **Compaction**: When context grows too large, calls the Compact service to summarize conversation history
- **State Synchronization**: After each turn, persists session state to disk and syncs memory

**Key methods:**

- `query(messages, options)` — Main entry point
- Internal tool execution dispatcher
- Error/retry handlers
- Streaming event emitters consumed by the UI

---

### 4.3 Tool System

**Files:** `src/Tool.ts` (794 lines), `src/tools/` (40+ tools), `src/tools.ts` (registration)

Every capability Claude can exercise on your behalf is expressed as a **Tool**. Each tool is self-contained in its own directory with:

- A typed input schema (Zod)
- A `call()` implementation
- A `checkPermissions()` method
- UI renderers for tool use and tool result display
- A system prompt injection (so Claude knows how/when to use it)

**Tool Definition Pattern:**

```typescript
export const MyTool = buildTool({
  name: 'MyTool',
  description: 'What this tool does — shown to LLM',
  inputSchema: z.object({ path: z.string(), content: z.string() }),

  async call(args, context, canUseTool, parentMessage, onProgress) {
    // Do actual work here
    return { data: result };
  },

  async checkPermissions(input, context) {
    // Return { allowed: false } to block, prompt user, etc.
  },

  isConcurrencySafe(input) {
    return false;
  }, // Can run in parallel?
  isReadOnly(input) {
    return false;
  }, // Safe to skip permission prompt?

  prompt(options) {
    return `Use MyTool when you need to...`; // Injected into system prompt
  },

  renderToolUseMessage(input, options) {
    /* JSX for "Claude is doing X" */
  },
  renderToolResultMessage(content, progressMessages, options) {
    /* JSX for result */
  },
});
```

**Complete Tool Catalog:**

| Category                  | Tool Name          | Description                                                |
| ------------------------- | ------------------ | ---------------------------------------------------------- |
| **File System**           | `FileRead`         | Read file contents (with line range support)               |
|                           | `FileWrite`        | Create or overwrite files                                  |
|                           | `FileEdit`         | Surgical string replacements (with diff preview)           |
|                           | `GlobTool`         | Find files by pattern matching                             |
|                           | `GrepTool`         | Regex search across files (ripgrep-powered)                |
|                           | `NotebookEdit`     | Read/edit Jupyter notebooks                                |
|                           | `TodoWrite`        | Manage task lists                                          |
| **Shell & Execution**     | `BashTool`         | Run arbitrary shell commands                               |
|                           | `PowerShellTool`   | PowerShell execution (Windows)                             |
|                           | `REPLTool`         | Interactive REPL session                                   |
| **Agent & Orchestration** | `AgentTool`        | Spawn sub-agents to handle sub-tasks                       |
|                           | `SendMessage`      | Send messages to named agents                              |
|                           | `TeamCreate`       | Create a team of agents                                    |
|                           | `TeamDelete`       | Destroy an agent team                                      |
|                           | `EnterPlanMode`    | Switch to plan-only mode                                   |
|                           | `ExitPlanMode`     | Return from plan mode                                      |
|                           | `EnterWorktree`    | Enter an isolated git worktree                             |
|                           | `ExitWorktree`     | Exit git worktree                                          |
|                           | `SleepTool`        | Pause execution (wait)                                     |
|                           | `SyntheticOutput`  | Generate synthetic output (testing)                        |
| **Task Management**       | `TaskCreate`       | Create a tracked task                                      |
|                           | `TaskUpdate`       | Update task status/content                                 |
|                           | `TaskGet`          | Retrieve task details                                      |
|                           | `TaskList`         | List all tasks                                             |
|                           | `TaskOutput`       | Read output from a running task                            |
|                           | `TaskStop`         | Stop a running task                                        |
| **Web**                   | `WebFetch`         | Fetch and parse web pages                                  |
|                           | `WebSearch`        | Search the web (with DuckDuckGo or configured provider)    |
| **MCP**                   | `MCPTool`          | Invoke tools on remote MCP servers                         |
|                           | `ListMcpResources` | Browse resources on MCP server                             |
|                           | `ReadMcpResource`  | Read a resource from MCP server                            |
|                           | `McpAuthTool`      | Handle MCP authentication flows                            |
|                           | `ToolSearch`       | Discover and load deferred MCP tools                       |
| **Code Intelligence**     | `LSPTool`          | Language Server Protocol queries (go-to-definition, hover) |
| **Skills**                | `SkillTool`        | Execute named skills (user-defined prompt templates)       |
| **Scheduling**            | `ScheduleCron`     | Create/manage cron jobs                                    |
|                           | `RemoteTrigger`    | Trigger remote scheduled agents                            |
| **Utility**               | `AskUserQuestion`  | Pause and ask user a clarifying question                   |
|                           | `BriefTool`        | Get a brief summary                                        |
|                           | `ConfigTool`       | Read/write Claude Code settings                            |

---

### 4.4 Command System

**Files:** `src/commands/` (~100 commands), `src/commands.ts` (registration)

Slash commands (`/commit`, `/review`, etc.) are the user-facing interface to pre-built workflows. They come in three types:

| Type                | How It Works                                               | Examples                                 |
| ------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| **PromptCommand**   | Formats a structured prompt, injects context, sends to LLM | `/review`, `/commit`, `/security-review` |
| **LocalCommand**    | Runs entirely in-process, returns plain text               | `/cost`, `/version`, `/help`             |
| **LocalJSXCommand** | Runs in-process, returns React JSX rendered in terminal    | `/doctor`, `/install`                    |

**Full Command Catalog by Category:**

**Git & Version Control:**

- `/commit` — Stage and create a git commit with AI-written message
- `/commit-push-pr` — Commit, push, and open a pull request
- `/branch` — Create or switch branches
- `/diff` — View and explain git diff
- `/pr_comments` — Review pull request comments
- `/rewind` — Undo recent changes

**Code Quality:**

- `/review` — Full code review of staged changes
- `/security-review` — Security-focused review (OWASP, SAST)
- `/advisor` — Architecture and design advice
- `/bughunter` — Automated bug hunting

**Session Management:**

- `/compact` — Compress conversation history to save tokens
- `/context` — Show current context window usage
- `/resume` — Restore a previous conversation session
- `/session` — Manage named sessions
- `/share` — Create shareable conversation link
- `/export` — Export conversation to file
- `/summary` — Summarize the current session
- `/clear` — Clear conversation history

**Configuration:**

- `/config` — View/edit settings
- `/permissions` — Manage tool permission rules
- `/theme` — Change color theme
- `/output-style` — Change response format
- `/model` — Switch Claude model
- `/effort` — Adjust effort/thinking level
- `/fast` — Toggle fast mode
- `/brief` — Toggle brief output mode
- `/vim` — Toggle vim keybindings

**Memory & Files:**

- `/memory` — View/edit persistent memory
- `/add-dir` — Add directory to workspace
- `/files` — Browse workspace files

**MCP & Plugins:**

- `/mcp` — Manage MCP server connections
- `/plugin` — Install/remove plugins

**Diagnostics:**

- `/doctor` — Environment health check
- `/install` — Install Claude Code components
- `/version` — Show version info
- `/status` — Connection status
- `/keybindings` — Customize keyboard shortcuts
- `/privacy-settings` — Manage privacy/telemetry settings

---

### 4.5 Service Layer

**Location:** `src/services/`

The service layer provides abstracted subsystems that multiple tools and components share:

| Service               | Directory                         | Purpose                                                                               |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| **MCP Client**        | `services/mcp/`                   | Connect to external MCP servers; enumerate and invoke remote tools/resources          |
| **LSP**               | `services/lsp/`                   | Language Server Protocol client for code intelligence (hover, definition, completion) |
| **OAuth**             | `services/oauth/`                 | OAuth 2.0 flows for GitHub, Slack, and other integrations                             |
| **Compact**           | `services/compact/`               | Summarize long conversations to reduce context window usage                           |
| **Session Memory**    | `services/SessionMemory/`         | Read and write persistent conversation memory to disk                                 |
| **Plugins**           | `services/plugins/`               | Plugin/skill registry — install, discover, and run skills                             |
| **API**               | `services/api/`                   | Wrapper around Anthropic SDK with retry, auth, and error handling                     |
| **Analytics**         | `services/analytics/`             | GrowthBook feature flags + OpenTelemetry telemetry events                             |
| **Policies**          | `services/policyLimits/`          | Enterprise/MDM policy enforcement (what models are allowed, rate limits)              |
| **Remote Settings**   | `services/remoteManagedSettings/` | Fetch and apply centrally-managed org settings                                        |
| **Tool Registry**     | `services/tools/`                 | Tool discovery, registration, and dynamic loading                                     |
| **Tool Use Summary**  | `services/toolUseSummary/`        | Track and report tool invocation statistics                                           |
| **Agent Summary**     | `services/AgentSummary/`          | Synthesize summaries from multi-agent runs                                            |
| **Memory Extraction** | `services/extractMemories/`       | Automatically extract key facts from conversations                                    |
| **Team Memory Sync**  | `services/teamMemorySync/`        | Synchronize memories across agent teams                                               |
| **Auto Dream**        | `services/autoDream/`             | Proactive background learning mode                                                    |
| **Magic Docs**        | `services/MagicDocs/`             | Intelligent documentation generation                                                  |

---

### 4.6 State Management

**Global AppState** (`src/state/AppState.ts`):
A single mutable global state object that flows through the entire application. It holds:

- Full conversation history
- Runtime configuration (model, permissions, workspace paths)
- Active tool states and progress
- MCP connectivity status
- User preferences and theme

**Change Observers** (`src/state/onChangeAppState.ts`):
Side-effect handlers triggered whenever AppState mutates — they handle persistence, analytics events, and UI updates.

**Web Store** (`web/lib/store.ts`):
A Zustand store for the Next.js frontend with localStorage persistence middleware. Manages conversations, settings, and UI state separately from the CLI.

---

### 4.7 Terminal UI (React + Ink)

The CLI renders its terminal interface using **React + Ink** — a library that acts as a React renderer targeting the terminal instead of a browser DOM. This means all terminal output is built from React components.

**Components** (`src/components/` — ~140 components):

- Design system primitives (`Box`, `Text`, `Divider`, `Badge`, `Spinner`)
- Message rendering (text, tool use, tool results, errors)
- Input components (text input, autocomplete, vim mode)
- Diff viewer, syntax highlighter, file tree
- Permission prompt dialogs
- Progress bars and status indicators

**Screens** (`src/screens/`):

- `REPL.tsx` — The main interactive read-eval-print loop where users type
- `Doctor.tsx` — Full-screen environment diagnostics
- `ResumeConversation.tsx` — Session selection and restore

**Hooks** (`src/hooks/` — ~80 hooks):

| Hook Group          | Examples                                                             |
| ------------------- | -------------------------------------------------------------------- |
| **Permissions**     | `useCanUseTool`, `useToolPermission`                                 |
| **IDE Integration** | `useIDEIntegration`, `useIdeConnectionStatus`, `useDiffInIDE`        |
| **Input**           | `useTextInput`, `useVimInput`, `usePasteHandler`, `useInputBuffer`   |
| **Session**         | `useSessionBackgrounding`, `useRemoteSession`, `useAssistantHistory` |
| **Plugins**         | `useManagePlugins`, `useSkillsChange`                                |
| **Notifications**   | Rate limit warnings, deprecation notices                             |

---

### 4.8 Bridge (IDE Integration)

**Location:** `src/bridge/`

The Bridge layer connects Claude Code to IDE extensions (VS Code, JetBrains) over an authenticated local channel. This enables inline AI assistance without leaving the editor.

**Architecture:**

```
IDE Extension (VS Code / JetBrains)
          │
          │  JWT-authenticated messages
          ▼
    Bridge Layer (src/bridge/)
    ├─ bridgeMain.ts            ← Bidirectional message loop
    ├─ bridgeMessaging.ts       ← Protocol (serialize/deserialize)
    ├─ bridgePermissionCallbacks.ts ← Route permission prompts to IDE
    ├─ bridgeApi.ts             ← API surface exposed to IDE
    ├─ jwtUtils.ts              ← JWT token generation/validation
    ├─ sessionRunner.ts         ← Manage session execution
    └─ trustedDevice.ts         ← Device trust verification
          │
          ▼
    Claude Code Core (QueryEngine, Tools)
```

Key behaviors:

- **JWT Auth**: Every message is cryptographically signed — prevents rogue processes from controlling Claude
- **Permission routing**: Prompts that would appear in terminal are instead routed to IDE UI
- **Diff integration**: File edits appear as IDE-native diff views
- **Feature flag**: `BRIDGE_MODE` is dead-code-eliminated from non-IDE builds for zero overhead

---

### 4.9 Permission System

**Location:** `src/hooks/toolPermission/`

Before any tool executes, the permission system evaluates whether it's allowed. This prevents Claude from running dangerous operations without user consent.

**Permission Modes:**

| Mode                | Behavior                                                                |
| ------------------- | ----------------------------------------------------------------------- |
| `default`           | Prompt the user for each potentially destructive or sensitive operation |
| `plan`              | Show the full plan upfront, ask once before execution begins            |
| `bypassPermissions` | Auto-approve everything — useful for trusted automated workflows        |
| `auto`              | ML-based classifier determines whether to prompt (experimental)         |

**Permission Rules:**

Rules are wildcard pattern strings per tool:

```
Bash(git *)          ← Allow all git commands
FileEdit(/src/*)     ← Allow edits only inside /src/
FileRead(*)          ← Allow reading any file
WebSearch(*)         ← Allow all web searches
```

Rules are stored in `~/.claude/settings.json` and `CLAUDE.md` files and are evaluated by each tool's `checkPermissions()` method before execution.

---

### 4.10 Memory System

Claude Code implements a multi-layer memory system so it remembers important information across sessions:

**Layer 1 — CLAUDE.md (Project Instructions):**

- A Markdown file in your project root (committed to git)
- Contains project-specific conventions, style guides, and instructions
- Automatically loaded into every conversation's system prompt

**Layer 2 — CLAUDE.local.md (Personal Preferences):**

- Gitignored personal preferences per project
- User-specific overrides (editor preferences, personal aliases)

**Layer 3 — Persistent Memory Files:**

- `~/.claude/projects/<project>/memory/` directory
- Individual `.md` files for specific memories (user profile, feedback, project context)
- `MEMORY.md` index file listing all memories with descriptions
- Automatically loaded as context in subsequent sessions

**Memory Extraction Service** (`services/extractMemories/`):

- Runs at end of sessions to extract key facts from conversation
- Saves them as structured memory files
- Includes metadata: `name`, `description`, `type` (user/feedback/project/reference)

---

### 4.11 Session & Persistence

Sessions are the unit of conversation persistence:

**CLI sessions:**

- Stored in `~/.claude/` directory
- Each session has a unique ID
- Contains full message history, tool results, settings snapshot

**Web sessions:**

- Stored in browser localStorage via Zustand persistence middleware
- Each conversation has its own record with messages, metadata, tags

**Session lifecycle:**

1. On start: Load latest session or create new one
2. After each turn: Append messages, save to disk
3. On `/compact`: Summarize history, store compact version
4. On `/resume`: List available sessions, restore selected

---

## 5. Web Application

**Location:** `web/`
**Framework:** Next.js 14.2 (App Router)

### Pages & Routes

| Route                   | Component                          | Purpose                         |
| ----------------------- | ---------------------------------- | ------------------------------- |
| `/`                     | `web/app/page.tsx`                 | Main chat interface             |
| `/share/[shareId]`      | `web/app/share/[shareId]/page.tsx` | View shared conversations       |
| `POST /api/chat`        | `web/app/api/chat/route.ts`        | Proxy to Claude API (streaming) |
| `POST /api/files/read`  | `web/app/api/files/read/route.ts`  | Read filesystem files           |
| `POST /api/files/write` | `web/app/api/files/write/route.ts` | Write filesystem files          |
| `POST /api/export`      | `web/app/api/export/route.ts`      | Export conversation             |
| `POST /api/share`       | `web/app/api/share/route.ts`       | Create share link               |

### Key UI Components

**Layout:**

- `ChatLayout` — Main container (sidebar + main content)
- `Sidebar` — Conversation list with search, tags, pin support
- `Header` — Title bar, model selector, action buttons
- `ChatWindow` — Virtualized message list
- `ChatInput` — Rich message input

**Tool Result Visualization:**

- `ToolFileRead` — Syntax-highlighted file contents
- `ToolFileEdit` — Inline diff viewer
- `ToolBash` — Shell output with ANSI color rendering
- `ToolGrep` — Search results formatted nicely
- `ToolWebSearch` — Web search results with source links

**Collaboration Features** (`web/lib/collaboration/`):

- Real-time cursor presence
- User avatars and status
- Shared permission state
- Socket-based messaging for multi-user workspaces

### API Client (`web/lib/api/client.ts`)

- Automatic retry with exponential backoff
- Request deduplication for GET requests
- AbortSignal support for cancellation
- Error classification: `auth`, `rate_limit`, `server`, `network`, `unknown`

---

## 6. MCP Server

**Location:** `mcp-server/`

Claude Code ships with a standalone MCP server that exposes itself as a tool/resource provider to other AI agents. This is distinct from Claude Code _acting as an MCP client_ to consume external tools.

### Server Capabilities

**Resources exposed:**
| Resource URI | Content | Format |
|-------------|---------|--------|
| `claude-code://architecture` | Architecture overview | Markdown |
| `claude-code://tools` | Tool registry (all tools, schemas) | JSON |
| `claude-code://commands` | Command registry | JSON |
| `claude-code://source/{path}` | Raw source file | Text |

**Tools exposed:** None by default (extendable)

### Transports

**STDIO** (`mcp-server/src/index.ts`):

- Bidirectional JSON-RPC over stdin/stdout
- For local use with Claude Desktop or other local MCP clients
- Zero network exposure

**HTTP + SSE** (`mcp-server/src/http.ts`):

- Express.js server (default port 3000, configurable via `PORT` env)
- `POST /mcp` — JSON-RPC requests
- `GET /mcp` — Server-Sent Events stream (with `mcp-session-id` header)
- `DELETE /mcp` — Close SSE session
- `GET /health` — Health check (always public, no auth)
- For remote hosting (Railway, Render, VPS, etc.)

### Authentication

- Optional `MCP_API_KEY` environment variable
- Validates Bearer tokens on all non-health endpoints
- Health endpoint always accessible without auth

### Deployment

```yaml
# docker-compose.yml (example)
services:
  mcp-server:
    build: ./mcp-server
    environment:
      - MCP_API_KEY=your-secret-key
      - PORT=3000
    ports:
      - '3000:3000'
```

---

## 7. Data Models & Schemas

### Message Types (`src/types/message.ts`)

```typescript
// Assistant response from LLM
interface AssistantMessage {
  type: 'assistant';
  message: BetaMessage; // Anthropic API message object
  requestId?: string; // API request ID for debugging
  isMeta?: boolean; // Internal meta-messages
  agentId?: string; // Which sub-agent produced this
}

// User's message
interface UserMessage {
  type: 'user';
  message: { role: 'user'; content: string | ContentBlockParam[] };
  attachments?: Attachment[]; // Files, images attached
}

// System notification (info, warning, error)
interface SystemMessage {
  type: 'system';
  subtype: 'info' | 'warning' | 'error' | 'hook' | 'command';
  level: SystemMessageLevel;
  content: string;
}

// Tool execution progress update
interface ProgressMessage<P extends Progress = Progress> {
  type: 'progress';
  data: P; // Tool-specific progress data
  toolUseID: string; // Links to the tool_use block
  timestamp: string;
}
```

### Conversation (Web) (`web/lib/types.ts`)

```typescript
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  tags?: string[];
  isPinned?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: ContentBlock[] | string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  createdAt: number;
  usage?: { input_tokens: number; output_tokens: number };
}

// Content can be text, tool invocation, or tool result
type ContentBlock = TextContent | ToolUseContent | ToolResultContent;
```

### Permission Model

```typescript
type PermissionMode = 'default' | 'plan' | 'bypassPermissions' | 'auto';

interface PermissionResult {
  allowed: boolean;
  reason?: string; // Explanation shown to user if denied
}

// Permission rules are stored as wildcard strings per tool
type PermissionRules = {
  [toolName: string]: string[];
};
```

### Share Link (`web/lib/types.ts`)

```typescript
type ShareVisibility = 'public' | 'unlisted' | 'password';
type ShareExpiry = '1h' | '24h' | '7d' | '30d' | 'never';

interface ShareLink {
  id: string;
  conversationId: string;
  visibility: ShareVisibility;
  hasPassword: boolean;
  expiry: ShareExpiry;
  expiresAt?: number;
  createdAt: number;
  url: string;
}
```

---

## 8. Configuration Files

| File                        | Purpose                                                    |
| --------------------------- | ---------------------------------------------------------- |
| `package.json`              | Root Bun workspace — workspace members, scripts, engines   |
| `web/package.json`          | Web app dependencies (Next.js, React, Tailwind, Radix)     |
| `mcp-server/package.json`   | MCP server dependencies (Express, MCP SDK)                 |
| `tsconfig.json`             | TypeScript — JSX mode, ESModules, strict types, paths      |
| `web/tsconfig.json`         | Next.js-specific TS (includes Next.js types)               |
| `mcp-server/tsconfig.json`  | MCP server TS config                                       |
| `biome.json`                | Linter + formatter rules (replaces ESLint + Prettier)      |
| `server.json`               | MCP server manifest (name, version, transport descriptors) |
| `vercel.json`               | Vercel deployment config (rewrites, headers, build)        |
| `docker/docker-compose.yml` | Docker services (web + volume mount for `~/.claude/`)      |
| `Dockerfile`                | Container for web + CLI                                    |
| `mcp-server/Dockerfile`     | Container for MCP server                                   |
| `.gitignore`                | Excludes `node_modules/`, `dist/`, `.env`, `.claude/`      |
| `agent.md`                  | Instructions for AI agents operating inside this repo      |
| `prompts/`                  | Prompt templates for specific workflows                    |

---

## 9. Key Data Flows

### Full Conversation Turn

```
1. User types: "Refactor this function for readability"
2. CLI: Parses input, no slash command detected
3. Query Engine:
   - Loads system prompt (CLAUDE.md + memory files + tool definitions)
   - Appends user message to history
   - POSTs to Anthropic API with full context
4. LLM response (streaming):
   - <thinking>: Reads code, plans approach (extended thinking)
   - <text>: "I'll refactor this function..."
   - <tool_use id="tu_1" name="FileRead">{ path: "src/foo.ts" }</tool_use>
5. Permission check: FileRead is read-only → auto-approved
6. Tool execution: FileRead reads src/foo.ts
7. Tool result fed back to LLM:
   - <tool_result tool_use_id="tu_1">... file contents ...</tool_result>
8. LLM continues:
   - <tool_use id="tu_2" name="FileEdit">{ path: ..., old: ..., new: ... }</tool_use>
9. Permission check: FileEdit needs approval (or matches allow rule)
10. Tool execution: Edit applied, diff shown in terminal
11. Tool result fed back
12. LLM: stop_reason = "end_turn" → "Done! I refactored the function by..."
13. Messages appended to session, saved to disk
```

### MCP Tool Invocation

```
1. LLM decides to use a tool from a connected MCP server
2. MCPTool receives tool name + input args
3. MCPTool serializes as JSON-RPC: { method: "tools/call", params: { name, arguments } }
4. Transport sends over STDIO pipe or HTTP POST
5. MCP server receives, executes the tool
6. Response streams back (or returns as single result)
7. MCPTool returns result to LLM as tool_result block
```

---

## 10. What Are MCPs? (Model Context Protocol)

### Definition

**MCP (Model Context Protocol)** is an open standard protocol developed by Anthropic for connecting AI models to external tools, data sources, and services. Think of it as **USB-C for AI** — a universal plug that lets any AI model speak to any tool provider using the same language.

Before MCP, every AI application had to build custom integrations for every external service (databases, APIs, file systems, etc.). MCP standardizes this so:

- **Any MCP client** (Claude Code, Claude Desktop, other AI apps) can connect to
- **Any MCP server** (GitHub, Postgres, Slack, file system, custom tools) using a
- **Single protocol** (JSON-RPC 2.0 over STDIO, HTTP, or WebSocket)

### Core Concepts

**MCP Servers:**
Programs that expose capabilities to AI models. A server can expose three kinds of things:

1. **Tools** — Functions the AI can call (e.g., `search_database`, `create_file`, `send_email`)
2. **Resources** — Data the AI can read (e.g., `file://project/schema.sql`, `db://customers`)
3. **Prompts** — Pre-built prompt templates with parameters

**MCP Clients:**
AI applications that connect to MCP servers and make their capabilities available to the LLM. Claude Code is an MCP client — it connects to configured MCP servers and feeds their tools to Claude.

**Transports:**
The physical channel over which MCP messages travel:

| Transport      | Use Case                                                                                |
| -------------- | --------------------------------------------------------------------------------------- |
| **STDIO**      | Local servers — parent process spawns server as child, communicates via stdin/stdout    |
| **HTTP + SSE** | Remote servers — client POSTs requests, server streams responses via Server-Sent Events |
| **WebSocket**  | Bidirectional real-time communication                                                   |

### How It Works in Practice

```
Claude Code (MCP Client)
        │
        │  JSON-RPC 2.0
        ├──────────────────► GitHub MCP Server
        │                     (create PR, list issues, comment)
        │
        ├──────────────────► Postgres MCP Server
        │                     (query DB, describe schema)
        │
        ├──────────────────► Filesystem MCP Server
        │                     (read/write arbitrary files)
        │
        └──────────────────► Custom Internal API Server
                              (search docs, call business APIs)
```

Each server runs independently. Claude Code:

1. Reads server configs (from `~/.claude/settings.json` or `CLAUDE.md`)
2. Spawns/connects to each server at startup
3. Calls `tools/list` to discover available tools
4. Injects those tools into Claude's system prompt
5. When Claude calls an MCP tool, routes the call to the correct server
6. Returns the result to Claude as a `tool_result`

### Claude Code as Both Client AND Server

Uniquely, Claude Code plays both roles:

**As a Client:** It connects to external MCP servers to gain capabilities (GitHub, databases, custom tools).

**As a Server:** The `mcp-server/` directory implements Claude Code itself as an MCP server — exposing its architecture, source code, and tool registry as resources for _other_ AI agents to query. This enables meta-AI workflows where agents inspect and learn from Claude Code's own implementation.

### Why MCP Matters

- **Ecosystem**: Hundreds of pre-built MCP servers exist (GitHub, Slack, Linear, Notion, databases, browsers, etc.)
- **Composability**: Chain multiple MCP servers to build complex agent workflows
- **Security**: Fine-grained permissions per tool, per server
- **Open standard**: Not locked to Anthropic — other AI providers are adopting it
- **Local + Remote**: Works for local file access (STDIO) and remote APIs (HTTP)

### Key MCP Concepts in This Codebase

- `src/services/mcp/` — MCP client implementation (connects to external servers)
- `mcp-server/` — MCP server implementation (exposes Claude Code's internals)
- `MCPTool` — The tool that routes LLM calls to MCP servers
- `ListMcpResources` / `ReadMcpResource` — Browse and read MCP resources
- `McpAuthTool` — Handle OAuth-style authentication for MCP servers
- `ToolSearch` — Dynamically discover tools from deferred MCP sources
- `/mcp` command — CLI interface to manage MCP server connections

---

## 11. Potential Use Cases & Applications

### Primary Use Cases (Current)

**1. AI-Augmented Software Development**
The primary intended use — an AI pair programmer that can read your code, write new code, run tests, manage git, and explain complex systems. Goes far beyond code completion: it can plan multi-file refactors, analyze performance bottlenecks, generate tests, and write documentation.

**2. Automated Code Review Pipeline**
Use `/review` and `/security-review` in CI/CD pipelines to automatically review PRs. The agent understands context (what changed, why, neighboring code), not just syntax — making reviews genuinely useful rather than just linting.

**3. Codebase Onboarding Assistant**
New engineers can ask Claude Code to explain any part of the codebase, trace data flows, document APIs, or generate architecture diagrams. The memory system allows it to remember team-specific conventions over time.

**4. Documentation Generation**
The `MagicDocs` service and `/review` command can auto-generate and update technical documentation. Keeps docs in sync with code as it evolves.

---

### Extended & Novel Use Cases

**5. Personal AI Research Assistant**
By connecting web search, file system, and custom MCP servers, Claude Code becomes a full research agent. It can search the web, read papers, synthesize findings, and write reports — all while maintaining a session-persistent research journal in memory files.

**6. Enterprise Knowledge Management**
Deploy Claude Code with a custom MCP server connected to your internal wikis, ticketing systems (Jira, Linear), and code repositories. Teams can query institutional knowledge in natural language, and Claude Code's memory system can learn team-specific terminology and workflows over time.

**7. Automated Incident Response**
Connect Claude Code to monitoring systems (Grafana, Datadog) and alerting MCP servers. When an alert fires, an agent can automatically:

- Query logs and metrics
- Identify the root cause in code
- Open an incident ticket
- Draft a runbook entry
- Page the on-call engineer with a summary

**8. Multi-Agent Software Factories**
Using `AgentTool`, `TeamCreate`, and the coordinator subsystem, orchestrate parallel agent teams — one for backend, one for frontend, one for tests, one for review. A coordinator agent decomposes tasks, assigns work, and synthesizes results. This enables autonomous development pipelines.

**9. Legacy Code Modernization**
Point Claude Code at a legacy codebase and instruct it to systematically refactor — updating deprecated APIs, migrating to modern patterns, adding type annotations, replacing outdated dependencies — while running tests after each change to ensure correctness.

**10. AI-Powered Developer Tooling Platform**
Build custom internal tools on top of the Agent SDK (`src/entrypoints/sdk/`). Your tooling can embed Claude's intelligence — for example, an intelligent build system that explains failures in plain English, suggests fixes, and applies them automatically.

**11. Natural Language Database Interface**
Connect a Postgres MCP server and let non-technical stakeholders query data in plain English. Claude translates to SQL, executes, formats results as readable summaries or visualizations, and explains what it found.

**12. Autonomous QA & Test Generation**
Feed Claude Code a feature spec and ask it to write a comprehensive test suite — unit tests, integration tests, edge cases, and regression tests. The agent reads existing code patterns to match style and can run tests iteratively until they pass.

**13. Security Audit Automation**
Use `/security-review` in a scheduled pipeline to run continuous security audits against new code. Claude can identify OWASP Top 10 vulnerabilities, insecure dependencies, exposed secrets, and misconfigured infrastructure — producing prioritized, actionable reports.

**14. DevOps Automation Agent**
Connect Claude Code to infrastructure MCP servers (Kubernetes, Terraform, AWS CLI). Let it manage deployments, scale services, rotate credentials, and explain infrastructure drift — all in natural language, with permission gates before any destructive action.

**15. Educational Coding Tutor**
Use the web interface as a teaching platform. Students submit code, Claude reviews it with pedagogical explanations, suggests improvements, and guides them through debugging — all while maintaining a memory of their skill level and past mistakes.

**16. Technical Interview Platform**
Run coding challenges where Claude Code acts as both examiner and assistant. It can generate problems, evaluate solutions, ask follow-up questions, and provide detailed feedback — scaling to thousands of candidates simultaneously.

**17. Open Source Project Assistant**
Deploy as a GitHub bot that automatically triages issues (labeling, severity), suggests fixes for common bugs, reviews PRs with context-aware feedback, and welcomes new contributors with relevant documentation links.

**18. MCP Hub / Orchestration Layer**
Because Claude Code is itself an MCP server, you can build a hub-and-spoke architecture where Claude Code becomes the intelligent middleware between many MCP servers and many AI clients — routing requests, aggregating results, and maintaining shared context.

**19. Intelligent IDE Extension Backend**
The bridge architecture (`src/bridge/`) is purpose-built for IDE integration. Build a VS Code extension that delegates all AI logic to Claude Code, getting: file editing, terminal access, git operations, web search, and full LLM reasoning — without rebuilding these from scratch.

**20. Compliance & Governance Automation**
Connect to code repositories, cloud infrastructure, and policy databases via MCP. Have Claude Code continuously audit for compliance violations (GDPR, SOC2, HIPAA), produce evidence reports, and suggest remediation — dramatically reducing audit costs.

---

### Emerging / Speculative Use Cases

**21. Autonomous Research Engineer**
With the `autoDream` service and scheduled triggers, Claude Code could proactively explore a codebase overnight, identifying technical debt, undocumented behaviors, and improvement opportunities — leaving a morning report for engineers.

**22. AI-Native Documentation Sites**
Use the share functionality and web interface to publish living documentation that users can ask questions about directly — the docs answer in context rather than requiring keyword search.

**23. Voice-Driven Development**
The `VOICE_MODE` feature flag hints at planned voice input/output. A voice-controlled coding assistant that executes changes by spoken command would be a natural evolution of the current capability.

**24. Cross-Language Code Migration**
Systematically port codebases from one language to another (Python → TypeScript, Java → Go) with context-aware translation that preserves business logic, adapts idioms, and runs tests at each step.

---

## 12. Notable Implementation Details

### Performance Engineering

- **Bun over Node.js**: 3–10x faster startup, native TypeScript, built-in bundler
- **Feature flags at compile time**: Dead code is eliminated from production bundles — BRIDGE_MODE, VOICE_MODE, etc. add zero overhead when disabled
- **Lazy loading**: Heavy modules (OpenTelemetry, gRPC) loaded only when needed
- **React Compiler**: Automatic memoization of React components (enabled)
- **Virtual list rendering**: Web UI uses virtualized lists for large conversation histories

### Security Design

- **Permission-before-execution**: Every tool checks permissions before doing anything
- **JWT-authenticated bridge**: IDE integration requires cryptographic proof
- **Wildcard permission rules**: Fine-grained allow/deny without bloated ACLs
- **No secrets in code**: API keys via environment variables; `.claude/` gitignored
- **Enterprise policy layer**: MDM policies can restrict models, tools, and data access

### Observability

- **OpenTelemetry**: Full distributed traces for every LLM call and tool execution
- **GrowthBook**: Feature flags with A/B testing for safely rolling out changes
- **Cost tracking**: Per-turn and cumulative token counts shown with `/cost`
- **Tool use summaries**: Aggregated stats on which tools are used most

### Extensibility Points

1. **New Tools**: Add a directory to `src/tools/`, export from `src/tools.ts`
2. **New Commands**: Add to `src/commands/`, export from `src/commands.ts`
3. **New MCP Servers**: Configure in `~/.claude/settings.json` under `mcpServers`
4. **New Skills**: Drop prompt templates in the skills directory, register via `/plugin`
5. **Agent SDK**: Embed Claude Code programmatically via `src/entrypoints/sdk/`
6. **Bridge Extensions**: Build IDE extensions using the bridge protocol

### Context Window Management

- **Compaction**: When context exceeds threshold, `services/compact/` summarizes history
- **Memory injection**: Key facts from memory files injected at conversation start
- **Selective history**: Not all messages in history are always sent — older messages filtered
- **Tool result truncation**: Large tool results truncated with pointers to full content

---

_This document was generated through comprehensive static analysis of the Claude Code codebase as of April 1, 2026. It covers the full architecture, all major subsystems, data models, and a detailed exploration of potential use cases across industries and workflows._

---

## 13. Security Audit

> **Audit Date:** April 1, 2026
> **Method:** Static analysis — source file examination across all directories

---

### 13.1 Critical Security Issues

---

#### CRIT-01 — Plaintext Password Storage in Share Feature

**Severity:** Critical
**File:** `web/lib/share-store.ts`

Shared conversation passwords are stored and compared as plaintext strings with no cryptographic hashing:

```typescript
// Password stored directly as plain string
passwordHash: params.password ?? undefined,

// Plaintext equality check — no hashing, no timing safety
export function verifySharePassword(shareId: string, password: string): boolean {
  const entry = store.get(shareId);
  if (!entry || entry.visibility !== "password") return false;
  return entry.passwordHash === password;  // PLAINTEXT COMPARISON
}
```

The field is named `passwordHash` despite containing a raw password — a misleading name that suggests hashing was intended but never implemented. The comparison is also vulnerable to timing attacks because JavaScript string equality short-circuits on the first non-matching character.

**Impact:** Any password-protected share link has its password stored in cleartext in process memory. If the process is inspected, memory-dumped, or logged, all share passwords are exposed. An attacker who can observe response timings can brute-force passwords character by character.

---

#### CRIT-02 — Unrestricted File Path Traversal in Web API

**Severity:** Critical
**Files:** `web/app/api/files/read/route.ts`, `web/app/api/files/write/route.ts`

Both file operation endpoints accept arbitrary paths from the request with no bounds checking:

```typescript
// read/route.ts
const filePath = request.nextUrl.searchParams.get('path');
const resolvedPath = path.resolve(filePath); // No whitelist, no prefix check
const buffer = await fs.readFile(resolvedPath); // Reads ANY file on disk

// write/route.ts
const { path: filePath, content } = body;
const resolvedPath = path.resolve(filePath); // Same issue
await fs.writeFile(resolvedPath, content); // Writes to ANY location
```

`path.resolve()` canonicalises the path (removing `../` sequences) but does not restrict it to any safe directory. An unauthenticated caller can supply `/etc/passwd`, `~/.ssh/id_rsa`, `.env`, or any other absolute path.

**Impact:** Arbitrary file read exposes credentials, private keys, and system files. Arbitrary file write can overwrite system binaries, inject malicious code, or corrupt critical configuration — leading to Remote Code Execution.

---

#### CRIT-03 — No Authentication on Any Web API Endpoint

**Severity:** Critical
**Files:** All routes under `web/app/api/`

Every API route handler executes without verifying the caller's identity:

```typescript
// api/chat/route.ts — anyone can trigger LLM calls
export async function POST(req: NextRequest) {
  const body = await req.json();
  // No session check, no API key, no CSRF token
  const response = await fetch(`${apiUrl}/api/chat`, { ... });
}
```

This applies to chat, file read, file write, export, and share creation. Only share _retrieval_ has a password gate, and even that is the flawed plaintext check described in CRIT-01.

**Impact:** Any actor with network access to the web interface can read and write arbitrary files, trigger LLM API calls (burning API credits), exfiltrate conversation histories, and create unlimited share links.

---

### 13.2 High-Severity Security Issues

---

#### HIGH-01 — No Rate Limiting on Any Endpoint

**Severity:** High
**Files:** All `web/app/api/*` routes

No server-side rate limiting exists on any endpoint. The client-side retry logic in `web/lib/api/client.ts` is the only throttling present, and it only applies to the client that made the request — it imposes no constraint on other callers.

**Impact:** The chat endpoint can be hammered to exhaust Anthropic API quota. The file write endpoint can be called in a tight loop to fill disk. The export endpoint can dump all conversations repeatedly. No protection against brute force, credential stuffing, or resource exhaustion.

---

#### HIGH-02 — JWT Signature Not Verified in Bridge Auth

**Severity:** High
**File:** `src/bridge/jwtUtils.ts`

The bridge layer decodes JWT payloads to extract claims (expiry, user identity) without verifying the cryptographic signature:

```typescript
/**
 * Decode a JWT's payload segment WITHOUT verifying the signature.
 */
export function decodeJwtPayload(token: string): unknown | null {
  // ... base64-decodes the middle segment only
  return jsonParse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}
```

This function is used for refresh scheduling and expiry decisions. Because the signature is not checked, any process that can write a crafted JWT to the bridge channel can supply forged claims (extended expiry, different identity).

**Impact:** An attacker with local access who can inject messages into the bridge channel can forge token metadata. While the actual Anthropic API call still requires a valid bearer token, forged claims can manipulate the local session state, permission context, and session lifetime.

---

#### HIGH-03 — No Content Security Policy Headers

**Severity:** High
**Files:** `web/` (no CSP configuration found in Next.js config or middleware)

No `Content-Security-Policy` HTTP headers are configured anywhere in the Next.js application. The app renders user-supplied content (conversation messages, file contents, tool outputs) that could contain script payloads.

**Impact:** Cross-site scripting (XSS) attacks are possible. An attacker who can inject content into a conversation (via a malicious file, web page fetch, or MCP server response) could execute arbitrary JavaScript in the user's browser session.

---

#### HIGH-04 — CORS Policy Not Enforced

**Severity:** High
**Files:** `docker/docker-compose.yml` (`ALLOWED_ORIGINS` env var), API routes

`ALLOWED_ORIGINS` is documented in docker-compose as an environment variable, but there is no visible middleware that reads it and enforces CORS headers in the API routes. If the variable is unset (its default), any origin can make credentialed cross-origin requests.

**Impact:** A malicious website visited by a user can make requests to the locally-running Claude Code web app, reading conversations and triggering file operations — a classic CSRF/CORS exploit.

---

### 13.3 Medium-Severity Security Issues

---

#### MED-01 — In-Memory Share Store With No Size Limit

**Severity:** Medium
**File:** `web/lib/share-store.ts`

Shared conversations are held in a module-level `Map` with no maximum size, no active expiry cleanup, and no persistence:

```typescript
// Comment in file: "In production, replace with a database"
const store = new Map<string, StoredShare>();
```

Expired entries are only removed lazily on the next access. There is no background job to reclaim memory.

**Impact:** Memory exhaustion DoS — an attacker can create unlimited share links, filling process heap. All share data is lost on process restart, which is also a data-integrity issue.

---

#### MED-02 — Error Messages Leak Internal File Paths

**Severity:** Medium
**Files:** `web/app/api/files/read/route.ts`, `web/app/api/files/write/route.ts`

Errors are returned verbatim to the client:

```typescript
const message = err instanceof Error ? err.message : 'Unknown error';
return NextResponse.json({ error: message }, { status: 500 });
```

Node.js file system errors include the full absolute path in `message` (e.g., `ENOENT: no such file or directory, open '/home/user/secret/file.txt'`). This reveals the server's directory structure to unauthenticated callers.

---

#### MED-03 — No Request Size Limits on File Write Endpoint

**Severity:** Medium
**File:** `web/app/api/files/write/route.ts`

The write endpoint reads the entire request body without enforcing a size cap:

```typescript
const body = await req.json();
await fs.writeFile(resolvedPath, content);
```

**Impact:** An attacker can send a multi-gigabyte payload, filling the server's disk or exhausting memory during JSON parsing.

---

### 13.4 Infrastructure Issues

---

#### INFRA-01 — No Persistent Database — Everything In-Memory or localStorage

**Severity:** High
**Files:** `web/lib/share-store.ts`, `web/lib/store.ts`, all API routes

The entire web application is stateless at the server level:

- Shares: in-process `Map` (lost on restart)
- Conversations: browser `localStorage` only (no server-side persistence)
- Settings: browser `localStorage`
- User data: no concept of users at all

The code itself acknowledges this — comments in `share-store.ts` say "replace with a database" and in the conversations API say "conversations are not persisted on the backend." This is a prototype-grade architecture that has not been upgraded for production.

**Impact:** Zero horizontal scalability. Cannot run more than one web server instance. All data is lost on deploy or crash. No backup, restore, or disaster recovery possible.

---

#### INFRA-02 — Health Check Endpoint Missing

**Severity:** Medium
**Files:** `docker/docker-compose.yml`, `web/app/`

`docker-compose.yml` configures a health check that calls `http://localhost:3000/health`, but no `/health` route exists anywhere in `web/app/api/`. The curl command will return a 404, which `curl -f` treats as failure.

**Impact:** Docker (and Kubernetes if deployed there) will continuously consider the container unhealthy, triggering restart loops. Container orchestration cannot reliably manage the service.

---

#### INFRA-03 — Hardcoded Localhost URLs

**Severity:** Medium
**Files:** `web/app/api/chat/route.ts`, `web/lib/api/client.ts`

Backend URLs fall back to localhost when environment variables are absent:

```typescript
const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
```

If `API_URL` is not set in production, requests silently fall through to localhost (which will fail in a deployed container), with no startup-time validation or clear error.

**Impact:** Silent misconfiguration — the application starts successfully but all API calls fail at runtime with cryptic connection-refused errors.

---

#### INFRA-04 — Docker Image Runs as Non-Hardened Configuration

**Severity:** Low-Medium
**File:** `Dockerfile`

While the Dockerfile does create and switch to a non-root `claude` user (good), it:

- Does not use a distroless or minimal base image (larger attack surface)
- Mounts the host `~/.claude/` directory directly into the container, giving the container access to the user's local Claude config, memory, and credentials
- Does not set read-only root filesystem
- No seccomp or AppArmor profile specified

---

#### INFRA-05 — No Environment Variable Validation at Startup

**Severity:** Medium
**Files:** All API routes and services

Required environment variables (`ANTHROPIC_API_KEY`, `API_URL`, `MCP_API_KEY`) are read inline at request time with no startup validation. The application boots successfully even if critical variables are missing, and only fails when a request is made.

**Impact:** Deployment errors surface in production under load rather than at boot time, making them harder to detect and diagnose.

---

### 13.5 Code Quality Issues

---

#### CODE-01 — 110+ Unsafe Type Assertions (`as any`, `@ts-ignore`)

**Severity:** Medium
**Files:** Distributed across `src/` — highest concentration in protobuf/generated files and tool implementations

TypeScript's type system is bypassed in over 110 locations. While some are in generated code where this is unavoidable, many are in hand-written tool logic:

```typescript
// Examples found:
as unknown as WebSocketLike          // src/upstreamproxy/relay.ts
as unknown as MaybeDefault<SharpFunction>  // src/tools/FileReadTool/imageProcessor.ts
{} as any                            // multiple generated proto files
```

**Impact:** Runtime type errors that the compiler would otherwise catch. Unsafe casts can mask API contract violations — especially dangerous when handling LLM responses or file system data.

---

#### CODE-02 — Untracked Timers and Event Listeners (228+ instances)

**Severity:** Medium
**Files:** `src/server/web/terminal.ts`, multiple component and hook files

228 `setInterval`/`setTimeout` calls are spread across the source. A substantial subset add event listeners to `document`, `window`, or WebSocket instances without clearly paired cleanup. In React component lifecycle terms, any listener added in a `useEffect` without a corresponding return cleanup function is a memory leak.

**Impact:** In long-running interactive sessions (the primary use case of the REPL), leaked listeners and timers accumulate over time, consuming memory and potentially causing ghost event handlers that trigger stale state updates.

---

#### CODE-03 — Global Mutable AppState Without Concurrency Safeguards

**Severity:** Medium
**File:** `src/state/AppState.ts`

A single global mutable object is shared by all tools, components, and hooks. JavaScript is single-threaded, so classic race conditions are not possible, but:

- Multiple async tool executions running concurrently (AgentTool spawning sub-agents) can interleave writes to the same state fields
- `onChangeAppState` observers are triggered synchronously on every mutation — a slow observer blocks all subsequent mutations
- There is no optimistic update / rollback mechanism if a tool fails after partially mutating state

**Impact:** In multi-agent scenarios, concurrent state mutations can produce inconsistent snapshots. A crashing observer can leave AppState in a partially updated condition.

---

#### CODE-04 — Tool Execution Loop Has No Timeout or Iteration Cap

**Severity:** Medium
**File:** `src/QueryEngine.ts`

The tool-call loop continues until the LLM returns `stop_reason = "end_turn"`. There is no maximum number of iterations and no wall-clock timeout enforced at the loop level (individual tools may have their own timeouts, but the orchestration layer does not).

**Impact:** A misbehaving or adversarially crafted model response can keep the loop running indefinitely — consuming API tokens, blocking the terminal, and never completing. This is particularly concerning with agentic/coordinator mode where the loop can span many tool calls.

---

#### CODE-05 — Conversation History Grows Without Bound in Long Sessions

**Severity:** Medium
**File:** `src/QueryEngine.ts`, `src/services/compact/`

While compaction exists, it is triggered reactively when context nears the limit. The compaction service itself consumes tokens (a separate API call to summarize history). In very long sessions:

- The trigger threshold may be set conservatively, leading to repeated compaction calls
- Each compaction loses fidelity (it is a lossy summary)
- If compaction fails (API error, rate limit), the session may become unrecoverable

**Impact:** Unpredictable session behavior and cost spikes in long autonomous agent runs.

---

#### CODE-06 — No Structured Logging or Request Tracing

**Severity:** Low-Medium
**Files:** All API routes and service layers

Errors are caught and either silently swallowed or returned verbatim to the client. There is no:

- Structured log output (JSON logs for log aggregators)
- Request ID propagation (no correlation between frontend errors and backend logs)
- Severity-based log levels
- Alerting hooks for critical errors

**Impact:** Production debugging is extremely difficult. When something fails, there is no trail to follow.

---

#### CODE-07 — Zustand Store Grows Without Pruning (Web)

**Severity:** Low
**File:** `web/lib/store.ts`

The Zustand store persists all conversations to `localStorage`. There is no maximum conversation count, no archival, and no pruning policy. `localStorage` is limited to approximately 5–10 MB across browsers.

**Impact:** After enough conversations, the store write fails silently (localStorage quota exceeded), and new conversations are not saved. The user loses data with no warning.

---

## 14. Recommended Improvements

The following improvements are prioritized by impact and feasibility. They are organized into four tracks: Security Hardening, Architecture & Scalability, Developer Experience, and Operational Readiness.

---

### 14.1 Security Hardening (Do First)

**SH-01 — Hash Share Passwords With Argon2 or bcrypt**

Replace the plaintext equality check with a proper password hashing library. Argon2id is the current OWASP recommendation. Use `crypto.timingSafeEqual()` for all secret comparisons to eliminate timing oracle attacks. Store only the hash; never store the raw password anywhere.

**SH-02 — Enforce Path Jailing in File API Endpoints**

Add a `resolveAndJail(basePath, userPath)` utility that:

1. Resolves the user-supplied path to an absolute path
2. Verifies the result starts with the allowed base directory
3. Rejects the request with 400 if not

Apply this to both `files/read` and `files/write`. The allowed base should default to the project workspace root and be configurable via environment variable. Consider also implementing a file extension allowlist for writes.

**SH-03 — Add Authentication Middleware**

Introduce a Next.js middleware (or route-level guard) that validates a session token or API key before any request reaches a route handler. For single-user local deployments, a simple shared secret in an HTTP-only cookie is sufficient. For multi-user deployments, integrate with an identity provider via OAuth2/OIDC. Reject unauthenticated requests with 401 before any business logic executes.

**SH-04 — Implement Rate Limiting**

Add an in-process token-bucket or sliding-window rate limiter applied per IP and per endpoint. For the chat endpoint, also enforce per-session request budgets. Libraries like `@upstash/ratelimit` (with Redis) or a simple in-memory implementation for single-instance deployments are both viable. Enforce hard limits: `POST /api/chat` — 20 req/min per IP; file endpoints — 100 req/min per IP.

**SH-05 — Verify JWT Signatures in Bridge Layer**

Replace `decodeJwtPayload` (which skips signature verification) with a proper JWT verification step using the `jose` library or Node.js built-in `crypto.verify`. The signing key should be generated at bridge startup and stored securely. Tokens should have short expiry (15 min) with a refresh mechanism that verifies the old token before issuing a new one.

**SH-06 — Add Content Security Policy Headers**

Configure CSP headers in `next.config.js` (or a middleware file) with a strict policy:

- `default-src 'self'`
- `script-src 'self'` (no `unsafe-inline`, no `unsafe-eval`)
- `style-src 'self' 'unsafe-inline'` (Tailwind requires inline styles — consider extracting)
- `connect-src 'self'` (restrict which origins JS can fetch from)
- Use nonces for any required inline scripts

**SH-07 — Enforce CORS**

Add a `cors()` middleware to all API routes that reads the `ALLOWED_ORIGINS` environment variable and rejects cross-origin requests from unlisted origins. Default to `http://localhost:3000` when not set. Return appropriate `Access-Control-Allow-Origin` headers and ensure preflight OPTIONS requests are handled.

**SH-08 — Add Request Body Size Limits**

Use Next.js's built-in body size configuration (`api.bodyParser.sizeLimit`) or a middleware wrapper to cap request bodies. Suggested limits: chat — 64 KB, file write — 10 MB, all others — 1 MB. Return 413 for oversized requests before any processing.

---

### 14.2 Architecture & Scalability

**AS-01 — Replace In-Memory Stores With a Persistent Database**

The in-memory `Map` for shares and the localStorage approach for conversations are not viable beyond a single user on a single machine. Introduce a proper storage layer:

- **SQLite** for single-user/local deployments (zero infrastructure, file-backed, ACID)
- **PostgreSQL** for multi-user or team deployments
- **Redis** for ephemeral session state and rate limiting

Define a minimal schema: `conversations(id, title, created_at, updated_at, model)`, `messages(id, conversation_id, role, content, created_at)`, `shares(id, conversation_id, visibility, password_hash, expires_at, created_at)`. Use an ORM like Drizzle (TypeScript-native, lightweight) or Prisma.

**AS-02 — Add a Health Check Endpoint**

Create `web/app/api/health/route.ts` that returns a JSON response with HTTP 200 when the service is ready:

```json
{ "status": "ok", "version": "x.y.z", "timestamp": "2026-04-01T00:00:00Z" }
```

Optionally check that the Anthropic API key is configured and that any database connection is healthy. This makes the Docker health check work correctly and enables proper liveness/readiness probes in Kubernetes.

**AS-03 — Validate Required Environment Variables at Startup**

Add a startup validation step (run before the server begins accepting connections) that checks all required environment variables are present and well-formed. Exit with a clear error message and non-zero code if any are missing:

```
[FATAL] Missing required environment variable: ANTHROPIC_API_KEY
[FATAL] Set this variable before starting the server.
```

This surfaces misconfigurations immediately rather than at first request under load.

**AS-04 — Implement Active Share Expiry Cleanup**

Add a background job (setInterval or a dedicated worker) that periodically scans the share store and removes expired entries. Run every 5 minutes. When the store is migrated to a database (AS-01), use a scheduled SQL delete: `DELETE FROM shares WHERE expires_at < NOW()`.

**AS-05 — Cap Tool Execution Loop With Iteration Limit and Timeout**

In `QueryEngine.ts`, introduce two guards on the tool-call loop:

1. **Iteration limit**: Stop after N tool calls (configurable, default 50) and return a message to the user explaining that the limit was reached
2. **Wall-clock timeout**: Stop after T seconds (configurable, default 300s) regardless of iteration count

These prevent runaway agent loops from consuming unbounded API budget and blocking the terminal indefinitely.

**AS-06 — Add Conversation History Pruning in Web Store**

In `web/lib/store.ts`, enforce a maximum conversation count (e.g., 500). When the limit is exceeded, archive (mark as archived rather than delete) the oldest unpinned conversations. Add a separate "archive" view in the sidebar UI. This prevents localStorage quota exhaustion and keeps the active list manageable.

---

### 14.3 Code Quality

**CQ-01 — Replace `as any` Casts With Proper Types**

Audit the 110+ type assertion sites and address each:

- Generated protobuf files: regenerate with proper TypeScript output or add narrow type guards at the boundary
- Tool implementations: define explicit intermediate types rather than casting
- Use `unknown` instead of `any` where the type is genuinely unknown, then narrow with `typeof`/`instanceof` guards

Enforce `@typescript-eslint/no-explicit-any` (or Biome equivalent) as a CI check to prevent new instances.

**CQ-02 — Audit and Fix Timer/Listener Lifecycle**

For each `setInterval`/`setTimeout` and `addEventListener` in React components and hooks:

- Confirm it has a corresponding `clearInterval`/`clearTimeout`/`removeEventListener` in the cleanup path
- For hooks, the cleanup must be the return value of `useEffect`
- For non-React code (service classes), ensure `destroy()` or `dispose()` methods clear all timers and listeners

Add an integration test that mounts and unmounts the REPL component multiple times and asserts no listener leak via a custom listener count tracker.

**CQ-03 — Add Structured Logging**

Introduce a logging abstraction (e.g., `pino` or a simple wrapper around `console`) that:

- Outputs JSON in production, human-readable in development
- Attaches a `requestId` to every log line within a request context
- Has severity levels (`debug`, `info`, `warn`, `error`)
- Never logs raw error messages directly to the client (sanitize before returning)

**CQ-04 — Add Input Validation to All API Routes**

Use Zod to define and parse request bodies at the top of every route handler before any business logic:

```typescript
const schema = z.object({ path: z.string().min(1), content: z.string() });
const parsed = schema.safeParse(await req.json());
if (!parsed.success)
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
```

This eliminates a class of runtime errors and provides clear, actionable error messages to callers.

**CQ-05 — Introduce AppState Mutation Guards for Multi-Agent Scenarios**

For the concurrent mutation problem in `AppState.ts`, introduce a simple per-agent namespace:

- Each sub-agent writes to `state.agents[agentId]` rather than top-level fields
- Parent agent merges results explicitly rather than having agents mutate shared state
- Add `Object.freeze()` on read-only slices passed to tools to catch accidental mutations in development

**CQ-06 — Deduplicate Repeated API Client Logic**

`web/lib/api/client.ts` and `web/lib/api.ts` appear to duplicate retry and fetch logic. Consolidate into a single `createApiClient()` factory with shared retry, abort, and error classification. Remove the duplicate file.

---

### 14.4 Operational Readiness

**OR-01 — Add OpenTelemetry Tracing to Web API Routes**

The CLI already integrates OpenTelemetry (`src/services/analytics/`). Extend this to the Next.js API routes so that:

- Each request gets a trace ID
- Tool execution time is recorded as a span
- LLM API latency is instrumented
- Errors are attached to spans with full stack traces

Export to an OTLP-compatible backend (Jaeger for local dev, Honeycomb/Grafana Cloud for production).

**OR-02 — Implement Graceful Shutdown**

Add `SIGTERM`/`SIGINT` handlers that:

1. Stop accepting new requests (mark the server as draining)
2. Wait for in-flight requests to complete (up to a configurable drain timeout, e.g., 30s)
3. Close database connections and flush telemetry
4. Exit with code 0

Without this, a rolling deploy or container restart mid-LLM-stream drops the client connection and potentially leaves the session in an inconsistent state.

**OR-03 — Add Dependency Vulnerability Scanning to CI**

Run `bun audit` (or `npm audit` equivalent) in CI on every PR and fail the build on high/critical findings. Pin direct dependencies to exact versions (`"express": "4.19.2"` not `"^4.19.2"`) so lockfile updates are explicit and reviewable. Consider adding Dependabot or Renovate for automated PRs on dependency updates.

**OR-04 — Document Environment Variables Exhaustively**

Create a `.env.example` for the web application (not just the CLI) that lists every supported environment variable with:

- Its purpose
- Whether it is required or optional
- Its default value if optional
- Example values

Add a startup check that warns (but does not fail) if optional variables with known-good defaults are not explicitly set, so operators know they are running with defaults.

**OR-05 — Add End-to-End Tests for Critical Paths**

Add at minimum:

- A test that verifies a chat message round-trip (web UI → API → Claude → response rendered)
- A test that verifies file read and write with valid and invalid paths
- A test that verifies share creation, retrieval, and password protection
- A test that verifies the health endpoint returns 200

Use Playwright for browser-level E2E tests. Run these in CI against a locally started server with a test API key.

---

### 14.5 Improvement Priority Matrix

| ID    | Improvement                | Effort | Impact     | Priority |
| ----- | -------------------------- | ------ | ---------- | -------- |
| SH-02 | Path jailing in file API   | Low    | Critical   | **P0**   |
| SH-03 | API authentication         | Medium | Critical   | **P0**   |
| SH-01 | Hash share passwords       | Low    | Critical   | **P0**   |
| SH-04 | Rate limiting              | Low    | High       | **P1**   |
| AS-02 | Health check endpoint      | Low    | High       | **P1**   |
| AS-03 | Env var startup validation | Low    | High       | **P1**   |
| SH-05 | JWT signature verification | Medium | High       | **P1**   |
| SH-06 | Content Security Policy    | Low    | High       | **P1**   |
| SH-07 | CORS enforcement           | Low    | High       | **P1**   |
| AS-01 | Persistent database        | High   | Critical   | **P1**   |
| AS-05 | Tool loop timeout/cap      | Low    | High       | **P1**   |
| CQ-04 | Input validation (Zod)     | Medium | High       | **P2**   |
| CQ-03 | Structured logging         | Medium | Medium     | **P2**   |
| SH-08 | Request size limits        | Low    | Medium     | **P2**   |
| OR-02 | Graceful shutdown          | Medium | Medium     | **P2**   |
| AS-04 | Active expiry cleanup      | Low    | Medium     | **P2**   |
| CQ-01 | Remove `as any` casts      | High   | Medium     | **P3**   |
| CQ-02 | Fix timer/listener leaks   | High   | Medium     | **P3**   |
| OR-01 | OTel tracing on web routes | Medium | Medium     | **P3**   |
| CQ-05 | AppState mutation guards   | Medium | Low-Medium | **P3**   |
| OR-03 | Dependency scanning CI     | Low    | Medium     | **P3**   |
| AS-06 | Conversation pruning       | Medium | Low        | **P4**   |
| OR-04 | Document env vars          | Low    | Low        | **P4**   |
| OR-05 | E2E test suite             | High   | High       | **P4**   |
| CQ-06 | Deduplicate API client     | Low    | Low        | **P4**   |

---

_Security audit and improvement recommendations appended April 1, 2026, based on static source analysis across all directories. No files other than this documentation were modified._

---

## 13. Local Setup Guide

This guide covers getting the codebase running locally for exploration and MCP server development. The `src/` directory is the original leaked source and is not intended to be executed directly — it requires Anthropic's internal build pipeline and API credentials. However, the **MCP server** and **web application** can be run locally.

### Prerequisites

| Requirement                   | Version | Purpose                                  |
| ----------------------------- | ------- | ---------------------------------------- |
| [Bun](https://bun.sh)         | ≥ 1.1.0 | Runtime for CLI source and build scripts |
| [Node.js](https://nodejs.org) | ≥ 18    | MCP server development                   |
| Git                           | Any     | Cloning the repo                         |
| `ANTHROPIC_API_KEY`           | —       | Required for web app and any API calls   |

### 1. Clone the Repository

```bash
git clone https://github.com/nirholas/claude-code.git
cd claude-code
```

### 2. Install Dependencies

```bash
# Root dependencies (includes CLI source deps)
bun install

# MCP server dependencies (Node.js)
cd mcp-server && npm install && cd ..
```

### 3. Running the MCP Server (Recommended Starting Point)

The MCP server lets any MCP-compatible client explore the source code interactively.

```bash
# Development mode (no build step, uses tsx)
cd mcp-server
npm run dev

# OR build and run compiled output
npm run build
node dist/index.js
```

Register with Claude Code (from repo root):

```bash
claude mcp add claude-code-explorer -- node $(pwd)/mcp-server/dist/index.js
```

### 4. Running the Web Application

The web app is a Next.js frontend that connects to a local Claude Code server process.

```bash
# Build the web bundle
bun run build:web

# OR watch mode for development
bun run build:web:watch
```

Set required environment variables:

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # Required
export AUTH_TOKEN=your-secret         # Optional — enables basic auth
export MAX_SESSIONS=5                 # Optional — max concurrent PTY sessions
export PORT=3000                      # Optional — defaults to 3000
```

### 5. Running via Docker (Web App)

The easiest way to run the full web application locally:

```bash
# Copy and fill in your API key
cp .env.example .env   # or create .env manually

# Start with Docker Compose
docker compose -f docker/docker-compose.yml up
```

The `docker-compose.yml` mounts a `claude-data` volume for persistent config/session data across restarts.

Access at `http://localhost:3000`.

### 6. Linting and Type Checking the Source

```bash
# Lint the src/ directory with Biome
bun run lint

# Fix lint issues automatically
bun run lint:fix

# TypeScript type check (no emit)
bun run typecheck

# Run both together
bun run check
```

### 7. Build Scripts

| Command                   | Description                        |
| ------------------------- | ---------------------------------- |
| `bun run build`           | Build CLI bundle (development)     |
| `bun run build:watch`     | CLI bundle in watch mode           |
| `bun run build:prod`      | CLI bundle minified for production |
| `bun run build:web`       | Build web app bundle               |
| `bun run build:web:watch` | Web app bundle in watch mode       |
| `bun run build:web:prod`  | Web app bundle minified            |

### Notes

- The `src/` directory references `bun:bundle` (a Bun internal API) for feature flags — this means the CLI cannot be bundled with standard Node.js tooling.
- The `BUDDY` feature flag and others are resolved at build time and tree-shaken from the output bundle.
- The `backup` branch contains the original unmodified leaked source if you need a clean reference point.

---

## 14. The /buddy Command — Companion System

`/buddy` is a hidden companion/pet feature introduced by Anthropic and gated behind the `BUDDY` feature flag. It ships a virtual creature ("companion") that lives beside the user's input box, reacts to what is typed, and occasionally comments in a speech bubble.

### What It Does

- **Hatches a companion** unique to the user — species, rarity, eyes, hat, and stats are derived deterministically from a hash of the user's account UUID. No two accounts get the same companion from the same seed.
- **Displays a sprite** in the terminal UI next to the prompt input, animating through idle, active, and reaction states.
- **Speaks in speech bubbles** — the companion occasionally comments. When the user addresses the companion by name, it responds in one line via the bubble (Claude itself stays out of the way).
- **Has persistent memory** — the companion's generated "soul" (name + personality, produced by Claude on first hatch) is stored in global config and survives restarts.

### Source Location

| File                                 | Purpose                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/buddy/companion.ts`             | Deterministic roll logic — hashes user ID into species/rarity/stats using a seeded PRNG (Mulberry32) |
| `src/buddy/types.ts`                 | All type definitions — `Species`, `Rarity`, `Hat`, `Eye`, `StatName`, `Companion`, `StoredCompanion` |
| `src/buddy/CompanionSprite.tsx`      | React/Ink component that renders the sprite in the terminal                                          |
| `src/buddy/useBuddyNotification.tsx` | Hook that shows the teaser notification on startup                                                   |
| `src/buddy/prompt.ts`                | Injects companion context into the system prompt so Claude knows a companion exists                  |
| `src/commands/buddy/`                | The `/buddy` slash command implementation (not present in this leaked source tree)                   |

### Companion Properties

**Species (18 total):** duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

**Rarities (with roll weights):**

| Rarity    | Weight | Probability |
| --------- | ------ | ----------- |
| Common    | 60     | ~60%        |
| Uncommon  | 25     | ~25%        |
| Rare      | 10     | ~10%        |
| Epic      | 4      | ~4%         |
| Legendary | 1      | ~1%         |

**Stats:** `DEBUGGING`, `PATIENCE`, `CHAOS`, `WISDOM`, `SNARK` — each scored 1–100, with one "peak" stat boosted and one "dump" stat lowered based on rarity tier.

**Hats:** none, crown, tophat, propeller, halo, wizard, beanie, tinyduck _(commons always get no hat)_

**Shiny:** 1% chance — a rare cosmetic variant.

### Roll Determinism

The companion is fully deterministic from `hash(userId + 'friend-2026-401')`. Bones (species, rarity, stats, eye, hat, shiny) are **re-derived on every load** from that hash — they are never stored. Only the "soul" (name + personality generated by Claude on first hatch) is persisted in config. This means:

- Users cannot fake a rare companion by editing their config
- Species list changes don't break existing companions (bones are re-rolled from the same seed)

### Teaser Window

Between **April 1–7, 2026**, users without a companion see a rainbow `/buddy` notification flash on startup for 15 seconds. The underlying `/buddy` command remains live indefinitely after that date. The teaser is suppressed for internal (Anthropic) builds.

### Muting

The companion can be silenced by setting `companionMuted: true` in global config. The sprite is hidden and no speech bubbles appear.

---

## 15. Known Issues & Bug Fixes — Token Burn Optimizations

> **Analysis Date:** April 2, 2026
> **Scope:** Identified patterns causing abnormally high token consumption per session

The following issues were identified via deep codebase analysis. They are listed in priority order (highest token waste first), each with a root cause, location, and recommended fix.

---

### P0 — Critical (50K–300K tokens wasted per occurrence)

---

#### [BUG-T01] Query Loop Retries Resend Full Context Without Deduplication

**File:** `src/query.ts:307`
**Impact:** 50–300K tokens per retry

**Root Cause:**
The main `while (true)` query loop resends the complete message history + system prompt + tool schemas on every iteration. Retries are triggered by prompt-too-long errors, max-output-token limits, media errors, and reactive compaction failures. There is no mechanism to avoid resending unchanged portions of the context.

**Fix:**

- Track whether context has changed between iterations. If unchanged, avoid a full re-serialization.
- Add a fast early-exit when the context hasn't grown (e.g. error-retry with same messages).
- Introduce a `contextHash` that is compared before each API submission; skip the call if hash is identical to the previous attempt.

---

#### [BUG-T02] Autocompact Cascade — Summarization Uses Full Context Then Loops

**File:** `src/services/compact/autoCompact.ts:72–150`
**Impact:** 100–200K tokens per compaction event; up to 3× with `MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES`

**Root Cause:**
When context reaches ~187K tokens, autocompact fires a summarization API call using the full bloated context. The resulting summary becomes the new baseline, but the loop can trigger again immediately if the next turn is also large. Up to 3 consecutive autocompact failures are permitted before giving up.

**Fix:**

- Trigger compaction earlier (e.g. at 75% of context window) to avoid submitting a 187K-token request just to summarize it.
- After compaction, don't immediately re-enter the query loop — pause and verify the compacted context fits within the threshold before proceeding.
- Limit cascading by enforcing a minimum token reduction ratio (e.g. compact must reduce by ≥30% or don't proceed).

---

#### [BUG-T03] Streaming Fallback Sends Full Context Twice

**File:** `src/services/api/claude.ts:1873–1944`, `src/query.ts:678–740`
**Impact:** 50–200K tokens per fallback event

**Root Cause:**
On 529 errors or stream failures, the streaming attempt is abandoned and a non-streaming fallback is initiated using the full message array from scratch. No partial results from the failed stream are reused.

**Fix:**

- Implement resume-from-checkpoint: capture streamed tokens before failure and pass them as context to the retry, reducing re-sent tokens.
- At minimum, back off and retry the same streaming request rather than immediately falling back to non-streaming.
- Add deduplication: if the same message array hash is about to be sent within the same turn, skip the retry or delay it.

---

#### [BUG-T04] Deferred Tools List Change Busts Prompt Cache

**File:** `src/services/api/claude.ts:1327–1345`
**Impact:** 50–200K tokens per cache bust (prompt cache invalidated, full context resent)

**Root Cause:**
When the deferred tool list changes, a new user message containing the full tool list is prepended to the message array. This invalidates the prompt cache for the entire conversation, forcing the API to process the full context again from scratch on the next request.

**Fix:**

- Batch deferred tool list changes; only update the prepended message at turn boundaries, not mid-turn.
- Use a stable tool list ordering (sort alphabetically) to avoid spurious diffs causing unnecessary cache invalidations.
- If the tool list hasn't meaningfully changed, skip reinserting the message.

---

### P1 — High (15K–50K tokens wasted per request)

---

#### [BUG-T05] Tool Schemas Regenerated on Every API Call — No Per-Turn Caching

**File:** `src/utils/api.ts:119–150`
**Impact:** 15–25K tokens per request (50+ tools × ~300–500 tokens each)

**Root Cause:**
`toolToAPISchema()` is called for every tool on every API request. The resulting JSON schema objects are not cached between iterations of the query loop. MCP tool schemas and agent schemas are also dynamically regenerated on each call.

**Fix:**

- Memoize `toolToAPISchema()` results keyed by tool identity/version. Invalidate only when a tool definition changes.
- Cache the fully assembled `tools` array at the start of each user turn and reuse it across retry iterations within the same turn.
- Use Anthropic's prompt caching (`cache_control: { type: "ephemeral" }`) on the tool list block to avoid re-billing these tokens at full input rate.

---

#### [BUG-T06] Unbounded Tool Result Growth — No Output Truncation

**File:** `src/query.ts:1250+`
**Impact:** 20–100K tokens per tool call, compounding across multi-tool turns

**Root Cause:**
Tool outputs (file reads, search results, shell output, etc.) are appended to the message array without a size ceiling. Once a large tool result (e.g. reading a 50K-token file) is added, the full inflated context is sent on every subsequent API call for the remainder of the session.

**Fix:**

- Enforce a per-tool-result token budget (e.g. max 10K tokens per result). Truncate with a clear `[...truncated, N tokens omitted...]` marker.
- For file reads specifically, only include relevant line ranges rather than full file contents when the intent is analysis (not verbatim output).
- Add a sliding window eviction policy: drop the oldest tool results from context once the total context exceeds a threshold, keeping only recent results.

---

#### [BUG-T07] User Context (`<system-reminder>`) Prepended on Every Loop Iteration

**File:** `src/utils/api.ts:449–474`
**Impact:** 2–5K tokens per iteration; compounds on retry-heavy turns

**Root Cause:**
`prependUserContext()` injects a meta user message containing git status, current directory, CLAUDE.md contents, and environment info before every API call inside the query loop. This message is not cached or deduplicated across iterations.

**Fix:**

- Inject the user context message once per user turn, not once per query loop iteration.
- Cache the serialized context block; only regenerate if underlying state has actually changed (e.g. git status changed between iterations — which is rare).
- Mark the message with a stable ID so normalization can detect and deduplicate it on retries.

---

#### [BUG-T08] Memory Files Re-Fetched and Re-Attached on Every Iteration

**File:** `src/query.ts:301–304`, `src/utils/attachments.ts:2937–2970`
**Impact:** 10–50K tokens per iteration depending on memory file sizes

**Root Cause:**
`startRelevantMemoryPrefetch()` rescans and re-reads memory files on every iteration of the query loop. There is no "already loaded this session" tracking, so the same files may be attached repeatedly — particularly in tool-heavy turns that loop many times.

**Fix:**

- Cache memory file reads at the session level with a TTL or change-detection mechanism (e.g. file mtime).
- Only re-read memory files when the underlying file has changed since the last read.
- Deduplicate attachment messages: if an attachment with the same content hash already exists in the message array, don't add it again.

---

### P2 — Medium (5K–20K tokens wasted per request)

---

#### [BUG-T09] System Prompt Rebuilt Twice Per Query

**File:** `src/QueryEngine.ts:292` (first build), `src/QueryEngine.ts:492` (second build)
**Impact:** 10–20K tokens of redundant processing per user query

**Root Cause:**
The system prompt is assembled twice per incoming user query: once before slash command processing and once after. Both builds fetch system context, user context, tool schemas, and memory mechanics. The result of the first build is discarded.

**Fix:**

- Consolidate into a single build that occurs after slash command processing is complete.
- If a pre-build is required for slash command introspection, cache the result and pass it directly to the second build stage rather than rebuilding from scratch.

---

#### [BUG-T10] Unbounded Agent/Subagent Query Depth — No Context Sharing

**File:** `src/query.ts:346–362`, `src/tools/AgentTool/AgentTool.tsx:200+`
**Impact:** Exponential token growth at depth ≥4; full system prompt + tool schemas duplicated per agent

**Root Cause:**
Spawned agents each receive a full independent system prompt and tool schema set. Query depth (`toolUseContext.queryTracking.depth + 1`) increments without a maximum, and there is no context sharing between parent and child agents.

**Fix:**

- Enforce a max agent depth (e.g. 5) with a clear error returned to the parent rather than spawning indefinitely.
- Strip non-essential tools from child agent schemas when the parent's intent is narrow (pass only relevant tool subset).
- Consider a shared, read-only context block passed from parent to child to avoid re-serializing common state.

---

#### [BUG-T11] Message Normalization Merges Adjacent Assistant Messages — Can Inflate Context

**File:** `src/services/api/claude.ts:1266`
**Impact:** 5–10K tokens per normalization pass on long sessions

**Root Cause:**
`normalizeMessagesForAPI()` merges adjacent assistant messages, repairs tool result pairings, strips advisor blocks, and removes excess media. While these are valid operations, merging assistant messages can produce larger single messages that are harder for the cache to hit, and the full O(n) traversal is repeated on every API call.

**Fix:**

- Cache the normalized message array and invalidate only the suffix affected by new messages (not the entire array).
- Avoid merging assistant messages when they are separated by cache boundary markers.
- Run normalization incrementally: only re-normalize new messages appended since the last call.

---

### P3 — Low (informational / future optimization)

---

#### [BUG-T12] No Incremental Context Window Tracking — Full Context Sent Even Near Limit

**File:** `src/utils/tokens.ts:226–261`
**Impact:** Missed opportunity to prune context before hitting autocompact threshold

**Root Cause:**
`tokenCountWithEstimation()` estimates token usage for alerting purposes only. There is no proactive pruning of older messages or tool results when the context is approaching the limit. The only resolution mechanism is full autocompact.

**Fix:**

- Implement a graceful degradation policy: when context exceeds 60% of the window, begin dropping oldest tool results; at 80%, drop oldest user/assistant turns; only trigger full compaction at 90%+.
- Surface token budget warnings in the UI earlier so users can manually `/compact` before hitting the threshold.

---

#### [BUG-T13] No Prompt Caching Applied to Static System Prompt + Tool Schemas

**File:** `src/services/api/claude.ts` (API request assembly)
**Impact:** Full input token billing on every request for static content

**Root Cause:**
The static portions of the system prompt and tool schemas are re-billed at full input token rates on every request. Anthropic's API supports `cache_control: { type: "ephemeral" }` to mark stable content for caching at a discounted rate (cache reads cost ~10% of full input price).

**Fix:**

- Apply `cache_control` to the system prompt block (changes rarely).
- Apply `cache_control` to the tool schema block (changes only when tools are added/removed).
- Verify cache hit rates via API response `cache_read_input_tokens` field and tune cache boundaries accordingly.

---

### Summary

| ID  | Priority | File                                            | Est. Waste              | Fix Complexity |
| --- | -------- | ----------------------------------------------- | ----------------------- | -------------- |
| T01 | P0       | `src/query.ts:307`                              | 50–300K/retry           | Medium         |
| T02 | P0       | `src/services/compact/autoCompact.ts:72`        | 100–200K/compact        | Medium         |
| T03 | P0       | `src/services/api/claude.ts:1873`               | 50–200K/fallback        | High           |
| T04 | P0       | `src/services/api/claude.ts:1327`               | 50–200K/bust            | Low            |
| T05 | P1       | `src/utils/api.ts:119`                          | 15–25K/request          | Low            |
| T06 | P1       | `src/query.ts:1250`                             | 20–100K/tool            | Medium         |
| T07 | P1       | `src/utils/api.ts:449`                          | 2–5K/iteration          | Low            |
| T08 | P1       | `src/query.ts:301`                              | 10–50K/iteration        | Low            |
| T09 | P2       | `src/QueryEngine.ts:292`                        | 10–20K/query            | Low            |
| T10 | P2       | `src/query.ts:346`                              | Exponential at depth ≥4 | Medium         |
| T11 | P2       | `src/services/api/claude.ts:1266`               | 5–10K/request           | Medium         |
| T12 | P3       | `src/utils/tokens.ts:226`                       | Proactive savings       | High           |
| T13 | P3       | `src/services/api/claude.ts` (request assembly) | ~10–15K/request         | Low            |

**Highest-leverage quick wins (low complexity, high impact):**

1. **T04** — Fix deferred tools cache busting (stable sort + turn-boundary updates)
2. **T05** — Cache tool schemas per turn + apply `cache_control`
3. **T07** — Inject user context once per turn, not per iteration
4. **T13** — Apply prompt caching to system prompt + tool schema blocks

---

## 16. Known Issues & Bug Fixes — General Bugs

> **Analysis Date:** April 2, 2026
> **Scope:** Non-token-burn bugs identified via deep code review — security, correctness, race conditions, error handling, and resource management

These bugs are independent of token consumption and span the web API, file watcher, MCP transport layer, and process management utilities. Listed in priority order.

---

### P0 — Critical (Exploitable Security Vulnerabilities)

---

#### [BUG-G01] Path Traversal in File Write API — Arbitrary File Overwrite

**File:** `web/app/api/files/write/route.ts:21`
**Impact:** Attacker can write arbitrary content to any file on the server filesystem

**Root Cause:**
The endpoint accepts a `path` parameter from the POST body and calls `path.resolve(filePath)` without validating that the resolved path stays within an allowed directory. `path.resolve()` handles `../` sequences and absolute paths, meaning a caller can supply `../../etc/cron.d/backdoor` or `/home/user/.ssh/authorized_keys` and the file will be written.

```typescript
const resolvedPath = path.resolve(filePath); // ← no bounds check
await fs.writeFile(resolvedPath, content, 'utf-8');
```

**Potential Fix:**
Define an allowlist of base directories (e.g. the project root or a designated workspace directory). After resolving, assert the path starts with one of those prefixes before proceeding:

```typescript
const allowedBase = process.env.WORKSPACE_ROOT ?? process.cwd();
if (!resolvedPath.startsWith(allowedBase + path.sep)) {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
```

---

#### [BUG-G02] Path Traversal in File Read API — Arbitrary File Exfiltration

**File:** `web/app/api/files/read/route.ts:21`
**Impact:** Attacker can read any file on the server — env files, private keys, `/etc/passwd`, source code

**Root Cause:**
Same class of vulnerability as G01. The `path` query parameter is passed directly to `path.resolve()` with no bounds validation before reading. An attacker can retrieve any readable file on the host:

```typescript
const resolvedPath = path.resolve(filePath); // ← no bounds check
const content = await fs.readFile(resolvedPath, 'utf-8');
```

**Potential Fix:**
Apply the same allowlist-and-prefix-check as G01. Additionally, avoid returning raw error messages from `fs.readFile` (line 52–53), as they can reveal internal filesystem structure.

---

### P1 — High (Security & Reliability)

---

#### [BUG-G03] Share Passwords Stored in Plaintext

**File:** `web/lib/share-store.ts:51`, `web/lib/share-store.ts:77`
**Impact:** Passwords for password-protected conversation shares are exposed in server memory and vulnerable to any future logging or memory disclosure

**Root Cause:**
Despite the field being named `passwordHash`, the raw plaintext password is stored directly:

```typescript
// In createShare():
passwordHash: params.password ?? undefined; // ← raw password, not a hash

// In verifySharePassword():
return entry.passwordHash === password; // ← direct string comparison
```

The comment in the code even flags this: `// bcrypt-style hash; plain comparison used here for simplicity`. In any environment with server-side logging, crash dumps, or monitoring (e.g. Sentry), the plaintext password will be captured.

**Potential Fix:**
Hash passwords with `bcrypt` or `crypto.scrypt` on `createShare()` and use a constant-time comparison on verification:

```typescript
import { scryptSync, timingSafeEqual } from 'crypto';
// store: hash = scryptSync(password, salt, 64).toString("hex")
// verify: timingSafeEqual(Buffer.from(stored), Buffer.from(computed))
```

At minimum, use `crypto.createHash("sha256").update(password).digest("hex")` to avoid storing cleartext.

---

#### [BUG-G04] Race Condition — File Watcher Restart Not Awaited

**File:** `src/utils/hooks/fileChangedWatcher.ts:122–131`
**Impact:** Duplicate file-change events fired during watcher restart; event handler callbacks can fire after the watcher has been nullified

**Root Cause:**
In `restartWatching()`, the old watcher is closed with `void watcher.close()` (promise discarded), then `watcher` is immediately set to `null` and a new watcher is started. Since `chokidar.close()` is async and its resolution is not awaited, both the old and the new watcher can be active simultaneously during the gap:

```typescript
function restartWatching(): void {
  if (watcher) {
    void watcher.close(); // ← promise discarded
    watcher = null; // ← set to null before close resolves
  }
  startWatching(paths); // ← new watcher starts immediately
}
```

Any file events queued in the old watcher's internals continue firing against `handleFileEvent`, potentially triggering duplicate hook executions.

**Potential Fix:**
Make `restartWatching()` async and await `watcher.close()` before starting the replacement:

```typescript
async function restartWatching(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  startWatching(resolveWatchPaths());
}
```

---

### P2 — Medium (Error Handling & Resource Safety)

---

#### [BUG-G05] Null `response.body` Passthrough in Chat API — Silent Empty Response

**File:** `web/app/api/chat/route.ts:27`
**Impact:** If the backend returns a response with a null body (e.g. a 204 or certain 5xx responses), the client receives a 200 with an empty body and no error indication

**Root Cause:**
`Response.body` is typed as `ReadableStream | null`. When null, `new NextResponse(null, { headers: ... })` produces a 200 OK with no body — the client sees a successful response but receives nothing to parse:

```typescript
return new NextResponse(response.body, {
  // ← body can be null
  headers: {
    'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
  },
});
```

**Potential Fix:**
Check for null body before passing through:

```typescript
if (!response.body) {
  return NextResponse.json(
    { error: 'Backend returned empty response' },
    { status: 502 },
  );
}
```

---

#### [BUG-G06] Unhandled Exception in Idle Timeout Callback

**File:** `src/utils/idleTimeout.ts:38–41`
**Impact:** If `gracefulShutdownSync()` throws (e.g., a cleanup handler fails), the exception propagates out of the `setTimeout` callback and is an unhandled exception that may crash the process ungracefully rather than triggering the intended shutdown path

**Root Cause:**
The idle timeout fires `gracefulShutdownSync()` directly inside a `setTimeout` callback with no error boundary:

```typescript
timer = setTimeout(() => {
  const idleDuration = Date.now() - lastIdleTime;
  if (isIdle() && idleDuration >= delayMs) {
    logForDebugging(`Exiting after ${delayMs}ms of idle time`);
    gracefulShutdownSync(); // ← no try/catch; can throw
  }
}, delayMs);
```

**Potential Fix:**
Wrap the shutdown call in a try/catch and fall back to `process.exit(0)` on failure to ensure the process always exits cleanly:

```typescript
try {
  gracefulShutdownSync();
} catch (e) {
  logForDebugging(`gracefulShutdownSync threw: ${e}`);
  process.exit(0);
}
```

---

#### [BUG-G07] Scheduler Lock Not Awaited on Stop — Potential Lock Leak

**File:** `src/utils/cronScheduler.ts:411–413`
**Impact:** If lock release fails silently, other Claude sessions sharing the same working directory are permanently locked out of running scheduled tasks until the lock file is manually deleted or expires

**Root Cause:**
In the scheduler's `stop()` path (and the early-return after `tryAcquireSchedulerLock()`), the lock release is fire-and-forget:

```typescript
if (isOwner) {
  isOwner = false;
  void releaseSchedulerLock(lockOpts); // ← promise discarded, errors ignored
}
```

If `releaseSchedulerLock()` fails (e.g. due to a filesystem error or process kill), the lock file persists and blocks all other sessions from acquiring it.

**Potential Fix:**
Await the release (make the code path async) and log any errors. If synchronous shutdown is required, use a best-effort `try { releaseSchedulerLock(lockOpts) } catch {}` pattern with at minimum error logging.

---

#### [BUG-G08] MCP In-Process Transport Delivers Messages After Close

**File:** `src/services/mcp/InProcessTransport.ts:32–34`
**Impact:** Messages sent just before `close()` are delivered to a peer that considers itself closed, potentially triggering handlers on a torn-down MCP server

**Root Cause:**
`send()` delivers messages asynchronously via `queueMicrotask()`. If `send()` is called synchronously before `close()` resolves, the queued microtask fires after the `close()` call has marked the peer as closed — but the peer's `onmessage` handler is called anyway with no closed-state guard:

```typescript
async send(message: JSONRPCMessage): Promise<void> {
  if (this.closed) throw new Error('Transport is closed')
  queueMicrotask(() => {
    this.peer?.onmessage?.(message)   // ← no check: this.peer.closed?
  })
}
```

**Potential Fix:**
Add a closed-state guard inside the microtask callback:

```typescript
queueMicrotask(() => {
  if (!this.peer?.closed) {
    this.peer?.onmessage?.(message);
  }
});
```

---

### P3 — Low (Informational / Future Hardening)

---

#### [BUG-G09] Backpressure Not Handled in stdout/stderr Writes

**File:** `src/utils/process.ts:17–26`
**Impact:** Under heavy output (large file contents, many tool results piped to a terminal), `stream.write()` may return `false` signalling buffer full — but writes continue without waiting for the `drain` event, potentially causing output loss or OOM in piped (`-p`) mode

**Root Cause:**
The `writeOut()` function (and the `writeToStdout` / `writeToStderr` wrappers) explicitly ignore the return value of `write()`. The code even has a self-documenting comment acknowledging the gap:

```typescript
// Note: we don't handle backpressure (write() returning false).
// We should consider handling the callback to ensure we wait for data to flush.
stream.write(data /* callback to handle here */);
```

**Potential Fix:**
Queue writes behind a drain-aware wrapper, or use `stream.once('drain', ...)` to pause when `write()` returns `false`. For the `-p` (non-interactive) mode specifically, a simple async write-and-drain queue would eliminate any risk of output loss.

---

#### [BUG-G10] `NEXT_PUBLIC_API_URL` Exposes Backend Server Address in Client Bundle

**File:** `web/app/api/chat/route.ts:6`
**Impact:** The backend API URL (including host, port, and any internal network address) is embedded in the client-side JavaScript bundle served to all browsers, enabling direct requests to the backend that bypass Next.js middleware

**Root Cause:**
The `NEXT_PUBLIC_` prefix causes Next.js to inline the variable's value into client bundles at build time. While this variable is only _used_ in a server-side API route, its value is still visible in the downloaded JavaScript:

```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
```

**Potential Fix:**
Rename to `API_URL` (without the `NEXT_PUBLIC_` prefix). Server-side API routes can access non-public env vars directly. This keeps the backend address out of the client bundle.

---

#### [BUG-G11] Share Store Data Lost on Server Restart

**File:** `web/lib/share-store.ts:31–32`
**Impact:** All conversation shares (including those set to "never expire") are silently lost whenever the Next.js server process restarts, creating broken share links with no user notification

**Root Cause:**
The share store is a module-level in-memory `Map`. The code itself documents this as a known limitation:

```typescript
// In production, replace with a database (e.g. Redis, Postgres).
const store = new Map<string, StoredShare>();
```

In any deployment with process restarts (crash recovery, deploys, scaling), previously created share URLs return 404 with no indication that the content existed.

**Potential Fix:**
Persist shares to a durable store. The simplest upgrade path for a single-server deployment is writing shares to a JSON file or SQLite. For multi-replica deployments, Redis (with TTL support for expiring shares) is the natural fit.

---

### Summary

| ID  | Priority | Category                                  | File                                        | Fix Complexity |
| --- | -------- | ----------------------------------------- | ------------------------------------------- | -------------- |
| G01 | P0       | Security — Path Traversal                 | `web/app/api/files/write/route.ts:21`       | Low            |
| G02 | P0       | Security — Path Traversal                 | `web/app/api/files/read/route.ts:21`        | Low            |
| G03 | P1       | Security — Plaintext Passwords            | `web/lib/share-store.ts:51`                 | Low            |
| G04 | P1       | Race Condition — Watcher Restart          | `src/utils/hooks/fileChangedWatcher.ts:122` | Low            |
| G05 | P2       | Error Handling — Null Body                | `web/app/api/chat/route.ts:27`              | Low            |
| G06 | P2       | Error Handling — Unhandled Exception      | `src/utils/idleTimeout.ts:38`               | Low            |
| G07 | P2       | Resource Leak — Lock Not Released         | `src/utils/cronScheduler.ts:411`            | Low            |
| G08 | P2       | Correctness — Post-Close Message Delivery | `src/services/mcp/InProcessTransport.ts:32` | Low            |
| G09 | P3       | Reliability — Backpressure                | `src/utils/process.ts:17`                   | Medium         |
| G10 | P3       | Security — Env Var Exposure               | `web/app/api/chat/route.ts:6`               | Low            |
| G11 | P3       | Data Loss — Volatile Share Store          | `web/lib/share-store.ts:31`                 | High           |

**Highest-leverage quick wins (low complexity, high impact):**

1. **G01 + G02** — Add one-line path bounds check to both file API routes (prevents arbitrary read/write)
2. **G03** — Hash share passwords with `crypto.scrypt` before storage
3. **G04** — Await `watcher.close()` in `restartWatching()`
4. **G08** — Guard `onmessage` delivery with `!this.peer.closed` in microtask
5. **G10** — Rename `NEXT_PUBLIC_API_URL` → `API_URL`
