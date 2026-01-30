# Claude Code Native Tools Reference

This document provides a comprehensive reference for all native tools available in the Claude Code CLI (v2.1.19). Each tool listing includes its parameters, types, and behavioral characteristics.

## Table of Contents

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
- [Agent / Task Tools](#agent--task-tools)
  - [Task](#task)
  - [TaskStop](#taskstop)
  - [TaskOutput](#taskoutput)
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
- [Interaction & Intelligence Tools](#interaction--intelligence-tools)
  - [AskUserQuestion](#askuserquestion)
  - [LSP](#lsp)
  - [Skill](#skill)
  - [ToolSearch](#toolsearch)
- [MCP Tools](#mcp-tools)
  - [mcp](#mcp)
  - [ListMcpResourcesTool](#listmcpresourcestool)
  - [ReadMcpResourceTool](#readmcpresourcetool)
- [Summary](#summary)

---

## File I/O Tools

### Read

Reads files from the local filesystem. Supports text files, images (returns base64), Jupyter notebooks (returns cell structure), and PDFs.

| Parameter   | Type     | Required | Description                                |
| ----------- | -------- | -------- | ------------------------------------------ |
| `file_path` | `string` | Yes      | Absolute path to the file to read          |
| `offset`    | `number` | No       | Line number to start reading from          |
| `limit`     | `number` | No       | Number of lines to read                    |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Max result size:** 100,000 characters

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

---

### Write

Creates new files or overwrites existing ones.

| Parameter   | Type     | Required | Description                               |
| ----------- | -------- | -------- | ----------------------------------------- |
| `file_path` | `string` | Yes      | Absolute path to the file (must be absolute) |
| `content`   | `string` | Yes      | Content to write                          |

- **Read-only:** No
- **Concurrency-safe:** No
- **Requires permission:** Yes

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

---

## Search Tools

### Grep

User-facing name: **Search**. A regex search tool built on [ripgrep](https://github.com/BurntSushi/ripgrep).

| Parameter     | Type      | Required | Description                                                  |
| ------------- | --------- | -------- | ------------------------------------------------------------ |
| `pattern`     | `string`  | Yes      | Regex pattern to search for                                  |
| `path`        | `string`  | No       | File or directory to search in (defaults to cwd)             |
| `glob`        | `string`  | No       | Glob filter (e.g. `"*.js"`, `"*.{ts,tsx}"`)                  |
| `output_mode` | `enum`    | No       | `"content"`, `"files_with_matches"` (default), or `"count"` |
| `-A`          | `number`  | No       | Lines to show after each match                               |
| `-B`          | `number`  | No       | Lines to show before each match                              |
| `-C`          | `number`  | No       | Lines to show around each match                              |
| `-n`          | `boolean` | No       | Show line numbers (default: `true`)                          |
| `-i`          | `boolean` | No       | Case-insensitive search                                      |
| `type`        | `string`  | No       | File type filter (e.g. `"js"`, `"py"`, `"rust"`)            |
| `head_limit`  | `number`  | No       | Limit output to first N entries                              |
| `offset`      | `number`  | No       | Skip first N entries                                         |
| `multiline`   | `boolean` | No       | Enable multiline matching (`rg -U --multiline-dotall`)       |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Max result size:** 20,000 characters

---

### Glob

Fast file pattern matching. Returns matching file paths sorted by modification time.

| Parameter | Type     | Required | Description                                  |
| --------- | -------- | -------- | -------------------------------------------- |
| `pattern` | `string` | Yes      | Glob pattern (e.g. `"**/*.ts"`)              |
| `path`    | `string` | No       | Directory to search in (defaults to cwd)     |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Max result size:** 100,000 characters (truncated at 100 files)

---

## Shell Execution

### Bash

Executes shell commands. Sandboxed by default.

| Parameter                   | Type      | Required | Description                                                                  |
| --------------------------- | --------- | -------- | ---------------------------------------------------------------------------- |
| `command`                   | `string`  | Yes      | The command to execute                                                       |
| `timeout`                   | `number`  | No       | Timeout in milliseconds (configurable max)                                   |
| `description`               | `string`  | No       | Human-readable description of the command                                    |
| `run_in_background`         | `boolean` | No       | Run in background; use `TaskOutput` to retrieve results later                |
| `dangerouslyDisableSandbox` | `boolean` | No       | Override sandbox mode (use with caution)                                     |

- **Read-only:** Depends on command analysis
- **Concurrency-safe:** Depends on command analysis
- **Max result size:** 30,000 characters

---

## Web Tools

### WebFetch

User-facing name: **Fetch**. Fetches content from a URL and processes it with a prompt using a fast model.

| Parameter | Type          | Required | Description                            |
| --------- | ------------- | -------- | -------------------------------------- |
| `url`     | `string (uri)`| Yes      | URL to fetch                           |
| `prompt`  | `string`      | Yes      | Prompt to process fetched content with |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Cache:** 15-minute self-cleaning cache

---

### WebSearch

User-facing name: **Web Search**. Searches the web using the Anthropic `web_search_20250305` server tool.

| Parameter         | Type       | Required | Description                          |
| ----------------- | ---------- | -------- | ------------------------------------ |
| `query`           | `string`   | Yes      | Search query (min 2 characters)      |
| `allowed_domains` | `string[]` | No       | Only include results from these domains |
| `blocked_domains` | `string[]` | No       | Exclude results from these domains   |

- **Read-only:** Yes
- **Concurrency-safe:** Yes
- **Max uses per invocation:** 8

---

## Agent / Task Tools

### Task

Launches a sub-agent to handle complex, multi-step tasks autonomously.

| Parameter       | Type       | Required | Description                                                   |
| --------------- | ---------- | -------- | ------------------------------------------------------------- |
| `description`   | `string`   | Yes      | Short (3-5 word) task description                             |
| `prompt`        | `string`   | Yes      | Detailed task instructions                                    |
| `subagent_type` | `string`   | Yes      | Agent type (e.g. `"Bash"`, `"Explore"`, `"Plan"`, `"general-purpose"`) |
| `model`         | `enum`     | No       | `"sonnet"`, `"opus"`, or `"haiku"`                            |
| `resume`        | `string`   | No       | Agent ID to resume a previous execution                       |
| `run_in_background` | `boolean` | No   | Run in background                                             |
| `max_turns`     | `number`   | No       | Maximum agentic turns before stopping                         |
| `allowed_tools` | `string[]` | No       | Tools granted to this agent                                   |

- **Max result size:** 100,000 characters

---

### TaskStop

User-facing name: **Stop Task**. Stops a running background task.

| Parameter | Type     | Required | Description                    |
| --------- | -------- | -------- | ------------------------------ |
| `task_id` | `string` | No       | ID of the background task      |

---

### TaskOutput

User-facing name: **Task Output**. Retrieves output from a running or completed background task.

| Parameter | Type      | Required | Description                                    |
| --------- | --------- | -------- | ---------------------------------------------- |
| `task_id` | `string`  | Yes      | Task ID to get output from                     |
| `block`   | `boolean` | No       | Wait for completion (default: `true`)          |
| `timeout` | `number`  | No       | Max wait in ms (default: 30000, max: 600000)   |

---

### TaskCreate

Creates a new task in the task management system.

| Parameter     | Type     | Required | Description                      |
| ------------- | -------- | -------- | -------------------------------- |
| `subject`     | `string` | Yes      | Brief title for the task         |
| `description` | `string` | Yes      | Detailed description             |
| `activeForm`  | `string` | No       | Present continuous form for display (e.g. "Running tests") |
| `metadata`    | `object` | No       | Arbitrary metadata               |

---

### TaskGet

Retrieves a task by ID.

| Parameter | Type     | Required | Description         |
| --------- | -------- | -------- | ------------------- |
| `taskId`  | `string` | Yes      | ID of the task      |

---

### TaskUpdate

Updates an existing task's status, description, or dependencies.

| Parameter      | Type       | Required | Description                                |
| -------------- | ---------- | -------- | ------------------------------------------ |
| `taskId`       | `string`   | Yes      | ID of the task to update                   |
| `subject`      | `string`   | No       | New subject                                |
| `description`  | `string`   | No       | New description                            |
| `activeForm`   | `string`   | No       | Present continuous form for display        |
| `status`       | `enum`     | No       | `"pending"`, `"in_progress"`, `"completed"` |
| `addBlocks`    | `string[]` | No       | Task IDs that this task blocks             |
| `addBlockedBy` | `string[]` | No       | Task IDs that block this task              |
| `owner`        | `string`   | No       | New owner for the task                     |
| `metadata`     | `object`   | No       | Metadata to merge (set key to `null` to delete) |

---

### TaskList

Lists all tasks. **No parameters.**

---

## Planning & Organization Tools

### TodoWrite

Manages the agent's internal todo/checklist. Auto-allowed (no permission prompt).

| Parameter            | Type     | Required | Description                                     |
| -------------------- | -------- | -------- | ----------------------------------------------- |
| `todos`              | `array`  | Yes      | Array of todo items                             |
| `todos[].content`    | `string` | Yes      | What needs to be done                           |
| `todos[].status`     | `enum`   | Yes      | `"pending"`, `"in_progress"`, or `"completed"` |
| `todos[].activeForm` | `string` | Yes      | Present continuous form (e.g. "Fixing the bug") |

---

### EnterPlanMode

Requests permission to enter plan mode for complex tasks. **No parameters.**

---

### ExitPlanMode

Prompts the user to exit plan mode and begin implementation.

| Parameter          | Type      | Required | Description                              |
| ------------------ | --------- | -------- | ---------------------------------------- |
| `allowedPrompts`   | `array`   | No       | Permissions needed to implement the plan |
| `pushToRemote`     | `boolean` | No       | Push plan to a remote Claude.ai session  |
| `remoteSessionId`  | `string`  | No       | Remote session ID                        |
| `remoteSessionUrl` | `string`  | No       | Remote session URL                       |
| `remoteSessionTitle` | `string` | No      | Remote session title                     |
| `launchSwarm`      | `boolean` | No       | Launch a multi-agent swarm               |
| `teammateCount`    | `number`  | No       | Number of teammates to spawn             |

---

## Multi-Agent Tools

### Teammate

Spawns teammates and coordinates with other agents running in parallel. Only enabled in swarm mode.

| Parameter         | Type     | Required | Description                                                                 |
| ----------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `operation`       | `enum`   | Yes      | `"spawnTeam"`, `"cleanup"`, `"write"`, `"broadcast"`, `"requestShutdown"`, `"approveShutdown"`, `"rejectShutdown"`, `"approvePlan"`, `"rejectPlan"`, `"discoverTeams"`, `"requestJoin"`, `"approveJoin"`, `"rejectJoin"` |
| `name`            | `string` | No       | Your name when broadcasting                                                 |
| `key`             | `string` | No       | Key for stored data (write operation)                                       |
| `value`           | `string` | No       | Value to store as JSON string (write operation)                             |
| `target_agent_id` | `string` | No       | Recipient agent ID (write operation)                                        |
| `agent_type`      | `string` | No       | Type/role of the team lead                                                  |
| `team_name`       | `string` | No       | Team name for spawning                                                      |
| `proposed_name`   | `string` | No       | Proposed name when joining a team                                           |
| `capabilities`    | `string` | No       | Description of capabilities when joining                                    |
| `timeout_ms`      | `number` | No       | Timeout in ms for `requestJoin` (default: 60000)                            |

---

## Interaction & Intelligence Tools

### AskUserQuestion

Asks the user structured multiple-choice questions (1-4 questions).

| Parameter                         | Type      | Required | Description                                     |
| --------------------------------- | --------- | -------- | ----------------------------------------------- |
| `questions`                       | `array`   | Yes      | 1-4 question objects                            |
| `questions[].question`            | `string`  | Yes      | Question text (should end with `?`)             |
| `questions[].header`              | `string`  | Yes      | Short label (max ~20 chars)                     |
| `questions[].options`             | `array`   | Yes      | 2-4 choice objects                              |
| `questions[].options[].label`     | `string`  | Yes      | Display text (1-5 words)                        |
| `questions[].options[].description` | `string` | Yes     | Explanation of the option                       |
| `questions[].multiSelect`         | `boolean` | No       | Allow multiple selections (default: `false`)    |

---

### LSP

Interacts with Language Server Protocol servers for code intelligence. Only enabled when LSP servers are configured.

| Parameter   | Type     | Required | Description                                                                                                                  |
| ----------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `operation` | `enum`   | Yes      | `"goToDefinition"`, `"findReferences"`, `"hover"`, `"documentSymbol"`, `"workspaceSymbol"`, `"goToImplementation"`, `"prepareCallHierarchy"`, `"incomingCalls"`, `"outgoingCalls"` |
| `filePath`  | `string` | Yes      | Path to the file                                                                                                             |
| `line`      | `number` | Yes      | Line number (1-based)                                                                                                        |
| `character` | `number` | Yes      | Character offset (1-based)                                                                                                   |

---

### Skill

Executes a registered skill (custom command/workflow).

| Parameter | Type     | Required | Description                                   |
| --------- | -------- | -------- | --------------------------------------------- |
| `skill`   | `string` | Yes      | Skill name (e.g. `"commit"`, `"review-pr"`)   |
| `args`    | `string` | No       | Optional arguments                            |

---

### ToolSearch

Searches for deferred/lazy-loaded tools by name or keywords. Only enabled when deferred tools are active.

| Parameter     | Type     | Required | Description                                              |
| ------------- | -------- | -------- | -------------------------------------------------------- |
| `query`       | `string` | Yes      | Search query or `"select:<tool_name>"` for direct lookup |
| `max_results` | `number` | No       | Maximum number of results (default: 5)                   |

---

## MCP Tools

### mcp

Generic passthrough for [Model Context Protocol](https://modelcontextprotocol.io/) server tools. Acts as a bridge for dynamically loaded MCP tools (e.g. browser automation, GitHub, custom servers).

- **Parameters:** Empty object `{}`
- **Read-only:** No
- **Concurrency-safe:** No

---

### ListMcpResourcesTool

Lists available MCP resources.

| Parameter | Type     | Required | Description                        |
| --------- | -------- | -------- | ---------------------------------- |
| `server`  | `string` | No       | Server name to filter resources by |

---

### ReadMcpResourceTool

Reads an MCP resource by URI.

| Parameter | Type     | Required | Description         |
| --------- | -------- | -------- | ------------------- |
| `server`  | `string` | Yes      | MCP server name     |
| `uri`     | `string` | Yes      | Resource URI to read |

---

## Summary

| Category              | Tools                                                                     |
| --------------------- | ------------------------------------------------------------------------- |
| **File I/O**          | `Read`, `Edit`, `Write`, `NotebookEdit`                                   |
| **Search**            | `Grep`, `Glob`                                                            |
| **Shell**             | `Bash`                                                                    |
| **Web**               | `WebFetch`, `WebSearch`                                                   |
| **Agent / Task**      | `Task`, `TaskStop`, `TaskOutput`, `TaskCreate`, `TaskGet`, `TaskUpdate`, `TaskList` |
| **Planning**          | `TodoWrite`, `EnterPlanMode`, `ExitPlanMode`                              |
| **Multi-Agent**       | `Teammate`                                                                |
| **Interaction**       | `AskUserQuestion`, `LSP`, `Skill`, `ToolSearch`                           |
| **MCP**               | `mcp`, `ListMcpResourcesTool`, `ReadMcpResourceTool`                      |

**Total: 27 native tools**

All tool definitions extracted from the installed Claude Code package (`@anthropic-ai/claude-code` v2.1.19). Schemas are validated at runtime using Zod.
