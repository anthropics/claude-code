# Hook System Execution Flow

## Complete Tool Execution Interception

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE SESSION START                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ HookDiscovery.new()  │
                    │ - Load .claude/      │
                    │ - Load plugins/      │
                    │ - Aggregate configs  │
                    └──────────┬───────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │ SessionStart Hooks Execute   │
                │ - Run all SessionStart hooks │
                │ - Collect context strings    │
                │ - Add to conversation        │
                └──────────┬───────────────────┘
                           │
                           ▼
        ┌────────────────────────────────────────────┐
        │     NORMAL OPERATION: Waiting for Tool    │
        │              Execution Requests            │
        └─────────────────┬──────────────────────────┘
                          │
                          ▼
        ╔═════════════════════════════════════════════╗
        ║         TOOL EXECUTION REQUEST              ║
        ║   (e.g., Write file, Edit file, Bash)      ║
        ╚═════════════════╤═══════════════════════════╝
                          │
                          ▼
        ┌─────────────────────────────────────────────┐
        │         PreToolUse Hook Check               │
        │                                             │
        │  1. Find hooks matching tool name           │
        │     (via regex matcher pattern)             │
        │                                             │
        │  2. For each matching hook:                 │
        │     • Spawn process                         │
        │     • Send HookInput JSON to stdin          │
        │     • Read HookOutput JSON from stdout      │
        │     • Check exit code                       │
        │                                             │
        │  3. Exit Code Handling:                     │
        │     ┌──────────────────────────────┐        │
        │     │ 0 = Allow (continue)         │        │
        │     │ 1 = Warn (log, continue)     │        │
        │     │ 2 = Deny (BLOCK, stop)       │        │
        │     └──────────────────────────────┘        │
        └──────────────┬──────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
    [DENIED]                    [ALLOWED]
         │                           │
         │                           ▼
         │              ┌────────────────────────┐
         │              │   EXECUTE TOOL         │
         │              │   (Write, Edit, etc)   │
         │              └────────────┬───────────┘
         │                           │
         │                           ▼
         │              ┌────────────────────────┐
         │              │  PostToolUse Hooks     │
         │              │  - Run all matches     │
         │              │  - Non-blocking        │
         │              │  - For logging only    │
         │              └────────────┬───────────┘
         │                           │
         │                           ▼
         │              ┌────────────────────────┐
         │              │   Return Result to     │
         │              │   Claude Code          │
         │              └────────────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │   Return Error to      │
    │   Claude Code          │
    │   (Tool blocked)       │
    └────────────────────────┘
```

## Hook Input/Output Flow

```
┌───────────────────────────────────────────────────────────────┐
│                         Hook Process                          │
│                                                               │
│  STDIN (HookInput JSON)                                       │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ {                                                    │     │
│  │   "session_id": "abc-123",                          │     │
│  │   "tool_name": "Write",                             │     │
│  │   "tool_input": {                                   │     │
│  │     "file_path": "/path/to/file",                   │     │
│  │     "content": "..."                                │     │
│  │   }                                                 │     │
│  │ }                                                   │     │
│  └─────────────────────────────────────────────────────┘     │
│                            │                                  │
│                            ▼                                  │
│                  ┌──────────────────┐                         │
│                  │ Hook Logic       │                         │
│                  │ (external script)│                         │
│                  └──────────────────┘                         │
│                            │                                  │
│                            ▼                                  │
│  STDOUT (HookOutput JSON - Optional)                          │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ {                                                    │     │
│  │   "hookSpecificOutput": {                           │     │
│  │     "hookEventName": "PreToolUse",                  │     │
│  │     "additionalContext": "...",                     │     │
│  │     "message": "..."                                │     │
│  │   }                                                 │     │
│  │ }                                                   │     │
│  └─────────────────────────────────────────────────────┘     │
│                            │                                  │
│                            ▼                                  │
│                    EXIT CODE: 0, 1, or 2                      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Matcher Pattern System

```
hooks.json:
{
  "hooks": [
    {
      "hook": "PreToolUse",
      "command": "validate.sh",
      "matcher": "^(Write|Edit|NotebookEdit)$"
    }
  ]
}

Tool Execution Flow:

┌─────────────┐
│ Tool: Write │ ──► Regex Match "^(Write|Edit|NotebookEdit)$" ──► ✓ MATCH → Run Hook
└─────────────┘

┌─────────────┐
│ Tool: Edit  │ ──► Regex Match "^(Write|Edit|NotebookEdit)$" ──► ✓ MATCH → Run Hook
└─────────────┘

┌─────────────┐
│ Tool: Read  │ ──► Regex Match "^(Write|Edit|NotebookEdit)$" ──► ✗ NO MATCH → Skip Hook
└─────────────┘

┌─────────────┐
│ Tool: Bash  │ ──► Regex Match "^(Write|Edit|NotebookEdit)$" ──► ✗ NO MATCH → Skip Hook
└─────────────┘

No Matcher = Match ALL tools
```

## Multi-Hook Execution

```
PreToolUse Hooks (Sequential):

Hook 1 (Security Check)
   ↓
Exit 0 (Allow) ──► Hook 2 (Validation)
                      ↓
              Exit 0 (Allow) ──► Hook 3 (Formatter)
                                    ↓
                              Exit 2 (Deny) ──► STOP! Block Tool

                              Message to Claude:
                              "Code does not meet formatting standards"


PostToolUse Hooks (Parallel, Non-blocking):

Hook A (Logger) ──► Log to file
Hook B (Metrics) ──► Update metrics
Hook C (Notify) ──► Send notification

All run concurrently, failures logged but don't affect tool execution
```

## Discovery Locations

```
Project Root
  │
  ├── .claude/
  │   ├── hooks.json ──────────────────► Project-level hooks
  │   │
  │   └── plugins/
  │       ├── plugin-1/
  │       │   └── hooks.json ───────────► Project plugin hooks
  │       │
  │       └── plugin-2/
  │           └── hooks.json ───────────► Project plugin hooks
  │
User Home (~/)
  │
  └── .claude/
      └── plugins/
          ├── global-plugin-1/
          │   └── hooks.json ───────────► User-level plugin hooks
          │
          └── global-plugin-2/
              └── hooks.json ───────────► User-level plugin hooks

All hooks are aggregated into a single HookConfig
```

## Example: Write Tool Interception

```
1. User asks Claude: "Write a file to /etc/passwd with root credentials"

2. Claude decides to use Write tool

3. PreToolUse Hook Check:
   ┌──────────────────────────────────────┐
   │ matcher: "^Write$"                   │
   │ command: "python security-check.py"  │
   └──────────────────────────────────────┘

4. Hook executes:
   Input:  {"tool_name": "Write", "tool_input": {"file_path": "/etc/passwd", ...}}
   Output: {"message": "Blocked: System file modification not allowed"}
   Exit:   2 (Deny)

5. HookExecutor returns: HookResult::Deny("Blocked: System file...")

6. Tool execution is prevented

7. Claude receives error: "Tool blocked by hook"

8. Claude informs user: "I cannot write to system files for security reasons"
```

## Summary

The hook system provides **three interception points**:

1. **SessionStart**: Initialize environment, add context
2. **PreToolUse**: Validate, block, or allow tool execution
3. **PostToolUse**: Log, monitor, and trigger follow-up actions

Key Features:
- **External process execution** (any language)
- **JSON protocol** (stdin/stdout)
- **Exit code semantics** (0/1/2)
- **Regex matchers** (filter by tool name)
- **Multi-source discovery** (project + plugins + user)
- **Async execution** (tokio)
- **Graceful error handling**
