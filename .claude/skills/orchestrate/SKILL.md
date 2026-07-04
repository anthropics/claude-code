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

**Workers** — `team-worker` subagents, pinned by their agent definition to `claude-opus-4-8` at `effort: max`. Each worker executes exactly one assignment and returns a structured report in the format that definition specifies, with confidence-scored evidence. Workers do not spawn their own teams.

## Staying Pinned Across Turns

The frontmatter's `model`/`effort` override lasts only for the turn that triggers it — the session model resumes on the next prompt, and that includes the turn where a background worker's or Workflow's completion notification arrives. Because orchestration inherently spans turns (deploy now, results land later), re-invoke this skill before any turn in which you will act as orchestrator: call the Agent tool, send rework, verify a result, integrate, or write the delivery. Skip re-invocation only when the turn will do nothing but acknowledge a notification and keep waiting — no action, no pin needed. When several completions arrive close together, re-invoke once and review them as a batch rather than once per notification.

## The Orchestration Loop

### 1. Understand and decompose

Scout the relevant code or material directly (fast reads, searches) until the task's real shape is clear. Scouting resolves *structural* unknowns (where the code lives, how it's organized) but not *intent* unknowns (which of several defensible readings the user wants, unstated scope or success criteria) — those can't be read out of the codebase. If the request admits materially different decompositions depending on intent, ask the user one round of targeted clarifying questions, offering the concrete options being chosen between, before decomposing — this is the one point in the loop where a blocking question to the user is correct, since workers can't ask mid-flight and a wrong intent guess makes every downstream step pass locally while the delivered whole is still wrong.

Then split it into work units that are:
- **Self-contained**: completable from the briefing alone, without mid-flight coordination
- **Verifiable**: with acceptance criteria the orchestrator can check from the report and the artifacts
- **Non-overlapping**: two parallel workers must never edit the same files
- **Collectively exhaustive**: the units together cover the whole task — name which unit owns each part, and confirm no responsibility falls in the seam where each of two workers assumes the other owns it

Record the plan as a task list (TaskCreate, or this environment's task-list tool), mapping each part of the request to the unit that owns it — this mapping is what step 5 checks the integrated result against — so the user can watch team progress.

### 2. Design the team

Decide worker count from the decomposition, not from a quota: one worker per independent unit, batching trivially small related units into one assignment. Sequence units with dependencies; parallelize the rest. Typical shapes:
- Few large independent units → one worker each, spawned in parallel
- Many similar small units (migrations, sweeps) → consider the Workflow tool with `agentType: 'team-worker'` for deterministic fan-out, when available
- Unknown-size discovery (find all X) → waves of finders until a wave returns nothing new
- Exactly one unit → no team to design; skip straight to briefing. Step 5's seam-resolution and cross-unit integration-defect hunting are no-ops with nothing to integrate against — verify the single unit's own correctness instead.

### 3. Brief and deploy

Every briefing must contain: objective, context (relevant files, constraints, decisions already made), scope boundaries (what NOT to touch), acceptance criteria, and the required report format. A worker cannot ask questions mid-flight — an under-specified briefing produces rework, not clarification. Use the full template in `references/patterns.md`. When acceptance criteria had to be invented rather than taken verbatim from the request, or success is inherently subjective, echo them to the user in one line before deploying — see Criteria Ratification in `references/patterns.md` — since correcting a wrong target is free before the team runs and costly after.

Deploy with the Agent tool, `subagent_type: team-worker`. Spawn independent workers in a single message so they run concurrently. When parallel workers must edit files, either redesign the split so they touch disjoint files, or use `isolation: "worktree"` and let the orchestrator merge.

### 4. Collect and review

Review every report — never rubber-stamp. For each acceptance criterion, check the evidence in the report; for anything load-bearing, verify directly (run the tests, read the diff, exercise the behavior). A worker's claim is an input to review, not a conclusion.

On failure, send rework with specific findings: what failed, where, and what acceptance now requires. Continue the same worker via SendMessage when its context is still valuable; spawn a fresh worker when the approach itself was wrong. Dispatch rework for independent units in one message, as with initial deployment.

### 5. Integrate and verify end-to-end

Combine the accepted work, resolve any seams between units, and verify the whole — not just the parts. Run the full test suite or exercise the complete flow, then check the integrated result against the request-to-unit mapping recorded at decomposition — and re-read the original request for anything the mapping itself missed: a green test suite proves nothing broke, not that everything asked-for was included, and a decomposition can omit a needed unit even when every deployed unit and the suite pass. Integration defects (two units individually correct but jointly wrong, or a unit missing from the decomposition entirely) are the orchestrator's responsibility alone; no worker could have seen them. See the seam-failure checklist in `references/patterns.md` for concrete failure modes to check.

### 6. Deliver

Report so the user can judge whether their intent was met, not just what the team did. Lead with the original request restated, each part marked done, partial, or not done — then any assumption or interpretation made on the user's behalf (an ambiguous-intent call, an invented acceptance criterion) as an explicit, correctable statement, not buried under risks. Follow with what was verified and how, and the concrete way the user can check the result themselves (a command to run, a flow to try). Team structure and per-worker contribution come last, if at all — they matter to the orchestrator's own record, not to whether the user got what they asked for.

## Rules

- Scale the team to the task: a task with two natural units gets two workers, not ten. Ten shallow workers are worse than three well-briefed ones.
- Before deploying more than roughly five workers at once, or before a plan that will clearly run many rounds, state the planned team size and shape to the user in one line, then proceed — transparency, not a blocking question. Workers run at Opus 4.8 max effort, the most expensive tier, so scale is worth surfacing.
- Operate at ultracode thoroughness throughout: exhaustive decomposition, adversarial review, verification over speed — token cost is not the constraint, correctness is.
- If a worker returns null or dies, never silently drop its unit — recover it per the Failure Handling section in `references/patterns.md`.

## Additional Resources

### Reference Files

- **`references/patterns.md`** — the worker briefing template, criteria ratification, team-shape patterns, Workflow-tool fan-out examples, the review and seam-failure checklists, and failure handling.
- **`references/example.md`** — a worked walkthrough of one task through the full loop, plus sketches for task shapes beyond code sweeps (research, subjective criteria, external APIs).
