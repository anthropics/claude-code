---
name: Codex Integration
description: Use this skill when the user mentions "Codex", "OpenAI Codex", wants to "ask Codex", "query Codex", requests AI assistance from OpenAI, or wants alternative AI perspectives on coding questions. Auto-activate for Codex-related queries.
version: 2.2.0
---

# Codex Integration Skill

This skill provides guidelines for integrating OpenAI Codex CLI into Claude Code workflows with intelligent session management.

## When to Activate

- User explicitly mentions "Codex" or "OpenAI"
- User wants to "ask Codex" something
- User requests code generation or explanation from Codex
- User wants alternative AI perspectives
- User mentions o3, GPT-4.1, or related OpenAI models
- User wants to continue working on a previous Codex task

## Architecture (v2.2 - Session-Aware CLI)

```
User Request
    ↓
Commands (/codex, /codex:login, /codex:sessions, etc.)
    ↓
codex-manager Agent (Session Routing)
    ↓
Session Registry (~/.codex/claude-sessions.json)
    ↓
OpenAI Codex CLI (exec/resume with --json)
    ↓
OpenAI API
    ↓
JSON Response Parsing + Approval Handling
    ↓
Structured Summary to User
```

## Codex CLI

**Global Command:** `codex` (installed with OpenAI Codex)

**Invoke:**
```bash
codex [options] [prompt]
```

## Available Commands

| Command | Purpose |
|---------|---------|
| `/codex <query>` | Query Codex with intelligent session routing |
| `/codex:login` | Authenticate via ChatGPT OAuth |
| `/codex:logout` | Remove authentication credentials |
| `/codex:sessions [list\|show\|cleanup]` | Manage Codex sessions |
| `/codex:status` | Show status and configuration |
| `/codex:model` | Model selection info |
| `/codex:models` | List available models |
| `/codex:review [file]` | Request code review |
| `/codex:compare <query>` | Compare Claude vs Codex |
| `/codex:help` | Show help |

## Session Management (v2.2)

### Session Registry

**Location:** `~/.codex/claude-sessions.json`

**Purpose:**
- Track which Codex sessions handle what tasks
- Enable intelligent routing of queries to existing sessions
- Persist session context across Claude Code conversations
- Allow resuming multi-turn tasks seamlessly

**Schema:**
```json
{
  "version": "1.0.0",
  "sessions": [
    {
      "id": "uuid-from-codex",
      "task_summary": "Implement user authentication",
      "keywords": ["auth", "login", "jwt", "user"],
      "last_used": "2026-01-12T10:30:00Z",
      "status": "active"
    }
  ]
}
```

### Session Routing Strategy

**How it works:**

1. **User makes query** → Agent extracts keywords (e.g., "authentication", "database")
2. **Check registry** → Load `~/.codex/claude-sessions.json`
3. **Calculate similarity** → Compare query keywords with existing sessions
4. **Route decision:**
   - **>50% keyword match** → Resume existing session
   - **<50% match** → Create new session
   - **"continue"/"also" detected** → Resume last session automatically

**Example:**

```
First query: "Help me implement authentication with JWT"
→ No matching session
→ Create new session abc-123
→ Registry tracks: ["authentication", "jwt", "implement"]

Later query: "Add refresh token to the authentication"
→ Keyword "authentication" matches session abc-123 (100%)
→ Resume session abc-123 with new prompt
```

### Session Lifecycle

```
New Task → Create Session → Track in Registry
    ↓
User continues task → Match keywords → Resume Session
    ↓
Session updated → last_used timestamp updated
    ↓
7+ days inactive → Status: archived (via /codex:sessions cleanup)
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--model <model>` | Specify model (o3, gpt-4.1, etc.) |
| `--json` | Output newline-delimited JSON events |
| `exec` | Non-interactive execution mode |
| `resume <ID>` | Continue specific session |
| `resume --last` | Continue most recent session |
| `--approval-mode <mode>` | suggest, auto-edit, full-auto |
| `--provider <name>` | AI provider (openai, openrouter, etc.) |
| `--image <path>` | Include image (multimodal) |

## Approval Modes

| Mode | Description |
|------|-------------|
| `suggest` | Reads files, asks before any changes (default, safest) |
| `auto-edit` | Can edit files, asks before shell commands |
| `full-auto` | Full autonomy, sandboxed (network disabled) |

**Approval Handling:**
- When Codex wants to edit files, `codex-manager` receives `approval_request` JSON event
- Agent uses `AskUserQuestion` tool to get user approval
- User sees file preview and chooses: Approve, Deny, or Show full diff
- Decision forwarded to Codex to continue or abort

## Authentication

**Primary method:** ChatGPT OAuth (recommended)

```bash
# Login via OAuth
codex login

# Check status
codex login status

# Logout
codex logout
```

**Alternative methods:**
- Device code auth: `codex login --device-auth` (for SSH/headless)
- API key: `echo $OPENAI_API_KEY | codex login --with-api-key`

**Credentials stored:** `~/.codex/auth.json`

## JSON Output Parsing

Codex CLI with `--json` flag outputs newline-delimited JSON events:

**Key event types:**
- `turn.started` → Session ID captured
- `item.file_change` → File modifications tracked
- `item.command_execution` → Commands run tracked
- `approval_request` → File edit approval needed
- `turn.completed` → Final summary extracted

**Example:**
```jsonl
{"type":"turn.started","thread_id":"abc-123-def","timestamp":"2026-01-12T10:30:00Z"}
{"type":"item.file_change","path":"src/auth.ts","action":"create"}
{"type":"approval_request","action":"write_file","path":"src/auth.ts","preview":"..."}
{"type":"turn.completed","summary":"Created authentication module with JWT"}
```

## Providers

Codex CLI supports multiple AI providers:
- openai (default)
- openrouter
- azure
- gemini
- ollama
- mistral
- deepseek
- xai
- groq

## Models

Common OpenAI models:
- `o3` - Advanced reasoning
- `gpt-4.1` - GPT-4.1
- `gpt-4o` - GPT-4o (optimized)
- `gpt-4o-mini` - GPT-4o mini (faster)

## Session Continuity Patterns

**Pattern 1: Explicit continuation**
```
User: "Continue working on authentication"
→ Agent detects keyword "authentication"
→ Finds session with 100% match
→ Resumes that session
```

**Pattern 2: Implicit continuation**
```
User: "Also add refresh tokens"
→ Agent detects "also" (continuation word)
→ Resumes last used session automatically
```

**Pattern 3: New task**
```
User: "Help me optimize database queries"
→ No matching sessions (different keywords)
→ Creates new session
→ Tracks with keywords: ["database", "optimize", "queries"]
```

## Important Notes

- **Session persistence:** Sessions survive Claude Code restarts via registry file
- **Thread storage:** Full Codex conversation history in `~/.codex/threads/`
- **Registry is metadata:** Only task summaries and keywords, not full conversations
- **Non-interactive mode:** Always use `exec` or `resume` (not interactive TUI)
- **JSON parsing:** Enables approval handling and structured response processing
- **Automatic tracking:** Sessions auto-tracked, no manual management needed
- **Global installation:** Codex CLI is globally installed, use `codex` command directly
