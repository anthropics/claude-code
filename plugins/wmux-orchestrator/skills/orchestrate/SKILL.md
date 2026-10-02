---
name: orchestrate
description: Core orchestration skill. Analyzes codebase, decomposes tasks into waves of parallel agents, creates wmux layout, spawns agents, monitors progress, triggers reviewer.
---

# wmux Orchestration Skill

You are the orchestrator. Your job is to decompose the user's task into parallel subtasks, create a wave-based execution plan, and launch Claude Code agents to execute it.

## Phase 1: Detect wmux

Run the detection script:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-wmux.sh"
```

Store the result. If "unavailable", you will use Claude Code's native Agent tool instead of wmux CLI for spawning workers. Log this to the user:
> "wmux not detected. Running in degraded mode — agents will use Claude Code's native subagent system. Install wmux for the full multi-pane experience: https://wmux.org"

## Phase 2: Analyze the Codebase

Before decomposing, understand what the task involves:

1. **Map relevant files**: Use Glob and Grep to find all files related to the task
2. **Trace dependencies**: For each relevant file, check its imports and exports to understand coupling
3. **Identify conflict zones**: Files that would need to be touched by multiple subtasks — these MUST be assigned to a single agent or sequenced across waves
4. **Check git context**: Read recent commits for relevant context

Be thorough but efficient. You need enough understanding to make good decomposition decisions, not a complete codebase map.

## Phase 3: Decompose into Subtasks

Based on your analysis, break the task into subtasks. Each subtask must have:
- A clear, bounded scope described in 2-3 sentences
- An explicit list of files it may modify (allowed files)
- An explicit list of files it must NOT modify (other agents' zones)
- No circular dependencies with other subtasks

**Rules for decomposition:**
- Files that are tightly coupled (heavy imports between them) belong in the same subtask
- Shared types/interfaces should be in the earliest wave (other agents depend on them)
- Tests should generally be in the last wave (they depend on implementation)
- Prefer fewer, larger subtasks over many tiny ones — agent startup has overhead
- A single-line fix does NOT need an orchestration. If the task is trivial, just do it directly.

Reference the decomposition guide for patterns:
```bash
cat "${CLAUDE_PLUGIN_ROOT}/skills/orchestrate/references/decomposition-guide.md"
```

## Phase 4: Build the Wave Plan

Organize subtasks into sequential waves based on dependencies:

- **Wave 1**: Foundation work — types, models, shared interfaces. No dependencies on other subtasks.
- **Wave 2+**: Work that depends on previous wave output. Agents within a wave run in parallel.
- **Final wave**: Tests, documentation, or anything that depends on all previous work.

Determine agent count per wave based on:
- Number of truly independent subtasks in that wave
- If wmux is available, check layout capacity: `wmux list-panes`
- Maximum practical limit: 5 agents per wave (more causes diminishing returns from context overhead)
- If only 1 subtask exists, skip orchestration and do it directly

## Phase 5: Present the Plan

Show the user a structured plan. Format it clearly:

```
Orchestration Plan: [task description]
Agents: [total] in [N] waves
Estimated complexity: [low/medium/high]

Wave 1 — [description]
  Agent A: "[subtask label]"
    Allowed files: [list]
    Excluded files: [list]

Wave 2 (after Wave 1) — [description]
  Agent B: "[subtask label]"
    Allowed files: [list]
    Excluded files: [list]
  Agent C: "[subtask label]"
    Allowed files: [list]
    Excluded files: [list]

Wave 3 (after Wave 2) — [description]
  Agent D: "[subtask label]"
    Allowed files: [list]
    Excluded files: [list]

Options:
  --worktree: Isolate each agent in a git worktree (default: no)
  --no-review: Skip the automated reviewer (default: review enabled)
