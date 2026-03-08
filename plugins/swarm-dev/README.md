# Swarm Dev Plugin

A bounded multi-agent workflow plugin for repositories that need structured research, scoped implementation, and explicit verification loops before GitHub handoff.

## Overview

`swarm-dev` adds a single orchestration command and five specialized agents that map directly to a repeatable delivery workflow:

1. Research the problem from three angles in parallel.
2. Synthesize the findings into a scoped MVP batch.
3. Implement that batch with a dedicated builder agent.
4. Verify the result with a strict pass/fail verifier.
5. Repeat only on blocking issues until the work is ready for commit or PR preparation.

The plugin is designed to stop once the output is good enough to submit, rather than drifting into open-ended refinement.

## Included components

### Command
- `/swarm-dev` - Orchestrates the full workflow from scoping through GitHub handoff readiness.

### Agents
- `pain-researcher` - Identifies pain points, desired outcomes, constraints, MVP boundaries, and scope guards.
- `architecture-researcher` - Maps repository structure, integration points, critical files, and reusable patterns.
- `task-breakdown-researcher` - Produces the task graph, first implementation batch, acceptance criteria, and dependency notes.
- `builder` - Implements only the currently scoped batch.
- `verifier` - Returns `Decision: PASS` or `Decision: FAIL`, separating blocking issues from non-blocking follow-ups.

## Standard structure

```text
swarm-dev/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   └── swarm-dev.md
├── agents/
│   ├── pain-researcher.md
│   ├── architecture-researcher.md
│   ├── task-breakdown-researcher.md
│   ├── builder.md
│   └── verifier.md
└── README.md
```

## Workflow phases

### 1. Scope the task
The command clarifies the repo, goal, and requested MVP if anything is ambiguous.

### 2. Run parallel research
The command launches three research agents in parallel:
- pain research analysis
- repository architecture analysis
- task breakdown and acceptance criteria

### 3. Synthesize research
The command reads the key files identified by the research agents and consolidates:
- prioritized goals
- integration points
- the first builder batch
- the MVP boundary and workflow handoff target

### 4. Run bounded build/verify loops
The command launches:
- `builder` to implement the current scoped batch
- `verifier` to issue `Decision: PASS` or `Decision: FAIL`

If the verifier returns `FAIL`, only blocking issues are sent back to the builder. Non-blocking findings are recorded but do not prevent handoff.

### 5. Prepare GitHub handoff
When the verifier returns `PASS`, the command produces a final handoff summary with changed files, research context, and any remaining non-blocking follow-ups.

## Loop protocol

The builder/verifier loop is intentionally strict:

- `FAIL` means one or more blocking issues remain.
- `PASS` means the MVP is good enough to hand off.
- The builder fixes only blocking issues on re-entry.
- After two consecutive `FAIL` results, the workflow should stop automatic looping, summarize the repeated blockers, and ask the user whether to continue.
- The loop ends when no blocking issues remain.

This protocol prevents infinite polishing loops and keeps the workflow aligned with "good enough to submit" rather than "perfect."

## Acceptance and stop conditions

In a real session, treat the workflow as complete when all of the following are true:

- the plugin structure is complete
- all five agents are defined and usable
- the research → build → verify handoff works in the current session
- no blocking workflow issues remain
- the output is ready for commit or PR preparation

## Recommended usage

```bash
/swarm-dev Build a repeatable multi-agent plugin workflow for this repository
```

You can also provide a more specific target, such as a feature, repo path, or implementation objective.

## GitHub handoff

After a successful `PASS`, this plugin can hand the result off to normal Git tooling. If your environment also has the official commit workflow commands available, optional next steps include:

- `/commit` for a local commit
- `/commit-push-pr` for branch, push, and pull request creation

## Design trade-offs

- A standalone plugin keeps orchestration concerns separate from `feature-dev` and `code-review`.
- The MVP focuses on one command, five agents, and a bounded verification loop.
- Hooks, settings, and MCP integration are intentionally deferred until the core workflow proves useful.

## Version

1.0.0
