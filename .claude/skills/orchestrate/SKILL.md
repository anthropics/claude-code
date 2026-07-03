---
name: orchestrate
description: This skill should be used when the user asks to "orchestrate" a task, "work as a team", "deploy agents", "spawn workers", "split this across agents", "use the orchestrator", or wants a large task executed by a coordinated team of subagents. The main conversation acts as orchestrator (Fable 5, max effort) — planning, delegating, reviewing — while team-worker subagents (Opus 4.8, max effort) execute the work and report back.
argument-hint: <task to execute as a team>
model: claude-fable-5
effort: max
version: 0.1.0
---

# Orchestrate: Team-of-Agents Execution

Execute a large task as a coordinated team: one orchestrator that plans, delegates, reviews, and integrates — and as many worker agents as the task warrants, each executing one well-briefed assignment and reporting back.

## Roles

**Orchestrator** — the main conversation. The frontmatter above pins it to Fable 5 at max effort for the turn (if that model is unavailable on the current plan, continue on the session model at the same rigor). The orchestrator owns:
- Decomposition: splitting the task into self-contained work units
- Team design: how many workers, what each one does, in what order
- Briefing: writing each worker's assignment
- Review: judging every report against acceptance criteria before accepting it
- Integration: combining results, resolving conflicts, end-to-end verification
- Delivery: the final report to the user

The orchestrator does **not** do worker-scale execution itself. Its hands-on work is limited to scouting (quick reads to inform decomposition), reviewing, integrating, and verifying.

**Workers** — `team-worker` subagents, pinned by `.claude/agents/team-worker.md` to `claude-opus-4-8` at `effort: max`. Each worker executes exactly one assignment and returns a structured report in the format that file defines, with confidence-scored evidence. Workers do not spawn their own teams.

## Staying Pinned Across Turns

The frontmatter's `model`/`effort` override lasts only for the turn that triggers it — the session model resumes on the next prompt, and that includes the turn where a background worker's or Workflow's completion notification arrives. Because orchestration inherently spans turns (deploy now, results land later), re-invoke this skill at the start of every turn that does orchestrator judgment — before reviewing a batch of reports, before integrating, before final delivery — to reapply the pin for that turn. Skip re-invocation only for turns that are pure waiting, with no orchestrator judgment happening yet.

## The Orchestration Loop

### 1. Understand and decompose

Scout the relevant code or material directly (fast reads, searches) until the task's real shape is clear. Then split it into work units that are:
- **Self-contained**: completable from the briefing alone, without mid-flight coordination
- **Verifiable**: with acceptance criteria the orchestrator can check from the report and the artifacts
- **Non-overlapping**: two parallel workers must never edit the same files

Record the plan as a task list (TaskCreate) so the user can watch team progress.

### 2. Design the team

Decide worker count from the decomposition, not from a quota: one worker per independent unit, batching trivially small related units into one assignment. Sequence units with dependencies; parallelize the rest. Typical shapes:
- Few large independent units → one worker each, spawned in parallel
- Many similar small units (migrations, sweeps) → consider the Workflow tool with `agentType: 'team-worker'` for deterministic fan-out, when available
- Unknown-size discovery (find all X) → waves of finders until a wave returns nothing new

### 3. Brief and deploy

Every briefing must contain: objective, context (relevant files, constraints, decisions already made), scope boundaries (what NOT to touch), acceptance criteria, and the required report format. A worker cannot ask questions mid-flight — an under-specified briefing produces rework, not clarification. Use the full template in `references/patterns.md`.

Deploy with the Agent tool, `subagent_type: team-worker`. Spawn independent workers in a single message so they run concurrently. When parallel workers must edit files, either redesign the split so they touch disjoint files, or use `isolation: "worktree"` and let the orchestrator merge.

### 4. Collect and review

Review every report — never rubber-stamp. For each acceptance criterion, check the evidence in the report; for anything load-bearing, verify directly (run the tests, read the diff, exercise the behavior). A worker's claim is an input to review, not a conclusion.

On failure, send rework with specific findings: what failed, where, and what acceptance now requires. Continue the same worker via SendMessage when its context is still valuable; spawn a fresh worker when the approach itself was wrong.

### 5. Integrate and verify end-to-end

Combine the accepted work, resolve any seams between units, and verify the whole — not just the parts. Run the full test suite or exercise the complete flow. Integration defects (two units individually correct but jointly wrong) are the orchestrator's responsibility alone; no worker could have seen them.

### 6. Deliver

Report the outcome to the user: what was accomplished, how the team was structured, what each worker contributed, what was verified and how, and any open risks. Lead with the outcome, not the process.

## Rules

- The orchestrator reviews everything; workers verify their own work first, but self-verification never substitutes for orchestrator review.
- Independent assignments launch in one message, in parallel. Dependent assignments wait for their inputs to be accepted, not merely reported.
- Never let two concurrent workers write to the same file without worktree isolation.
- Scale the team to the task: a task with two natural units gets two workers, not ten. Ten shallow workers are worse than three well-briefed ones.
- Before deploying more than roughly five workers at once, or before a plan that will clearly run many rounds, state the planned team size and shape to the user in one line, then proceed — transparency, not a blocking question. Workers run at Opus 4.8 max effort, the most expensive tier, so scale is worth surfacing.
- Operate at ultracode thoroughness throughout: exhaustive decomposition, adversarial review, verification over speed — token cost is not the constraint, correctness is.
- If a worker returns null or dies, never silently drop its unit — recover it per the Failure Handling section in `references/patterns.md`.

## Additional Resources

### Reference Files

- **`references/patterns.md`** — the full worker briefing template, team-shape patterns (parallel fan-out, sequenced stages, discovery waves, review panels, worktree-isolated edits), the orchestrator's review checklist, Workflow-tool fan-out examples for large teams, and failure handling for dead, out-of-scope, or colliding workers.
- **`references/example.md`** — a worked walkthrough of one task through the full loop: decomposition, team-size transparency, a filled-in briefing with a pinned metric, worker reports with confidence scores, confidence-weighted review, a hypothetical rework message, integration, and delivery.
