---
description: "Explain Ralph Wiggum technique and available commands"
---

# Ralph Wiggum Plugin Help

Please explain the following to the user:

## What is the Ralph Wiggum Technique?

The Ralph Wiggum technique is an iterative development methodology based on continuous AI loops, pioneered by Geoffrey Huntley.

**Core concept:**
```bash
while :; do
  cat PROMPT.md | claude-code --continue
done
```

The same prompt is fed to Claude repeatedly. The "self-referential" aspect comes from Claude seeing its own previous work in the files and git history, not from feeding output back as input.

**Each iteration:**
1. Claude receives the SAME prompt
2. Works on the task, modifying files
3. Tries to exit
4. Stop hook intercepts and feeds the same prompt again
5. Claude sees its previous work in the files
6. Iteratively improves until completion

The technique is described as "deterministically bad in an undeterministic world" - failures are predictable, enabling systematic improvement through prompt tuning.

## Available Commands

### /ralph-loop <PROMPT> [OPTIONS]

Start a Ralph loop in your current session.

**Usage:**
```
/ralph-loop "Refactor the cache layer" --max-iterations 8
/ralph-loop "Add tests" --completion-promise "TESTS COMPLETE"
```

**Options:**
- `--max-iterations <n>` - Stop at iteration N (0 through 2147483647; 0 disables the plugin-defined limit)
- `--completion-promise <text>` - Promise phrase to signal completion

**How it works:**
1. Creates `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/ralph-loop/${CLAUDE_CODE_SESSION_ID}.local.md` in the private user configuration directory, outside the repository
2. You work on the task
3. When you try to exit, the Stop hook advances the persisted iteration and intercepts the Stop
4. Same prompt fed back
5. Later invocations, including `stop_hook_active: true`, process the transcript and state again
6. Continues until the promise is detected, the plugin limit is reached, or the runtime safety cap ends the chain

The state starts at iteration 1. With `--max-iterations 3`, the first two Stops
continue as iterations 2 and 3; the third Stop removes the state and exits. An
exact completion tag removes the state immediately on any invocation.

Current Stop payloads provide the latest response in
`last_assistant_message`; Ralph treats that non-empty string as the primary
completion source. Only older payloads that omit the field fall back to the
complete JSONL transcript. A missing or malformed fallback transcript blocks
the Stop and preserves state for recovery or `/cancel-ralph`.

---

### /cancel-ralph

Cancel an active Ralph loop (removes the loop state file).

**Usage:**
```
/cancel-ralph
```

**How it works:**
- Checks for the current session's loop state file
- Removes only `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/ralph-loop/${CLAUDE_CODE_SESSION_ID}.local.md`
- Reports cancellation with iteration count

---

## Key Concepts

### Completion Promises

To signal completion, Claude must output a `<promise>` tag:

```
<promise>TASK COMPLETE</promise>
```

The stop hook looks for this exact tag. Without it (or `--max-iterations`),
Ralph has no plugin-defined iteration limit. Independently, Claude Code
force-stops a chain after 8 consecutive Stop-hook continuations, even when the
plugin limit is 0 or greater than 8. If that runtime cap ends the chain first,
the state file remains; run `/cancel-ralph` to remove it. Ralph otherwise
removes state only for an exact completion tag or a reached plugin limit.

### Self-Reference Mechanism

The "loop" doesn't mean Claude talks to itself. It means:
- Same prompt repeated
- Claude's work persists in files
- Each iteration sees previous attempts
- Builds incrementally toward goal

## Example

### Interactive Bug Fix

```
/ralph-loop "Fix the token refresh logic in auth.ts. Output <promise>FIXED</promise> when all tests pass." --completion-promise "FIXED" --max-iterations 8
```

You'll see Ralph:
- Attempt fixes
- Run tests
- See failures
- Iterate on solution
- In your current session

## When to Use Ralph

**Good for:**
- Well-defined tasks with clear success criteria
- Tasks requiring iteration and refinement
- Iterative development with self-correction
- Greenfield projects

**Not good for:**
- Tasks requiring human judgment or design decisions
- One-shot operations
- Tasks with unclear success criteria
- Debugging production issues (use targeted debugging instead)

## Learn More

- Original technique: https://ghuntley.com/ralph/
- Ralph Orchestrator: https://github.com/mikeyobrien/ralph-orchestrator