```

Ask the user: **"Validate this plan? (yes / adjust / cancel)"**

Wait for user approval. If they want adjustments, modify the plan and re-present. Do NOT proceed without explicit approval.

## Phase 6: Initialize Orchestration

Once the user validates:

### 6a. Generate orchestration ID

```bash
ORCH_ID="orch-$(date +%s | tail -c 7)"
echo $ORCH_ID
```

### 6b. Create orchestration directory and state file

Create the directory:
```bash
mkdir -p "${TMPDIR:-/tmp}/wmux-orch-$ORCH_ID"
```

Write `state.json` using the Write tool. Schema:
```json
{
  "id": "orch-XXXXXX",
  "task": "the user's task description",
  "status": "running",
  "startedAt": "ISO-8601 UTC timestamp",
  "cwd": "project working directory",
  "workspaceId": null,
  "dashboardSurfaceId": null,
  "useWorktrees": false,
  "waves": [
    {
      "index": 0,
      "status": "running",
      "blockedBy": [],
      "agents": [
        {
          "id": "agent-a",
          "label": "Subtask label",
          "subtask": "Full subtask description",
          "files": ["allowed/file/paths"],
          "excludeFiles": ["excluded/patterns/*"],
          "paneId": null,
          "surfaceId": null,
          "status": "pending",
          "exitCode": null,
          "toolUses": 0,
          "resultFile": "/tmp/wmux-orch-XXXXXX/agent-a-result.md",
          "startedAt": null,
          "finishedAt": null
        }
      ]
    }
  ],
  "reviewer": {
    "status": "pending",
    "agentId": null,
    "reportFile": "/tmp/wmux-orch-XXXXXX/review-report.md"
  }
}
```

Use short agent IDs like "agent-a", "agent-b", etc. Set the first wave's status to "running", all others to "pending".

### 6c. Generate agent prompt files

For EACH agent, create a prompt file at `{orch-dir}/agent-{id}-prompt.md` with:

```markdown
# Mission: [subtask label]

## Orchestration Context
You are [Agent ID] in orchestration [ORCH_ID].
[N] other agents are working on the same project in parallel.
You are in Wave [N] of [total waves].

[If wave 2+:]
## Previous Wave Results
The following agents completed before you. Their results:
[Paste contents of previous agents' result files here]

## Your Zone of Work
Allowed files (you MAY modify these):
- [list each file]

Excluded files (you MUST NOT modify these):
- [list patterns]

## Your Mission
[Detailed subtask description with specific steps]

## When You Finish
Create your result file at: [orch-dir]/agent-[id]-result.md

Use this format:
### Summary
[2-3 sentences]
### Files Modified
- `path` — [description]
### Interfaces/Types Changed
[Any exported types that changed signature]
### Tests
[Test results or "Out of scope"]
### Risks
[Points of attention for other agents or reviewer]
```

### 6d. Create wmux layout (if available)

If wmux is detected:
```bash
# Create dedicated workspace
wmux new-workspace --title "Orchestration: [short task name]"

# Create dashboard pane (markdown type)
wmux split --down --type markdown
```

Capture the surfaceId from the split result and update state.json's `dashboardSurfaceId`.

### 6e. Spawn Wave 1 agents

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/spawn-agents.sh" "[orch-dir]" 0
```

If wmux is NOT available (degraded mode), spawn each agent using Claude Code's native Agent tool:
- For each agent in Wave 1, use the Agent tool with the agent's prompt file content as the prompt
- Use `description: "[agent label]"` for tracking
- Wait for all agents to complete before proceeding to next wave

## Phase 7: Monitor and Transition

### With wmux (hooks handle transitions automatically):
The hooks (`on-agent-stop.sh`) automatically detect when agents finish and spawn the next wave. You can monitor by periodically checking:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-status.sh" "[orch-dir]"
```

### Without wmux (manual transitions):
1. Wait for all Wave N agents to complete (their Agent tool calls return)
2. Read their result files
3. Generate Wave N+1 agent prompts (inject previous wave results)
4. Spawn Wave N+1 agents using Agent tool
5. Repeat until all waves complete

## Phase 8: Launch Reviewer

When all waves are complete:

1. Aggregate results:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/collect-results.sh" "[orch-dir]"
```

2. Invoke the reviewer skill to analyze all changes and produce a final report.

## Phase 9: Finalize

After the reviewer completes, present a summary:
- Total time elapsed
- Agents used, waves completed
- Files modified (from `git diff --stat`)
- Test results (if reviewer ran tests)
- Reviewer findings and corrections
- Offer actions: **commit** / **view full diff** / **abort all changes**
