---
description: Orchestrate research, implementation, and verification agents for a bounded delivery workflow
argument-hint: Optional repo, task, or implementation goal
allowed-tools: Task, AskUserQuestion, Read, Glob, Grep, TaskCreate, TaskUpdate
---

# Swarm Development Workflow

You are coordinating a repeatable multi-agent delivery workflow for a repository or implementation task.

Initial request: $ARGUMENTS

## Workflow Goal

Run a structured sequence of parallel research, scoped implementation, and bounded verification loops so the result is good enough for GitHub handoff without getting stuck in endless refinement.

## Operating Rules

- Start by understanding the repository, task scope, and desired MVP.
- Use a task list to track progress across research, build, verify, and handoff phases.
- Launch the three research agents in parallel before implementation begins.
- Consolidate research into a scoped task batch and explicit acceptance criteria.
- Run builder and verifier in a loop with a strict pass/fail protocol.
- Stop iterating once blocking issues are cleared and the MVP is operational.
- Do not expand scope with unrelated refactors or speculative improvements.

## Phase 1: Scope the work

1. If the task, target repository, or success criteria are unclear, ask focused clarifying questions.
2. Summarize the requested outcome in one concise paragraph.
3. Create a task list that covers:
   - research synthesis
   - current build batch
   - verification
   - GitHub handoff summary

## Phase 2: Launch research in parallel

Launch these three agents in parallel in a single message so they start together:

1. `pain-researcher`
   - Identify the highest-priority pain points, user outcomes, constraints, and MVP boundaries.
2. `architecture-researcher`
   - Map relevant project structure, integration points, critical files, and reuse opportunities.
3. `task-breakdown-researcher`
   - Produce an executable task graph with dependencies, acceptance criteria, and a recommended first batch.

For each agent, request structured output with file references where possible. Ask each research agent to include:
- a short overall conclusion
- prioritized findings
- exact file references for any repository claims
- assumptions or open questions that could block implementation

## Phase 3: Synthesize the research

After all three research agents finish:

1. Read the most relevant files they identify.
2. Produce a synthesis with:
   - prioritized goals
   - relevant architecture and integration points
   - first implementation batch
   - acceptance criteria
   - explicit MVP boundary and workflow handoff target
3. If critical ambiguity remains, ask the user before building.

## Phase 4: Run the builder/verifier loop

### Builder step

Launch `builder` with the current scoped batch only.
Always pass the current scoped batch, the active acceptance criteria, and any unresolved blocking issues from the prior verifier result.

Builder instructions must include:
- implement only the approved batch
- avoid unrelated cleanup or refactoring
- summarize files changed and any open risks
- if re-entering after a verifier failure, address only blocking issues unless the verifier explicitly requests a required adjacent fix

### Verifier step

Launch `verifier` after each builder pass.
Always pass the same scoped batch and acceptance criteria that were given to the builder, plus the builder's implementation summary.

Verifier instructions must require this exact shape:
- `Decision: PASS` or `Decision: FAIL`
- `### Blocking issues`
- `### Non-blocking issues`
- `### Rationale`
- `### Next action for builder`

Require cited file references for every concrete finding.

### Loop policy

- `FAIL` means at least one blocking issue remains.
- On `FAIL`, create a new scoped fix batch containing only the blocking issues and send that batch back to the builder.
- `PASS` means the current MVP is good enough to hand off, even if non-blocking improvements remain.
- Run at least one full builder → verifier cycle before declaring completion.
- If two consecutive verifier passes return `FAIL`, stop automatic looping, summarize the repeated blockers, and ask the user whether to continue with another fix batch.
- Do not continue iterating once the verifier returns `PASS` and no blocking workflow issues remain.
- If the verifier repeatedly surfaces the same unresolved issue, restate the fix request more narrowly and verify the relevant files directly before relaunching the builder.

## Phase 5: GitHub handoff readiness

When the verifier returns `PASS`:

1. Summarize:
   - what was built
   - what research informed the implementation
   - files changed
   - remaining non-blocking follow-ups
2. Confirm the output is ready for commit or PR preparation.
3. Recommend using `/commit` or `/commit-push-pr` if those commands are available in the user's environment and they want GitHub submission automation.

## Completion Criteria

Treat the workflow as complete when all of the following are true:

- the research-to-build-to-verify handoff happened successfully
- at least one builder/verifier loop completed
- no blocking issues remain
- the output is ready for commit or PR preparation

## Output Expectations

Keep each phase concise and action-oriented. When you reference code, include `file_path:line_number`.
