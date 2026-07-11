# Ralph Wiggum Plugin

Implementation of the Ralph Wiggum technique for iterative, self-referential AI development loops in Claude Code.

## What is Ralph?

Ralph is a development methodology based on continuous AI agent loops. As Geoffrey Huntley describes it: **"Ralph is a Bash loop"** - a simple `while true` that repeatedly feeds an AI agent a prompt file, allowing it to iteratively improve its work until completion.

The technique is named after Ralph Wiggum from The Simpsons, embodying the philosophy of persistent iteration despite setbacks.

### Core Concept

This plugin implements Ralph using a **Stop hook** that intercepts Claude's exit attempts:

```bash
# You run ONCE:
/ralph-loop "Your task description" --completion-promise "DONE"

# Then Claude Code automatically:
# 1. Works on the task
# 2. Tries to exit
# 3. Stop hook blocks exit
# 4. Stop hook feeds the SAME prompt back
# 5. Repeat until completion, the plugin limit, or the runtime safety cap
```

The loop happens **inside your current session** - you don't need external bash loops. The Stop hook in `hooks/stop-hook.sh` creates the self-referential feedback loop by blocking normal session exit.

This creates a **self-referential feedback loop** where:
- The prompt never changes between iterations
- Claude's previous work persists in files
- Each iteration sees modified files and git history
- Claude autonomously improves by reading its own past work in files

## Quick Start

```bash
/ralph-loop "Build a REST API for todos. Requirements: CRUD operations, input validation, tests. Output <promise>COMPLETE</promise> when done." --completion-promise "COMPLETE" --max-iterations 8
```

Claude will:
- Implement the API iteratively
- Run tests and see failures
- Fix bugs based on test output
- Iterate until all requirements met
- Output the completion promise when done

## Commands

### /ralph-loop

Start a Ralph loop in your current session.

**Usage:**
```bash
/ralph-loop "<prompt>" --max-iterations <n> --completion-promise "<text>"
```

**Options:**
- `--max-iterations <n>` - Stop at iteration N; accepts 0 through 2147483647, where 0 means no plugin-defined limit
- `--completion-promise <text>` - Phrase that signals completion

### Stop-hook State Lifecycle

Ralph stores `iteration: 1` when a loop starts. Before each continuation, the
Stop hook writes the next iteration to the state file and returns a blocking
decision. For example, a limit of 3 produces two continuations (iterations 2
and 3); the following Stop sees that the limit is reached, removes the state
file, and allows the session to stop.

Claude Code marks a repeated Stop invocation with `stop_hook_active: true`.
Ralph processes that invocation normally so it can detect a completion tag or
reach the configured maximum. The state file is removed only when an exact
completion tag is found, the plugin iteration limit is reached, or
`/cancel-ralph` is run.

For current Stop payloads, Ralph checks the non-empty
`last_assistant_message` field directly, so the just-produced completion tag
does not depend on transcript write timing. Older payloads without that field
fall back to parsing the complete JSONL transcript; a missing or malformed
fallback transcript blocks safely and preserves the loop state.

Independently, the Claude Code runtime permits at most 8 consecutive Stop-hook
continuations. This runtime cap still applies when `--max-iterations` is 0 or
greater than 8. If the runtime ends the continuation chain before Ralph reaches
its own exit condition, the Ralph state file remains for explicit cancellation
with `/cancel-ralph`.

### /cancel-ralph

Cancel the active Ralph loop for the current Claude Code session. Each session
uses its own
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/ralph-loop/${CLAUDE_CODE_SESSION_ID}.local.md`
state file, so prompts stay outside the repository and parallel sessions do not
overwrite or cancel one another. The directory is private to the current user.
The project root is still resolved from `CLAUDE_PROJECT_DIR`, then the Git
top-level directory, so changing the session's working directory does not
detach the hook from its project safety boundary.

**Usage:**
```bash
/cancel-ralph
```

## Prompt Writing Best Practices

### 1. Clear Completion Criteria

❌ Bad: "Build a todo API and make it good."

✅ Good:
```markdown
Build a REST API for todos.

When complete:
- All CRUD endpoints working
- Input validation in place
- Tests passing (coverage > 80%)
- README with API docs
- Output: <promise>COMPLETE</promise>
```

### 2. Incremental Goals

❌ Bad: "Create a complete e-commerce platform."

✅ Good:
```markdown
Phase 1: User authentication (JWT, tests)
Phase 2: Product catalog (list/search, tests)
Phase 3: Shopping cart (add/remove, tests)

Output <promise>COMPLETE</promise> when all phases done.
```

### 3. Self-Correction

❌ Bad: "Write code for feature X."

✅ Good:
```markdown
Implement feature X following TDD:
1. Write failing tests
2. Implement feature
3. Run tests
4. If any fail, debug and fix
5. Refactor if needed
6. Repeat until all green
7. Output: <promise>COMPLETE</promise>
```

### 4. Escape Hatches

Always use `--max-iterations` as a safety net for impossible tasks. Claude Code
also force-stops a chain after 8 consecutive Stop-hook continuations:

```bash
# Recommended: Always set a reasonable iteration limit
/ralph-loop "Try to implement feature X" --max-iterations 8

# In your prompt, include what to do if stuck:
# "After 6 iterations, if not complete:
#  - Document what's blocking progress
#  - List what was attempted
#  - Suggest alternative approaches"
```

**Note**: The `--completion-promise` uses exact string matching, so you cannot use it for multiple completion conditions (like "SUCCESS" vs "BLOCKED"). Always rely on `--max-iterations` as your primary safety mechanism.

## Philosophy

Ralph embodies several key principles:

### 1. Iteration > Perfection
Don't aim for perfect on first try. Let the loop refine the work.

### 2. Failures Are Data
"Deterministically bad" means failures are predictable and informative. Use them to tune prompts.

### 3. Operator Skill Matters
Success depends on writing good prompts, not just having a good model.

### 4. Persistence Wins
Keep trying until success. The loop handles retry logic automatically.

## When to Use Ralph

**Good for:**
- Well-defined tasks with clear success criteria
- Tasks requiring iteration and refinement (e.g., getting tests to pass)
- Greenfield projects where you can walk away
- Tasks with automatic verification (tests, linters)

**Not good for:**
- Tasks requiring human judgment or design decisions
- One-shot operations
- Tasks with unclear success criteria
- Production debugging (use targeted debugging instead)

## Real-World Results

- Successfully generated 6 repositories overnight in Y Combinator hackathon testing
- One $50k contract completed for $297 in API costs
- Created entire programming language ("cursed") over 3 months using this approach

## Learn More

- Original technique: https://ghuntley.com/ralph/
- Ralph Orchestrator: https://github.com/mikeyobrien/ralph-orchestrator

## For Help

Run `/help` in Claude Code for detailed command reference and examples.
