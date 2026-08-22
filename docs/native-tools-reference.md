# Claude Code Native Tools Reference

This document provides a comprehensive reference for all native tools available in the Claude Code CLI (v2.1.19). Each tool listing includes its parameters, types, behavioral characteristics, usage examples, and common patterns.

## Table of Contents

- [Glossary](#glossary)
- [Quick Reference](#quick-reference)
- [Tool Selection Guide](#tool-selection-guide)
- [Common Workflow Patterns](#common-workflow-patterns)
- [Permission & Security Model](#permission--security-model)
- [File I/O Tools](#file-io-tools)
  - [Read](#read)
  - [Edit](#edit)
  - [Write](#write)
  - [NotebookEdit](#notebookedit)
- [Search Tools](#search-tools)
  - [Grep (Search)](#grep)
  - [Glob](#glob)
- [Shell Execution](#shell-execution)
  - [Bash](#bash)
- [Web Tools](#web-tools)
  - [WebFetch (Fetch)](#webfetch)
  - [WebSearch (Web Search)](#websearch)
- [Sub-Agent Execution Tools](#sub-agent-execution-tools)
  - [Task](#task)
  - [TaskStop](#taskstop)
  - [TaskOutput](#taskoutput)
- [Task Management Tools](#task-management-tools)
  - [TaskCreate](#taskcreate)
  - [TaskGet](#taskget)
  - [TaskUpdate](#taskupdate)
  - [TaskList](#tasklist)
- [Planning & Organization Tools](#planning--organization-tools)
  - [TodoWrite](#todowrite)
  - [EnterPlanMode](#enterplanmode)
  - [ExitPlanMode](#exitplanmode)
- [Multi-Agent Tools](#multi-agent-tools)
  - [Teammate](#teammate)
- [User Interaction Tools](#user-interaction-tools)
  - [AskUserQuestion](#askuserquestion)
- [Code Intelligence Tools](#code-intelligence-tools)
  - [LSP](#lsp)
- [Tool & Workflow Discovery](#tool--workflow-discovery)
  - [Skill](#skill)
  - [ToolSearch](#toolsearch)
- [MCP Tools](#mcp-tools)
  - [mcp](#mcp)
  - [ListMcpResourcesTool](#listmcpresourcestool)
  - [ReadMcpResourceTool](#readmcpresourcetool)
- [Configuration Reference](#configuration-reference)
- [Summary](#summary)

---

## Glossary

| Term | Definition |
|------|-----------|
| **Agentic turn** | A single iteration of the agent's reasoning loop: receive input, select tools, execute, generate output. |
| **Auto-allowed** | A tool that executes without requiring user permission, typically read-only operations. |
| **Concurrency-safe** | A tool that can be invoked simultaneously by multiple agents without causing race conditions or data corruption. |
| **Deferred tools** | Tools not initially loaded to reduce token overhead; discoverable on-demand via `ToolSearch`. |
| **LSP** | Language Server Protocol — a standardized protocol for code intelligence features like go-to-definition, find references, and hover. |
| **Max result size** | Maximum character length of a tool's output. When exceeded, results are truncated with a warning. |
| **MCP** | [Model Context Protocol](https://modelcontextprotocol.io/) — an open protocol for connecting AI agents to external data sources and tools. |
| **Read-only** | A tool that does not modify files, state, or external resources. |
| **Sandboxed** | Execution in a restricted environment with limited file system and network access. |
| **Strict schema** | Tool parameters are validated exactly against a Zod schema; extra or mistyped fields cause errors. |
| **Sub-agent** | A child agent spawned by the `Task` tool to handle a specific workflow independently, with its own tool permissions and turn limits. |
| **Swarm mode** | Multi-agent execution mode where multiple agents work in parallel, coordinating via the `Teammate` tool. |
| **Zod** | TypeScript-first schema validation library used to enforce tool parameter types at runtime. See [zod.dev](https://zod.dev). |

---

## Quick Reference

### Essential Tools (Most Common)

| Tool | Purpose | Auto-Allowed |
|------|---------|:------------:|
| `Read` | View file contents (text, images, notebooks, PDFs) | Yes |
| `Edit` | Replace specific text in files | No |
| `Write` | Create or overwrite files | No |
| `Grep` | Regex search across file contents (ripgrep) | Yes |
| `Glob` | Find files by name pattern | Yes |
| `Bash` | Execute shell commands | Conditional |

### By Use Case

| If you want to... | Use this tool | Not this |
|-------------------|---------------|----------|
| Read file contents | `Read` | `Bash` with `cat` |
| Search file contents | `Grep` | `Bash` with `grep`/`rg` |
| Find files by name | `Glob` | `Bash` with `find` |
| Modify specific text | `Edit` | `Bash` with `sed`/`awk` |
| Create a new file | `Write` | `Bash` with `echo >` |
| Run shell commands | `Bash` | — |
| Search the web | `WebSearch` | — |
| Fetch a URL | `WebFetch` | `Bash` with `curl` |
| Complex multi-step task | `Task` (sub-agent) | — |
| Track progress | `TodoWrite` | — |

### Full Tool Matrix

| # | Tool | User-Facing Name | Read-Only | Concurrency-Safe | Requires Permission | Max Result Size |
|---|------|------------------|:---------:|:----------------:|:-------------------:|:---------------:|
| 1 | `Read` | Read | Yes | Yes | No | 100,000 |
| 2 | `Edit` | *(file path)* | No | No | Yes | 100,000 |
| 3 | `Write` | Write | No | No | Yes | 100,000 |
| 4 | `NotebookEdit` | Edit Notebook | No | No | Yes | 100,000 |
| 5 | `Grep` | Search | Yes | Yes | No | 20,000 |
| 6 | `Glob` | Glob | Yes | Yes | No | 100,000 |
| 7 | `Bash` | Bash | Conditional | Conditional | Conditional | 30,000 |
| 8 | `WebFetch` | Fetch | Yes | Yes | No | 100,000 |
| 9 | `WebSearch` | Web Search | Yes | Yes | No | 100,000 |
| 10 | `Task` | Task | No | No | Yes | 100,000 |
| 11 | `TaskStop` | Stop Task | No | Yes | No | — |
| 12 | `TaskOutput` | Task Output | Yes | Yes | No | 100,000 |
| 13 | `TaskCreate` | TaskCreate | No | Yes | No | — |
| 14 | `TaskGet` | TaskGet | Yes | Yes | No | — |
| 15 | `TaskUpdate` | TaskUpdate | No | Yes | No | — |
| 16 | `TaskList` | TaskList | Yes | Yes | No | — |
| 17 | `TodoWrite` | *(hidden)* | No | No | No (auto-allowed) | — |
| 18 | `EnterPlanMode` | *(hidden)* | Yes | Yes | No | — |
| 19 | `ExitPlanMode` | *(hidden)* | Yes | Yes | No | — |
| 20 | `Teammate` | Teammate | Conditional | No | Yes | — |
| 21 | `AskUserQuestion` | *(hidden)* | Yes | Yes | No | — |
| 22 | `LSP` | LSP | Yes | Yes | No | — |
| 23 | `Skill` | Skill | No | No | Yes | — |
| 24 | `ToolSearch` | ToolSearch | Yes | Yes | No | — |
| 25 | `mcp` | mcp | No | No | Yes | — |
| 26 | `ListMcpResourcesTool` | — | Yes | Yes | No | — |
| 27 | `ReadMcpResourceTool` | — | Yes | Yes | No | — |

---

## Tool Selection Guide

### File Operations

- **Read a file** → Use `Read`. Auto-allowed, supports pagination via `offset`/`limit`, handles images/PDFs/notebooks.
- **Modify specific text** → Use `Edit`. Requires reading the file first. Specify exact `old_string` to replace.
- **Create or overwrite a file** → Use `Write`. Must read existing files before overwriting. Best for new files.
- **Edit notebook cells** → Use `NotebookEdit`. Supports replace, insert, and delete on `.ipynb` files.

### Search Operations

- **Search file contents by regex** → Use `Grep`. Prefer over `Bash` with `grep`/`rg` (auto-allowed, richer output modes).
- **Find files by name pattern** → Use `Glob`. Prefer over `Bash` with `find` (faster, auto-allowed).

### Execution

- **Run a shell command** → Use `Bash`. Read-only commands (e.g., `git status`, `ls`) are auto-allowed; write commands require permission.
- **Long-running operation** → Use `Bash` with `run_in_background: true`, then retrieve results via `TaskOutput`.

### Task Orchestration

- **Complex multi-step workflow** → Use `Task` to spawn a sub-agent with its own tool access.
- **Track your own progress** → Use `TodoWrite` for the agent's internal checklist.
- **Cross-agent task management** → Use `TaskCreate`/`TaskGet`/`TaskUpdate`/`TaskList`.

> **Note:** `TodoWrite` and the `TaskCreate`/`TaskGet`/`TaskUpdate`/`TaskList` family are mutually exclusive — only one set is active at a time depending on the active feature flag.

---

## Common Workflow Patterns

### Pattern 1: Read → Edit (Most Common)

Always read a file before editing it to ensure `old_string` matches exactly.

```
1. Read("/home/user/project/config.js")
2. Edit("/home/user/project/config.js",
        old_string="  timeout: 5000,",
        new_string="  timeout: 10000,")
```

**Why:** Edit fails if `old_string` doesn't match exactly (including indentation). Reading first guarantees accuracy.

### Pattern 2: Glob → Grep → Read (Codebase Exploration)

```
1. Glob("**/*.test.ts")           → Find test files
2. Grep("describe.*integration",
        glob="**/*.test.ts")      → Search content within matches
3. Read matched files              → Examine full context
```

### Pattern 3: Background Task Execution

```
1. Bash("npm run build",
        run_in_background=true)    → Returns task_id
2. ... do other work ...
3. TaskOutput(task_id,
              block=true,
              timeout=120000)      → Retrieve results
```

### Pattern 4: Parallel Independent Operations

Execute independent tools simultaneously for speed:

```
Parallel:
  - Read("/home/user/package.json")
  - Read("/home/user/README.md")
  - Bash("git status")
```

**When to parallelize:** Multiple reads, independent searches, multiple web fetches.
**When NOT to:** Read-then-Edit, sequential Bash commands, any dependency chain.

### Pattern 5: Sub-Agent Delegation

```
Task(description="Run tests and fix failures",
     prompt="Execute npm test, analyze failures, and fix them",
     subagent_type="general-purpose",
     allowed_tools=["Read", "Edit", "Bash", "Grep"])
```

---

## Permission & Security Model

### Auto-Allowed Tools (No User Prompt)

Read-only and informational tools execute immediately:

`Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`, `TaskOutput`, `TaskList`, `TaskGet`, `TodoWrite`, `AskUserQuestion`, `LSP`, `EnterPlanMode`, `ExitPlanMode`, `ListMcpResourcesTool`, `ReadMcpResourceTool`, `ToolSearch`

### Permission-Required Tools

These require user approval before execution:

| Tool | What Triggers Prompt |
|------|---------------------|
| `Edit` | File modification |
| `Write` | File creation/overwrite |
| `NotebookEdit` | Notebook cell modification |
| `Bash` | Write/modify commands (read-only commands like `ls`, `git status` are auto-allowed) |
| `Task` | Spawning a sub-agent |
| `Skill` | Executing a custom workflow |
| `Teammate` | Multi-agent coordination |
| `mcp` | MCP tool execution (varies by server) |

### Sandbox Model (Bash)

Bash commands run in a sandboxed environment by default. The `dangerouslyDisableSandbox` parameter overrides this (requires explicit approval).

### Configuring Permissions

- **Allow specific tools:** `--allowedTools=Read,Edit,Bash`
- **Deny specific tools:** `--disallowedTools=Write,WebFetch`
- **Project settings:** `.claude/settings.json` with permission rules
- **Sub-agent restrictions:** Use `allowed_tools` parameter on `Task` to limit sub-agent capabilities

---

## File I/O Tools

### Read

Reads files from the local filesystem. Supports text files, images (returns base64), Jupyter notebooks (returns cell structure), and PDFs.

| Parameter   | Type     | Required | Description                                |
| ----------- | -------- | -------- | ------------------------------------------ |
| `file_path` | `string` | Yes      | Absolute path to the file to read          |
| `offset`    | `number` | No       | Line number to start reading from          |
| `limit`     | `number` | No       | Number of lines to read (default: 2000)    |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No
- **Max result size:** 100,000 characters

#### Example

```json
{
  "file_path": "/home/user/project/src/main.py",
  "offset": 50,
  "limit": 100
}
```

#### Best Practices

- Always read a file before editing or overwriting it.
- Use `offset`/`limit` for large files (>2000 lines) to paginate through content.
- Read multiple independent files in parallel for speed.
- Output uses `cat -n` format with 1-based line numbers.
- Lines longer than 2000 characters are truncated.

#### Common Errors

- **File not found:** Verify absolute path; use `Glob` to confirm file exists.
- **Cannot read directory:** Use `Bash` with `ls` or `Glob` for directories.
- **Binary file:** Images and PDFs are handled specially; other binary files return an error.

---

### Edit

Performs exact string replacement in a file. Replaces a specified `old_string` with `new_string`.

| Parameter     | Type      | Required | Description                                           |
| ------------- | --------- | -------- | ----------------------------------------------------- |
| `file_path`   | `string`  | Yes      | Absolute path to the file to modify                   |
| `old_string`  | `string`  | Yes      | The text to replace                                   |
| `new_string`  | `string`  | Yes      | The replacement text (must differ from `old_string`)  |
| `replace_all` | `boolean` | No       | Replace all occurrences (default: `false`)            |

- **Read-only:** No
- **Concurrency-safe:** No
- **Requires permission:** Yes
- **Max result size:** 100,000 characters

#### Example

```json
{
  "file_path": "/home/user/project/app.js",
  "old_string": "const port = 3000;",
  "new_string": "const port = process.env.PORT || 3000;"
}
```

#### Best Practices

- Always `Read` the file first, then copy `old_string` exactly from the output (preserving indentation).
- Include surrounding context to make `old_string` unique if the string appears multiple times.
- Use `replace_all: true` for variable/function renaming across a file.
- Do not include line number prefixes from `Read` output in `old_string`.

#### Common Errors

- **`old_string` not found:** The exact string (including whitespace) doesn't exist. Re-read the file.
- **`old_string` not unique:** Multiple matches found. Include more context or set `replace_all: true`.
- **`old_string` and `new_string` identical:** The values must differ.

---

### Write

Creates new files or overwrites existing ones.

| Parameter   | Type     | Required | Description                                  |
| ----------- | -------- | -------- | -------------------------------------------- |
| `file_path` | `string` | Yes      | Absolute path to the file (must be absolute) |
| `content`   | `string` | Yes      | Content to write                             |

- **Read-only:** No
- **Concurrency-safe:** No
- **Requires permission:** Yes
- **Max result size:** 100,000 characters

#### Best Practices

- Must `Read` existing files before overwriting (the tool will error otherwise).
- Prefer `Edit` over `Write` for existing files — `Edit` makes intent clearer and is safer.
- Verify the parent directory exists before writing (use `Bash` with `mkdir -p` if needed).

---

### NotebookEdit

Edits Jupyter notebook (`.ipynb`) cells — replace, insert, or delete.

| Parameter       | Type     | Required | Description                                                       |
| --------------- | -------- | -------- | ----------------------------------------------------------------- |
| `notebook_path` | `string` | Yes      | Absolute path to the notebook file                                |
| `new_source`    | `string` | Yes      | New source content for the cell                                   |
| `cell_id`       | `string` | No       | ID of the cell to edit; for insert, new cell is placed after this |
| `cell_type`     | `enum`   | No       | `"code"` or `"markdown"` (required for insert)                    |
| `edit_mode`     | `enum`   | No       | `"replace"`, `"insert"`, or `"delete"` (default: `"replace"`)    |

- **Read-only:** No
- **Concurrency-safe:** No
- **Requires permission:** Yes

---

## Search Tools

### Grep

User-facing name: **Search**. A regex search tool built on [ripgrep](https://github.com/BurntSushi/ripgrep).

| Parameter     | Type      | Required | Description                                                    |
| ------------- | --------- | -------- | -------------------------------------------------------------- |
| `pattern`     | `string`  | Yes      | Regex pattern to search for                                    |
| `path`        | `string`  | No       | File or directory to search in (defaults to cwd)               |
| `glob`        | `string`  | No       | Glob filter (e.g. `"*.js"`, `"*.{ts,tsx}"`)                    |
| `output_mode` | `enum`    | No       | `"content"`, `"files_with_matches"` (default), or `"count"`   |
| `-A`          | `number`  | No       | Lines to show after each match                                 |
| `-B`          | `number`  | No       | Lines to show before each match                                |
| `-C`          | `number`  | No       | Lines to show around each match                                |
| `-n`          | `boolean` | No       | Show line numbers (default: `true`)                            |
| `-i`          | `boolean` | No       | Case-insensitive search                                        |
| `type`        | `string`  | No       | File type filter (e.g. `"js"`, `"py"`, `"rust"`)              |
| `head_limit`  | `number`  | No       | Limit output to first N entries (default: `0` = unlimited)     |
| `offset`      | `number`  | No       | Skip first N entries (default: `0`)                            |
| `multiline`   | `boolean` | No       | Enable multiline matching, `rg -U --multiline-dotall` (default: `false`) |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No
- **Max result size:** 20,000 characters

#### Example

```json
{
  "pattern": "TODO:",
  "glob": "*.{ts,tsx}",
  "output_mode": "content",
  "-C": 2
}
```

#### Notes

- Uses ripgrep syntax (not standard grep). Literal braces need escaping: `interface\\{\\}`.
- `-A`, `-B`, `-C` context flags only apply when `output_mode` is `"content"`.

---

### Glob

Fast file pattern matching. Returns matching file paths sorted by modification time.

| Parameter | Type     | Required | Description                                  |
| --------- | -------- | -------- | -------------------------------------------- |
| `pattern` | `string` | Yes      | Glob pattern (e.g. `"**/*.ts"`)              |
| `path`    | `string` | No       | Directory to search in; if omitted, the current working directory is used. |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No
- **Max result size:** 100,000 characters (truncated at 100 files)

---

## Shell Execution

### Bash

Executes shell commands. Sandboxed by default.

| Parameter                   | Type      | Required | Description                                                                  |
| --------------------------- | --------- | -------- | ---------------------------------------------------------------------------- |
| `command`                   | `string`  | Yes      | The command to execute                                                       |
| `timeout`                   | `number`  | No       | Timeout in milliseconds (default: 120,000; max configurable via `BASH_MAX_TIMEOUT_MS`) |
| `description`               | `string`  | No       | Human-readable description of the command                                    |
| `run_in_background`         | `boolean` | No       | Run in background; use `TaskOutput` to retrieve results later                |
| `dangerouslyDisableSandbox` | `boolean` | No       | Override sandbox mode (use with caution)                                     |

Internal parameter (not for direct use):
- `_simulatedSedEdit` — pre-computed sed edit result injected by the UI preview system.

- **Read-only:** Depends on command analysis (auto-detected at runtime)
- **Concurrency-safe:** Depends on command analysis
- **Requires permission:** Conditional — read-only commands (e.g., `ls`, `git status`, `git diff`) are auto-allowed; write commands require approval
- **Max result size:** 30,000 characters

#### Best Practices

- Use absolute paths; working directory resets between calls.
- Chain dependent commands: `cd /tmp && ls` (not separate calls).
- Prefer `Read`/`Grep`/`Glob` over `Bash` with `cat`/`grep`/`find` — native tools are auto-allowed and optimized.
- Provide a `description` for complex commands to help users understand intent.

#### Common Errors

- **Timeout:** Command killed, partial output returned. Increase `timeout` or split into smaller operations.
- **Working directory reset:** Each call starts in the original cwd. Use `&&` chaining or absolute paths.
- **Interactive commands not supported:** Do not use `-i` flags (`git rebase -i`, `git add -i`).

#### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `BASH_DEFAULT_TIMEOUT_MS` | `120000` | Default timeout for Bash commands |
| `BASH_MAX_TIMEOUT_MS` | `600000` | Maximum allowed timeout |

---

## Web Tools

### WebFetch

User-facing name: **Fetch**. Fetches content from a URL and processes it with a prompt using a fast model.

| Parameter | Type           | Required | Description                            |
| --------- | -------------- | -------- | -------------------------------------- |
| `url`     | `string (uri)` | Yes      | URL to fetch (HTTP auto-upgraded to HTTPS) |
| `prompt`  | `string`       | Yes      | Prompt to process fetched content with |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No
- **Cache:** 15-minute self-cleaning cache
- **Max result size:** 100,000 characters

#### Notes

- HTML is converted to markdown before processing.
- When a URL redirects to a different host, the tool returns the redirect URL for you to re-fetch.

---

### WebSearch

User-facing name: **Web Search**. Searches the web using the Anthropic `web_search_20250305` server tool.

| Parameter         | Type       | Required | Description                             |
| ----------------- | ---------- | -------- | --------------------------------------- |
| `query`           | `string`   | Yes      | Search query (min 2 characters)         |
| `allowed_domains` | `string[]` | No       | Only include results from these domains |
| `blocked_domains` | `string[]` | No       | Exclude results from these domains      |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No
- **Max uses per invocation:** 8
- **Availability:** Platform-dependent — always available on firstParty; on Vertex, requires claude-opus-4/sonnet-4/haiku-4 models.
- **Max result size:** 100,000 characters

---

## Sub-Agent Execution Tools

### Task

Launches a sub-agent to handle complex, multi-step tasks autonomously.

| Parameter           | Type       | Required | Description                                                            |
| ------------------- | ---------- | -------- | ---------------------------------------------------------------------- |
| `description`       | `string`   | Yes      | Short (3-5 word) task description                                      |
| `prompt`            | `string`   | Yes      | Detailed task instructions                                             |
| `subagent_type`     | `string`   | Yes      | Agent type (e.g. `"Bash"`, `"Explore"`, `"Plan"`, `"general-purpose"`) |
| `model`             | `enum`     | No       | `"sonnet"`, `"opus"`, or `"haiku"`. Inherits from parent if omitted.   |
| `resume`            | `string`   | No       | Agent ID to resume a previous execution                                |
| `run_in_background` | `boolean`  | No       | Run in background                                                      |
| `max_turns`         | `number`   | No       | Maximum agentic turns before stopping (positive integer)               |
| `allowed_tools`     | `string[]` | No       | Tools granted to this agent (e.g. `["Read", "Bash(git *)"]`)          |
| `name`              | `string`   | No       | Name for the spawned agent                                             |
| `team_name`         | `string`   | No       | Team name for spawning. Uses current team context if omitted.          |
| `mode`              | `enum`     | No       | Permission mode: `"acceptEdits"`, `"bypassPermissions"`, `"default"`, `"delegate"`, `"dontAsk"`, or `"plan"` |

- **Read-only:** No
- **Concurrency-safe:** No
- **Requires permission:** Yes
- **Max result size:** 100,000 characters

#### Notes

- Sub-agents cannot access the parent's conversation context — provide all needed information in `prompt`.
- When `max_turns` is reached, partial results are returned. Use `resume` with the agent ID to continue.
- Prefer `"haiku"` model for quick, straightforward sub-tasks to minimize cost and latency.

**Related tools:** `TaskStop`, `TaskOutput`

---

### TaskStop

User-facing name: **Stop Task**. Stops a running background task.

**Aliases:** `KillShell`

| Parameter  | Type     | Required | Description                              |
| ---------- | -------- | -------- | ---------------------------------------- |
| `task_id`  | `string` | No       | ID of the background task                |
| `shell_id` | `string` | No       | *(Deprecated)* Use `task_id` instead     |

- **Read-only:** No
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

### TaskOutput

User-facing name: **Task Output**. Retrieves output from a running or completed background task.

**Aliases:** `AgentOutputTool`, `BashOutputTool`

| Parameter | Type      | Required | Description                                    |
| --------- | --------- | -------- | ---------------------------------------------- |
| `task_id` | `string`  | Yes      | Task ID to get output from                     |
| `block`   | `boolean` | No       | Wait for completion (default: `true`)          |
| `timeout` | `number`  | No       | Max wait in ms (min: 0, default: 30000, max: 600000) |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No
- **Max result size:** 100,000 characters

**Related tools:** `Task`, `TaskStop`, `Bash` (with `run_in_background`)

---

## Task Management Tools

> **Note:** These tools are only available when the task management feature flag is active. They are mutually exclusive with `TodoWrite` — only one system is active at a time.

### TaskCreate

Creates a new task in the task management system.

| Parameter     | Type     | Required | Description                                                |
| ------------- | -------- | -------- | ---------------------------------------------------------- |
| `subject`     | `string` | Yes      | Brief title for the task                                   |
| `description` | `string` | Yes      | Detailed description                                       |
| `activeForm`  | `string` | No       | Present continuous form for display (e.g. "Running tests") |
| `metadata`    | `object` | No       | Arbitrary metadata                                         |

- **Read-only:** No
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

### TaskGet

Retrieves a task by ID.

| Parameter | Type     | Required | Description         |
| --------- | -------- | -------- | ------------------- |
| `taskId`  | `string` | Yes      | ID of the task      |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

### TaskUpdate

Updates an existing task's status, description, or dependencies.

| Parameter      | Type       | Required | Description                                       |
| -------------- | ---------- | -------- | ------------------------------------------------- |
| `taskId`       | `string`   | Yes      | ID of the task to update                          |
| `subject`      | `string`   | No       | New subject                                       |
| `description`  | `string`   | No       | New description                                   |
| `activeForm`   | `string`   | No       | Present continuous form for display               |
| `status`       | `enum`     | No       | `"pending"`, `"in_progress"`, or `"completed"`    |
| `addBlocks`    | `string[]` | No       | Task IDs that this task blocks                    |
| `addBlockedBy` | `string[]` | No       | Task IDs that block this task                     |
| `owner`        | `string`   | No       | New owner for the task                            |
| `metadata`     | `object`   | No       | Metadata to merge (set key to `null` to delete)   |

- **Read-only:** No
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

### TaskList

Lists all tasks. **No parameters.**

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

## Planning & Organization Tools

### TodoWrite

Manages the agent's internal todo/checklist. Auto-allowed (no permission prompt).

> **Note:** Only available when the task management feature flag is **inactive**. Mutually exclusive with `TaskCreate`/`TaskGet`/`TaskUpdate`/`TaskList`.

| Parameter            | Type     | Required | Description                                     |
| -------------------- | -------- | -------- | ----------------------------------------------- |
| `todos`              | `array`  | Yes      | Array of todo items                             |
| `todos[].content`    | `string` | Yes      | What needs to be done (min 1 char)              |
| `todos[].status`     | `enum`   | Yes      | `"pending"`, `"in_progress"`, or `"completed"` |
| `todos[].activeForm` | `string` | Yes      | Present continuous form, e.g. "Fixing the bug" (min 1 char) |

- **Read-only:** No
- **Concurrency-safe:** No
- **Requires permission:** No (auto-allowed)

---

### EnterPlanMode

Requests permission to enter plan mode for complex tasks requiring exploration and design. **No parameters.**

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

### ExitPlanMode

Prompts the user to exit plan mode and begin implementation.

| Parameter             | Type      | Required | Description                              |
| --------------------- | --------- | -------- | ---------------------------------------- |
| `allowedPrompts`      | `array`   | No       | Permissions needed to implement the plan |
| `pushToRemote`        | `boolean` | No       | Push plan to a remote Claude.ai session  |
| `remoteSessionId`     | `string`  | No       | Remote session ID                        |
| `remoteSessionUrl`    | `string`  | No       | Remote session URL                       |
| `remoteSessionTitle`  | `string`  | No       | Remote session title                     |
| `launchSwarm`         | `boolean` | No       | Launch a multi-agent swarm               |
| `teammateCount`       | `number`  | No       | Number of teammates to spawn             |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

## Multi-Agent Tools

### Teammate

Spawns teammates and coordinates with other agents running in parallel.

**Availability:** Only enabled in swarm mode.

| Parameter         | Type     | Required | Description                                                                 |
| ----------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `operation`       | `enum`   | Yes      | `"spawnTeam"`, `"cleanup"`, `"write"`, `"broadcast"`, `"requestShutdown"`, `"approveShutdown"`, `"rejectShutdown"`, `"approvePlan"`, `"rejectPlan"`, `"discoverTeams"`, `"requestJoin"`, `"approveJoin"`, `"rejectJoin"` |
| `name`            | `string` | No       | Your name when broadcasting (required for `broadcast`)                      |
| `key`             | `string` | No       | Key for stored data (`write` operation)                                     |
| `value`           | `string` | No       | Value to store as JSON string (`write` operation)                           |
| `target_agent_id` | `string` | No       | Recipient agent ID (`write` operation)                                      |
| `agent_id`        | `string` | No       | Your registered agent ID (for `write` operations)                           |
| `agent_type`      | `string` | No       | Type/role of the team lead                                                  |
| `team_name`       | `string` | No       | Team name for spawning                                                      |
| `proposed_name`   | `string` | No       | Proposed name when joining a team                                           |
| `capabilities`    | `string` | No       | Description of capabilities when joining                                    |
| `description`     | `string` | No       | Team description/purpose (`spawnTeam` only)                                 |
| `reason`          | `string` | No       | Reason for the operation                                                    |
| `request_id`      | `string` | No       | Request ID for shutdown, plan approval, or join operations                  |
| `feedback`        | `string` | No       | Feedback for plan rejection                                                 |
| `assigned_name`   | `string` | No       | Name to assign to a joining agent                                           |
| `timeout_ms`      | `number` | No       | Timeout in ms for `requestJoin` (default: 60000)                            |

- **Read-only:** Conditional (returns `true` only for `write` and `broadcast` operations)
- **Concurrency-safe:** No
- **Requires permission:** Yes

#### Notes

- `broadcast` is expensive (N messages for N teammates) — prefer `write` to specific teammates when possible.

---

## User Interaction Tools

### AskUserQuestion

Asks the user structured multiple-choice questions (1-4 questions).

| Parameter                           | Type      | Required | Description                                     |
| ----------------------------------- | --------- | -------- | ----------------------------------------------- |
| `questions`                         | `array`   | Yes      | 1-4 question objects                            |
| `questions[].question`              | `string`  | Yes      | Question text (should end with `?`; must be unique across questions) |
| `questions[].header`                | `string`  | Yes      | Short label (max 12 chars)                      |
| `questions[].options`               | `array`   | Yes      | 2-4 choice objects (labels must be unique within each question) |
| `questions[].options[].label`       | `string`  | Yes      | Display text (1-5 words)                        |
| `questions[].options[].description` | `string`  | Yes      | Explanation of the option                       |
| `questions[].multiSelect`           | `boolean` | No       | Allow multiple selections (default: `false`)    |
| `answers`                           | `record<string, string>` | No | User answers collected by the permission component |
| `metadata`                          | `object`  | No       | Optional metadata for tracking (e.g. `{source: "remember"}`) |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No (but requires user interaction)

#### Constraints

- Question texts must be unique across all questions.
- Option labels must be unique within each question.

---

## Code Intelligence Tools

### LSP

Interacts with Language Server Protocol servers for code intelligence features.

**Availability:** Only enabled when LSP servers are configured and running (non-error state).

| Parameter   | Type     | Required | Description                                                                                                                  |
| ----------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `operation` | `enum`   | Yes      | `"goToDefinition"`, `"findReferences"`, `"hover"`, `"documentSymbol"`, `"workspaceSymbol"`, `"goToImplementation"`, `"prepareCallHierarchy"`, `"incomingCalls"`, `"outgoingCalls"` |
| `filePath`  | `string` | Yes      | Path to the file                                                                                                             |
| `line`      | `number` | Yes      | Line number (1-based, positive integer)                                                                                      |
| `character` | `number` | Yes      | Character offset (1-based, positive integer)                                                                                 |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

## Tool & Workflow Discovery

### Skill

Executes a registered skill (custom command/workflow).

| Parameter | Type     | Required | Description                                   |
| --------- | -------- | -------- | --------------------------------------------- |
| `skill`   | `string` | Yes      | Skill name (e.g. `"commit"`, `"review-pr"`)   |
| `args`    | `string` | No       | Optional arguments                            |

- **Read-only:** No
- **Concurrency-safe:** No
- **Requires permission:** Yes

---

### ToolSearch

Searches for deferred/lazy-loaded tools by name or keywords.

**Availability:** Only enabled when deferred tools are active.

| Parameter     | Type     | Required | Description                                              |
| ------------- | -------- | -------- | -------------------------------------------------------- |
| `query`       | `string` | Yes      | Search query or `"select:<tool_name>"` for direct lookup |
| `max_results` | `number` | No       | Maximum number of results (default: 5)                   |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

## MCP Tools

MCP (Model Context Protocol) allows Claude Code to integrate with external tools and data sources via MCP servers. Once configured, MCP server tools appear alongside native tools and are invoked automatically as needed.

### Configuring MCP Servers

MCP servers are configured via `.mcp.json` files at three scopes (project, local, user) or via CLI:

```bash
claude mcp add <server-name> -- <command> [args...]
claude mcp add-json <server-name> '<json-config>'
claude mcp add-from-claude-desktop
```

**Debugging:** Use `--mcp-debug` flag or set `MCP_TIMEOUT` environment variable for timeout configuration.

### mcp

Generic passthrough for MCP server tools. Acts as a bridge for dynamically loaded MCP tools (e.g. browser automation, GitHub, custom servers).

- **Parameters:** Empty object `{}`
- **Read-only:** No
- **Concurrency-safe:** No
- **Requires permission:** Yes (varies by MCP tool)

---

### ListMcpResourcesTool

Lists available MCP resources.

| Parameter | Type     | Required | Description                        |
| --------- | -------- | -------- | ---------------------------------- |
| `server`  | `string` | No       | Server name to filter resources by |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

### ReadMcpResourceTool

Reads an MCP resource by URI.

| Parameter | Type     | Required | Description          |
| --------- | -------- | -------- | -------------------- |
| `server`  | `string` | Yes      | MCP server name      |
| `uri`     | `string` | Yes      | Resource URI to read |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Requires permission:** No

---

## Configuration Reference

### Environment Variables

| Variable | Default | Affects | Description |
|----------|---------|---------|-------------|
| `BASH_DEFAULT_TIMEOUT_MS` | `120000` | Bash | Default timeout for shell commands |
| `BASH_MAX_TIMEOUT_MS` | `600000` | Bash | Maximum allowed timeout |
| `MCP_TIMEOUT` | — | MCP | Timeout for MCP server startup (ms) |
| `ANTHROPIC_MODEL` | — | Task | Override default model (e.g., Bedrock ARN) |
| `ANTHROPIC_SMALL_FAST_MODEL` | — | Task | Override model for sub-tasks |
| `ANTHROPIC_LOG` | — | All | Set to `debug` for API request logging |

### CLI Flags

| Flag | Description |
|------|-------------|
| `--allowedTools=<tools>` | Comma-separated list of allowed tools |
| `--disallowedTools=<tools>` | Comma-separated list of denied tools |
| `--mcp-config <path>` | One-off MCP server configuration file |
| `--mcp-debug` | Enable MCP debugging output |

### Configuration Files

| File | Purpose |
|------|---------|
| `.claude/settings.json` | Project permission rules and settings |
| `.mcp.json` | MCP server configuration (project/local/user scopes) |
| `.claude/commands/` | Custom slash commands (markdown templates) |
| `CLAUDE.md` | Project context file (supports `@path/to/file.md` imports) |

---

## Summary

| Category                | Tools                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| **File I/O**            | `Read`, `Edit`, `Write`, `NotebookEdit`                                    |
| **Search**              | `Grep`, `Glob`                                                             |
| **Shell**               | `Bash`                                                                     |
| **Web**                 | `WebFetch`, `WebSearch`                                                    |
| **Sub-Agent Execution** | `Task`, `TaskStop`, `TaskOutput`                                           |
| **Task Management**     | `TaskCreate`, `TaskGet`, `TaskUpdate`, `TaskList`                          |
| **Planning**            | `TodoWrite`, `EnterPlanMode`, `ExitPlanMode`                               |
| **Multi-Agent**         | `Teammate`                                                                 |
| **User Interaction**    | `AskUserQuestion`                                                          |
| **Code Intelligence**   | `LSP`                                                                      |
| **Tool Discovery**      | `Skill`, `ToolSearch`                                                      |
| **MCP**                 | `mcp`, `ListMcpResourcesTool`, `ReadMcpResourceTool`                       |

**Total: 27 native tools**

### Historical Names

| Current Name | Previous Name | Changed In |
|-------------|---------------|------------|
| `Read` | `View` | v0.2.x |
| `TaskStop` | `KillShell` | — (alias still supported) |
| `TaskOutput` | `BashOutputTool` / `AgentOutputTool` | — (aliases still supported) |

All tool definitions extracted from the installed Claude Code package (`@anthropic-ai/claude-code` v2.1.19). Schemas are validated at runtime using [Zod](https://zod.dev).
