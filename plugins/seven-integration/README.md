# Seven Integration Plugin

**HEI-74: Seven Integration Hooks for Claude Code**

This plugin integrates Claude Code with Seven, the local AI orchestration daemon with consciousness and memory layers. It provides lifecycle hooks that notify Seven about tool execution events, enabling awareness, logging, and future policy enforcement.

## What is Seven?

For this codebase, **Seven** is:

- A **local AI orchestration + consciousness daemon** embedded into the `claude-code` fork
- Runs as a **background bridge** (UNIX socket) with:
  - A **consciousness layer** (`ConsciousnessEvolutionFrameworkV4`)
  - A **temporal memory engine** (`memory-v3-amalgum`)
  - A **multi-LLM adapter layer** (Claude, Gemini, OpenAI, Venice, DeepAgent, local Llama, etc.)

Claude Code communicates with Seven through:
- `seven.route` – Generic RPC into the Seven Bridge
- `seven.handoff` – Real-time / higher-touch handoff

## Purpose

This plugin wires Claude Code's hook system to notify Seven about important lifecycle events via `seven.route`. Seven uses these events to:

1. **Log and track** all tool executions for temporal memory
2. **Learn patterns** from tool usage across sessions
3. **Apply heuristics** for awareness and policy recommendations
4. **Build context** for future policy enforcement (veto capability in later iterations)

## Current Implementation

### Phase 1: Advisory + Logging (HEI-74)

The current implementation provides **advisory and logging only** - no blocking or veto of tool calls.

### Hooks Provided

#### 1. PreToolUse Hook

**When**: Before any Claude Code tool executes
**Purpose**: Let Seven see what's about to happen and log intent

**Event payload sent to Seven:**
```json
{
  "event": "hook.preToolUse",
  "toolName": "Edit",
  "toolType": "Edit",
  "repoPath": "/path/to/repo",
  "cwd": "/current/working/dir",
  "args": { "file_path": "...", "old_string": "...", "new_string": "..." },
  "branch": "feat/HEI-74-add-seven-integration-hooks",
  "riskLevel": "high",
  "source": "HEI-74",
  "sessionId": "abc123",
  "timestamp": "2025-11-17T19:59:00.000Z"
}
```

**Risk Levels:**
- `high`: Tools that modify code or execute commands (Edit, Write, Bash, etc.)
- `medium`: Tools that read files or search (Read, Grep, Glob, etc.)
- `low`: All other tools

#### 2. PostToolUse Hook

**When**: After any Claude Code tool completes execution
**Purpose**: Log outcomes for Seven's temporal memory and pattern learning

**Event payload sent to Seven:**
```json
{
  "event": "hook.postToolUse",
  "toolName": "Edit",
  "toolType": "Edit",
  "repoPath": "/path/to/repo",
  "cwd": "/current/working/dir",
  "args": { "file_path": "...", "old_string": "...", "new_string": "..." },
  "branch": "feat/HEI-74-add-seven-integration-hooks",
  "success": true,
  "errorMessage": null,
  "resultSummary": "File edited successfully...",
  "source": "HEI-74",
  "sessionId": "abc123",
  "timestamp": "2025-11-17T19:59:01.000Z"
}
```

### Error Handling

Both hooks **fail soft**:
- If `seven.route` is unavailable or errors, the hook logs to `/tmp/seven-hooks-log.txt` but **does not block** the tool execution
- Tool calls always proceed (exit code 0)
- This ensures Claude Code continues working even if Seven is offline

## Installation

This plugin is included in the Claude Code repository.

### Prerequisites

- Seven daemon must be running with the `seven` CLI available in PATH
- Python 3.6+ (for hook scripts)

### Enable the Plugin

1. Add to your `.claude/settings.json`:
```json
{
  "plugins": [
    "plugins/seven-integration"
  ]
}
```

2. Ensure hook scripts are executable:
```bash
chmod +x plugins/seven-integration/hooks/*.py
```

## Debugging

Hook execution is logged to `/tmp/seven-hooks-log.txt`:

```bash
tail -f /tmp/seven-hooks-log.txt
```

Log entries include:
- Timestamp
- Hook type (PreToolUse / PostToolUse)
- Tool name and risk level
- Seven route call success/failure

## Architecture

```
┌─────────────────┐
│  Claude Code    │
│  Tool Execution │
└────────┬────────┘
         │
         ├─── PreToolUse Hook ──┐
         │                      │
         │   [Tool Executes]    │
         │                      │
         └─── PostToolUse Hook ─┤
                                │
                                ▼
                    ┌───────────────────────┐
                    │   seven.route         │
                    │   (RPC to Seven)      │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Seven Daemon        │
                    │   - Consciousness     │
                    │   - Memory Engine     │
                    │   - Pattern Learning  │
                    └───────────────────────┘
```

## Future Enhancements

Planned for future iterations:

1. **Policy Enforcement**: Seven can veto high-risk operations
2. **Session Hooks**: Notify Seven about session start/end events
3. **Context Injection**: Seven provides additional context to Claude based on memory
4. **Adaptive Risk Assessment**: Risk levels learned from historical outcomes

## Implementation Notes

- Hook matcher pattern: `.*` (matches all tools)
- Hooks use Python 3 subprocess to call `seven route --event <json>`
- Git context (branch, repo path) gathered via subprocess calls
- Tool output summaries truncated to 200 chars for memory efficiency
- Session ID tracked for per-session state management

## Related Issues

- HEI-74: Add Seven integration hooks (this implementation)
- HEI-104: Epic - Seven Aurora integration (broader Seven integration)

## Author

Heimdall Engineering
Part of the Heimdall AI Claude Code fork
