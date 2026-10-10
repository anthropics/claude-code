---
description: Submit a single task to the keepalive swarm kanban. Daemon picks it up and dispatches via `claude --print`.
argument-hint: "<prompt> [--head builder|scanner|reviewer|merger|test-runner|auditor] [--title <text>]"
allowed-tools: ["Bash"]
---

# /swarm-submit — single-task submission to the keepalive swarm

Submits one free-form task to the running daemon's kanban. The daemon's `wait_for_work` loop claims it and dispatches it via `claude --print` (session-resistant — survives your CLI exit).

**Prompt:** $ARGUMENTS

## Prerequisite

The daemon must be running. Check with `/swarm-status` or start with `/swarm-start`.

## What this does

1. Parses $ARGUMENTS into prompt + optional --head + optional --title
2. Calls `claude-swarm submit --home ~/.claude/swarm --title "<title>" --prompt "<prompt>" --head <head>`
3. Prints the new task id
4. Reminds the operator how to inspect progress (`/swarm-status` / `claude-swarm list`)

## Bash to run

```sh
# Parse the user's $ARGUMENTS — first positional becomes the prompt, --head and --title are optional
HEAD="builder"
TITLE=""
PROMPT=""
# (Implementation: claude reads $ARGUMENTS and constructs the call. See "Note for Claude" below.)
claude-swarm submit \
    --home "$HOME/.claude/swarm" \
    --title "${TITLE:-${PROMPT:0:60}}" \
    --prompt "$PROMPT" \
    --head "$HEAD"
```

## Note for Claude (the assistant invoking this command)

When the operator invokes this command, you (Claude) should:

1. Parse $ARGUMENTS — interpret leading text as the prompt, recognize `--head <x>` and `--title "<text>"` flags
2. If no `--title` was given, derive one from the first 60 chars of the prompt
3. Run the Bash above with the parsed values
4. Echo the returned task id to the operator with one line of context: "Submitted task `<id>` to the keepalive swarm — daemon will dispatch it shortly."

## Example uses

```
# Quick 30-second background sleep — test session-resistance
/swarm-submit "sleep 30; echo 'still alive!' > /tmp/swarm-keepalive-proof.txt" --head builder --title "keepalive sanity check"

# Real work — let the daemon do the audit while you go to lunch
/swarm-submit "Audit ./src for unused imports. Return a list of file:line to delete." --head auditor

# Multi-step task that may take an hour
/swarm-submit "Run the full integration test suite on this branch. If anything fails, summarize the top 3 root causes." --head test-runner
```

## After submission

- `/swarm-status` — see daemon liveness + DAG topology + head activity
- `claude-swarm list --home ~/.claude/swarm` — every task with status + head + title
- `claude-swarm list --home ~/.claude/swarm --status done` — filter by status
- `claude-swarm status --home ~/.claude/swarm` — JSON snapshot of kanban + supervisor state
- `claude-swarm unblocked --home ~/.claude/swarm` — the topological frontier (ready-to-dispatch tasks)
- `tail -f ~/.claude/swarm/global-mind.jsonl | jq .` — live event stream (one JSONL line per supervisor dispatch)

## Session-resistance contract

After you submit, you can:
1. Exit Claude Code (`/exit` or close terminal)
2. Wait
3. Come back via `claude --resume` (or just a fresh `claude`)
4. The task continues running the whole time — the daemon's subprocess is in a different process group
5. Run `/swarm-status` or `claude-swarm list` and see the task is `done` (or still `in_progress`)

This is what makes the swarm session-resistant. The "agent" in this model is the daemon-dispatched `claude --print` subprocess, not an in-session Agent-tool spawn.

## Limits

- One prompt per submission. For multi-task DAGs, use `/swarm-spawn`.
- Default head is `builder`; specify `--head` to use a role-typed agent (Scanner / Reviewer / etc.).
- Cost is whatever the dispatched `claude --print` consumes; daemon enforces `cost_cap_usd` from `SupervisorConfig` (default $10 per supervisor run).
